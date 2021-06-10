import { BigNumber as BN, Contract, Wallet } from 'ethers';
import MockPendleAaveMarket from '../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { TestEnv } from '../core/fixtures/';
import { consts, tokens } from './Constants';
import { amountToWei } from './Numeric';
import { mint, mintXytAave } from './TokenHelpers';

const hre = require('hardhat');
const { waffle } = require('hardhat');
const { provider } = waffle;

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

export async function logTokenBalance(token: Contract, people: Wallet[]) {
  for (let person of people) {
    console.log((await token.balanceOf(person.address)).toString());
  }
}

export async function createAaveMarketWithExpiry(env: TestEnv, expiry: BN, wallets: any) {
  const [alice, bob, charlie, dave, eve] = wallets;

  await env.router.newYieldContracts(env.FORGE_ID, tokens.USDT.address, expiry, consts.HG);

  const otAddress = await env.data.otTokens(env.FORGE_ID, tokens.USDT.address, expiry, consts.HG);

  const xytAddress = await env.data.xytTokens(env.FORGE_ID, tokens.USDT.address, expiry, consts.HG);

  const ownershipToken = new Contract(otAddress, MockPendleOwnershipToken.abi, alice);

  const futureYieldToken = new Contract(xytAddress, PendleFutureYieldToken.abi, alice);

  for (var person of [alice, bob, charlie, dave]) {
    await mintXytAave(tokens.USDT, person, consts.INITIAL_OT_XYT_AMOUNT, env.routerFixture, expiry);
  }

  const totalSupply = await env.testToken.totalSupply();
  // for (var person of [bob, charlie, dave, eve]) {
  //   await env.testToken.transfer(person.address, totalSupply.div(5), consts.HG);
  // }

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
