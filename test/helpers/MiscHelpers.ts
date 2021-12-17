import { BigNumber as BN, Contract, Wallet } from 'ethers';
import hre from 'hardhat';
import { teConsts } from '.';
import { amountToWei, getContract, isAvax } from '../../pendle-deployment-scripts';
import { Mode, TestEnv, wallets } from '../fixtures/';
import { sqrt } from './Numeric';
import { mint, mintXytAave } from './TokenHelpers';
import { Erc20Token } from '@pendle/constants';

export async function deployContract(contractType: string, args: any[]) {
  const contractFactory = await hre.ethers.getContractFactory(contractType);
  const contractObject = await contractFactory.deploy(...args);
  await contractObject.deployed();
  return contractObject;
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

export async function addFakeIncomeCompoundUSDT(env: TestEnv) {
  await mint(env, env.ptokens.USDT!, env.eve, teConsts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await env.USDTContract.connect(env.eve).transfer(
    env.yToken.address,
    amountToWei(teConsts.INITIAL_COMPOUND_TOKEN_AMOUNT, 6)
  );
  await env.yToken.balanceOfUnderlying(env.eve.address); // interact with compound so that it updates all info
}

export async function addFakeIncomeBenQiDAI(env: TestEnv) {
  await mint(env, env.ptokens.DAI!, env.eve, teConsts.INITIAL_BENQI_DAI_AMOUNT);
  await env.DAIContract.connect(env.eve).transfer(
    env.yToken.address,
    amountToWei(teConsts.INITIAL_BENQI_DAI_AMOUNT, env.ptokens.DAI!.decimal)
  );
  await env.yToken.balanceOfUnderlying(env.eve.address);
}

export async function addFakeIncomeKyber(env: TestEnv, numRep: number = 1) {
  const amountUSDT = BN.from(13000000);
  const amountWETH = BN.from(6100);
  await mint(env, env.ptokens.USDT!, env.eve, amountUSDT);
  await mint(env, env.ptokens.WNATIVE, env.eve, amountWETH);
  while (numRep--) {
    await env.kyberRouter
      .connect(env.eve)
      .swapExactTokensForTokens(
        amountToWei(amountUSDT, 6),
        0,
        [env.ptokens.KYBER_USDT_WETH_LP!.address],
        [env.ptokens.USDT!.address, env.ptokens!.WNATIVE.address],
        env.eve.address,
        env.pconsts.misc.INF
      );
    await env.kyberRouter
      .connect(env.eve)
      .swapExactTokensForTokens(
        amountToWei(amountWETH, 18),
        0,
        [env.ptokens.KYBER_USDT_WETH_LP!.address],
        [env.ptokens.WNATIVE.address, env.ptokens.USDT!.address],
        env.eve.address,
        env.pconsts.misc.INF
      );
  }
}

export async function addFakeIncomeSushi(env: TestEnv, numRep: number = 1) {
  let eve = env.eve;
  let token0: Contract;
  let token1: Contract = env.WNativeContract;

  token0 = env.USDTContract;
  const amountUSDT = BN.from(50 * 10 ** 6);
  if ((await env.USDTContract.balanceOf(eve.address)).lt(amountToWei(amountUSDT, 6))) {
    await mint(env, env.ptokens.USDT!, eve, amountUSDT);
  }
  while (numRep--) {
    for (let i = 0; i < 2; i++) {
      await env.sushiRouter
        .connect(eve)
        .swapExactTokensForTokens(
          token0.balanceOf(eve.address),
          0,
          [token0.address, token1.address],
          eve.address,
          env.pconsts.misc.INF,
          teConsts.HG
        );
      await env.sushiRouter
        .connect(eve)
        .swapExactTokensForTokens(
          token1.balanceOf(eve.address),
          0,
          [token1.address, token0.address],
          eve.address,
          env.pconsts.misc.INF,
          teConsts.HG
        );
    }
  }
}

export async function addFakeIncomeTraderJoe(env: TestEnv, numRep: number = 1) {
  let eve = env.eve;
  let token0 = env.DAIContract;
  let token1 = env.WNativeContract;

  const amountDAI = BN.from(6600);
  if ((await token0.balanceOf(eve.address)).lt(amountToWei(amountDAI, 18))) {
    await mint(env, env.ptokens.DAI!, eve, amountDAI);
  }

  while (numRep--) {
    for (let i = 0; i < 2; i++) {
      await env.joeRouter
        .connect(eve)
        .swapExactTokensForTokens(
          token0.balanceOf(eve.address),
          0,
          [token0.address, token1.address],
          eve.address,
          env.pconsts.misc.INF,
          teConsts.HG
        );
      await env.joeRouter
        .connect(eve)
        .swapExactTokensForTokens(
          token1.balanceOf(eve.address),
          0,
          [token1.address, token0.address],
          eve.address,
          env.pconsts.misc.INF,
          teConsts.HG
        );
    }
  }
}

export async function addFakeIncomeXJoe(env: TestEnv, numRep: number = 1) {
  const eve = env.eve;
  while (numRep--) {
    await mint(env, env.ptokens!.JOE!, eve, env.INITIAL_YIELD_TOKEN_AMOUNT);
    await env.JOEContract.connect(eve).transfer(
      env.xJoe.address,
      await env.JOEContract.balanceOf(eve.address),
      teConsts.HG
    );
  }
}

export async function redeemRewardsFromProtocol(env: TestEnv, users: Wallet[]) {
  if (env.mode == Mode.AAVE_V2) {
    const incentiveController = await getContract('IAaveIncentivesController', env.pconsts.aave!.INCENTIVES_CONTROLLER);
    for (const person of users) {
      await incentiveController
        .connect(person)
        .claimRewards([env.yToken.address], env.pconsts.misc.INF, person.address, teConsts.HG);
    }
  } else if (env.mode == Mode.COMPOUND || env.mode == Mode.COMPOUND_V2) {
    const comptroller = await getContract('IComptroller', env.pconsts.compound!.COMPTROLLER);
    await comptroller.claimComp(
      users.map((u) => u.address),
      [env.yToken.address],
      false,
      true,
      teConsts.HG
    );
  } else if (env.mode == Mode.SUSHISWAP_COMPLEX) {
    const sushiswapMasterChef = await getContract('IMasterChef', env.pconsts.sushi!.MASTERCHEF_V1);
    for (const person of users) {
      const balance = (await sushiswapMasterChef.userInfo(env.ptokens.SUSHI_USDT_WETH_LP!.pid!, person.address)).amount;
      await sushiswapMasterChef.connect(person).withdraw(env.ptokens.SUSHI_USDT_WETH_LP!.pid!, balance, teConsts.HG);
    }
  }
}

export async function getSushiLpValue(env: TestEnv, amount: BN) {
  const MULTIPLIER = BN.from(10).pow(20);
  let sushiPool: Contract = await getContract('IUniswapV2Pair', env.yToken.address);
  let { reserve0, reserve1 } = await sushiPool.getReserves();
  let kValue: BN = sqrt(reserve0.mul(reserve1));
  let totalSupply: BN = await sushiPool.totalSupply();
  return amount.mul(kValue).mul(MULTIPLIER).div(totalSupply);
}

export async function createAaveMarketWithExpiry(env: TestEnv, expiry: BN) {
  const [alice, bob, charlie, dave] = wallets;

  await env.router.newYieldContracts(env.FORGE_ID, env.ptokens.USDT!.address, expiry, teConsts.HG);

  const xytAddress = await env.data.xytTokens(env.FORGE_ID, env.ptokens.USDT!.address, expiry, teConsts.HG);

  const futureYieldToken = await getContract('PendleFutureYieldToken', xytAddress);

  for (var person of [alice, bob, charlie, dave]) {
    await mintXytAave(env, env.ptokens.USDT!, person, teConsts.INITIAL_OT_XYT_AMOUNT, expiry);
  }

  await env.router.createMarket(env.MARKET_FACTORY_ID, futureYieldToken.address, env.testToken.address, teConsts.HG);

  const marketAddress = await env.data.getMarket(
    env.MARKET_FACTORY_ID,
    futureYieldToken.address,
    env.testToken.address
  );

  const market = await getContract('MockPendleAaveMarket', marketAddress);
  let newEnv: TestEnv = { ...env, market: market, xyt: futureYieldToken, EXPIRY: expiry };
  return newEnv;
}

export function wrapEth(object: any, ethAmount: BN): any {
  const cloneObj = JSON.parse(JSON.stringify(object));
  cloneObj.value = ethAmount;
  return cloneObj;
}

export async function createUniOrSushiPool(env: TestEnv, tokenA: string, tokenB: string) {
  const factoryAddress = isAvax(env.penv.network) ? env.pconsts.joe!.PAIR_FACTORY : env.pconsts.sushi!.PAIR_FACTORY;
  const sushiFactory = await getContract('IUniswapV2Factory', factoryAddress);
  await sushiFactory.createPair(tokenA, tokenB, teConsts.HG);
  const poolAddress = await sushiFactory.getPair(tokenA, tokenB, teConsts.HG);
  return poolAddress;
}

export function toAddress(input: string | Contract | Erc20Token) {
  if (typeof input == 'string') return input;
  else return input.address;
}

export function getOtRouter(env: TestEnv): string {
  return isAvax(env.penv.network) ? env.pconsts.joe!.ROUTER : env.pconsts.sushi!.ROUTER;
}
