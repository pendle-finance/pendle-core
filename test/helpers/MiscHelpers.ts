import { BigNumber as BN, Contract, Wallet } from 'ethers';
import hre from 'hardhat';
import IUniswapV2Pair from '../../build/artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json';
import IUniswapV2Router02 from '../../build/artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json';
import MockPendleAaveMarket from '../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { Mode, TestEnv } from '../fixtures/';
import { consts, tokens } from './Constants';
import { amountToWei, sqrt } from './Numeric';
import { mint, mintXytAave } from './TokenHelpers';

const { waffle, network } = require('hardhat');

let wallets = [];
let alice: Wallet;
let bob: Wallet;
let charlie: Wallet;
let dave: Wallet;
let eve: Wallet;

if (network.name == 'hardhat') {
  wallets = waffle.provider.getWallets();
  [alice, bob, charlie, dave, eve] = wallets;
}

export async function logMarketReservesData(market: Contract) {
  let marketData = await market.getReserves();
  console.log('=============MARKET===DATA===============');
  console.log('xytBalance: ', marketData.xytBalance.toString());
  console.log('xytWeight: ', marketData.xytWeight.toString());
  console.log('tokenBalance: ', marketData.tokenBalance.toString());
  console.log('tokenWeight: ', marketData.tokenWeight.toString());
  console.log('totalSupply: ', (await market.totalSupply()).toString());
  console.log('=========================================');
}

export async function addFakeIncomeCompoundUSDT(env: TestEnv, user: Wallet) {
  await mint(tokens.USDT, user, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await env.USDTContract.connect(user).transfer(
    env.yToken.address,
    amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, 6)
  );
  await env.yToken.balanceOfUnderlying(user.address); // interact with compound so that it updates all info
}

export async function addFakeIncomeSushi(env: TestEnv, user: Wallet, numRep?: number) {
  if (numRep == null) {
    numRep = 1;
  }
  let sushiRouter: Contract = new Contract(consts.SUSHISWAP_ROUTER_ADDRESS, IUniswapV2Router02.abi, user);
  // let sushiPool: Contract = new Contract(tokens.SUSHI_USDT_WETH_LP.address, IUniswapV2Pair.abi, user);
  const amountUSDT = BN.from(50 * 10 ** 6);
  if ((await env.USDTContract.balanceOf(user.address)).lt(amountToWei(amountUSDT, 6))) {
    await mint(tokens.USDT, user, amountUSDT);
  }
  while (numRep--) {
    for (let i = 0; i < 2; i++) {
      await sushiRouter.swapExactTokensForTokens(
        env.USDTContract.balanceOf(user.address),
        0,
        [tokens.USDT.address, tokens.WETH.address],
        user.address,
        consts.INF,
        consts.HG
      );
      await sushiRouter.swapExactTokensForTokens(
        env.WETHContract.balanceOf(user.address),
        0,
        [tokens.WETH.address, tokens.USDT.address],
        user.address,
        consts.INF,
        consts.HG
      );
    }
  }
}

export async function redeemRewardsFromProtocol(env: TestEnv, users: Wallet[]) {
  if (env.mode == Mode.AAVE_V2) {
    const incentiveController = await getContractAt('IAaveIncentivesController', consts.AAVE_INCENTIVES_CONTROLLER);
    for (const person of users) {
      await incentiveController
        .connect(person)
        .claimRewards([env.yToken.address], consts.INF, person.address, consts.HG);
    }
  } else if (env.mode == Mode.COMPOUND || env.mode == Mode.COMPOUND_V2) {
    const comptroller = await getContractAt('IComptroller', consts.COMPOUND_COMPTROLLER_ADDRESS);
    await comptroller.claimComp(
      users.map((u) => u.address),
      [env.yToken.address],
      false,
      true,
      consts.HG
    );
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX) {
    const sushiswapMasterChef = await getContractAt('IMasterChef', consts.MASTERCHEF_V1_ADDRESS);
    for (const person of users) {
      const balance = (await sushiswapMasterChef.userInfo(consts.SUSHI_USDT_WETH_PID, person.address)).amount;
      await sushiswapMasterChef.connect(person).withdraw(consts.SUSHI_USDT_WETH_PID, balance, consts.HG);
    }
  }
}

const MULTIPLIER = BN.from(10).pow(20);
export async function getSushiLpValue(env: TestEnv, amount: BN): Promise<BN> {
  let sushiPool: Contract = new Contract(tokens.SUSHI_USDT_WETH_LP.address, IUniswapV2Pair.abi, alice);
  let { reserve0, reserve1 } = await sushiPool.getReserves();
  let kValue: BN = sqrt(reserve0.mul(reserve1));
  let totalSupply: BN = await sushiPool.totalSupply();
  return amount.mul(kValue).mul(MULTIPLIER).div(totalSupply);
}

export async function logTokenBalance(token: Contract, people: Wallet[]) {
  for (let person of people) {
    console.log((await token.balanceOf(person.address)).toString());
  }
}

export async function createAaveMarketWithExpiry(env: TestEnv, expiry: BN, wallets: any) {
  const [alice, bob, charlie, dave] = wallets;

  await env.router.newYieldContracts(env.FORGE_ID, tokens.USDT.address, expiry, consts.HG);

  const xytAddress = await env.data.xytTokens(env.FORGE_ID, tokens.USDT.address, expiry, consts.HG);

  const futureYieldToken = new Contract(xytAddress, PendleFutureYieldToken.abi, alice);

  for (var person of [alice, bob, charlie, dave]) {
    await mintXytAave(tokens.USDT, person, consts.INITIAL_OT_XYT_AMOUNT, env.routerFixture, expiry);
  }

  await env.router.createMarket(env.MARKET_FACTORY_ID, futureYieldToken.address, env.testToken.address, consts.HG);

  const marketAddress = await env.data.getMarket(
    env.MARKET_FACTORY_ID,
    futureYieldToken.address,
    env.testToken.address
  );

  const market = new Contract(marketAddress, MockPendleAaveMarket.abi, alice);

  let newEnv: TestEnv = { ...env };
  newEnv.market = market;
  newEnv.xyt = futureYieldToken;
  newEnv.EXPIRY = expiry;

  return newEnv;
}

export function wrapEth(object: any, ethAmount: BN): any {
  const cloneObj = JSON.parse(JSON.stringify(object));
  cloneObj.value = ethAmount;
  return cloneObj;
}

export async function getContractAt(ContractABIName: string, address: string): Promise<Contract> {
  return await hre.ethers.getContractAt(ContractABIName, address);
}
