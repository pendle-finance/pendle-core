import { expect } from 'chai';
import { BigNumber as BN, BigNumberish, Contract, Wallet } from 'ethers';
import ERC20 from '../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import AToken from '../../build/artifacts/contracts/interfaces/IAToken.sol/IAToken.json';
import CToken from '../../build/artifacts/contracts/interfaces/ICToken.sol/ICToken.json';
import TetherToken from '../../build/artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import MockPendleAaveMarket from '../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';

import { RouterFixture, TestEnv } from '../core/fixtures/';
import { aaveV2Fixture } from '../core/fixtures/aaveV2.fixture';
import { consts, Token, tokens } from './Constants';

import { impersonateAccount } from './Evm';

const hre = require('hardhat');
const { waffle } = require('hardhat');
const { provider } = waffle;
const PRECISION = BN.from(2).pow(40);

export async function mintOtAndXyt(
  token: Token,
  user: Wallet,
  amount: BN,
  env: RouterFixture
): Promise<{ A2TokenMinted: BN; CTokenMinted: BN }> {
  let router = env.core.router;
  const a2Contract = await getA2Contract(user, env.a2Forge.aaveV2Forge, token);
  const cContract = await getCContract(user, token);

  let preA2TokenBal = await a2Contract.balanceOf(user.address);
  let preCTokenBal = await cContract.balanceOf(user.address);

  await mintAaveV2Token(token, user, amount);
  await mintCompoundToken(token, user, amount);
  await a2Contract.approve(router.address, consts.INF);
  await cContract.approve(router.address, consts.INF);

  let postA2TokenBal = await a2Contract.balanceOf(user.address);
  let postCTokenBal = await cContract.balanceOf(user.address);

  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_AAVE_V2,
      token.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      postA2TokenBal.sub(preA2TokenBal),
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_COMPOUND,
      token.address,
      consts.T0_C.add(consts.SIX_MONTH),
      postCTokenBal.sub(preCTokenBal),
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
  return {
    A2TokenMinted: postA2TokenBal.sub(preA2TokenBal),
    CTokenMinted: postCTokenBal.sub(preCTokenBal),
  };
}

export async function mintAaveXytWithExpiry(token: Token, user: Wallet, amount: BN, env: RouterFixture, expiry: BN) {
  let router = env.core.router;
  const a2Contract = await getA2Contract(user, env.a2Forge.aaveV2Forge, token);
  let preA2TokenBal = await a2Contract.balanceOf(user.address);
  await mintAaveV2Token(token, user, amount);
  await a2Contract.approve(router.address, consts.INF);
  let postA2TokenBal = await a2Contract.balanceOf(user.address);
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_AAVE_V2,
      token.address,
      expiry,
      postA2TokenBal.sub(preA2TokenBal),
      user.address,
      consts.HIGH_GAS_OVERRIDE
    );
}

export async function mint(token: Token, alice: Wallet, amount: BN) {
  await impersonateAccount(token.owner!);
  const signer = await provider.getSigner(token.owner!);

  const contractToken = new Contract(token.address, TetherToken.abi, signer);
  const tokenAmount = amountToWei(amount, token.decimal);
  await contractToken.issue(tokenAmount);
  await contractToken.transfer(alice.address, tokenAmount);
}

export async function convertToAaveV2Token(token: Token, alice: Wallet, amount: BN) {
  const { lendingPool } = await aaveV2Fixture(alice);
  const tokenAmount = amountToWei(amount, token.decimal);

  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(lendingPool.address, tokenAmount);

  await lendingPool.deposit(token.address, tokenAmount, alice.address, 0);
}

export async function convertToCompoundToken(token: Token, alice: Wallet, amount: BN) {
  const tokenAmount = amountToWei(amount, token.decimal);

  const cToken = new Contract(token.compound, CToken.abi, alice);
  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(cToken.address, tokenAmount);

  await cToken.mint(tokenAmount);
}

export async function mintAaveV2Token(token: Token, alice: Wallet, amount: BN) {
  await mint(token, alice, amount);
  await convertToAaveV2Token(token, alice, amount);
}

export async function mintCompoundToken(token: Token, alice: Wallet, amount: BN) {
  await mint(token, alice, amount);
  await convertToCompoundToken(token, alice, amount);
}

export async function transferToken(token: Token, from: Wallet, to: string, amount: BN) {
  const erc20 = new Contract(token.address, ERC20.abi, from);
  await erc20.transfer(to, amount);
}

export async function getA2Contract(alice: Wallet, aaveV2Forge: Contract, token: Token): Promise<Contract> {
  const aContractAddress = await aaveV2Forge.callStatic.getYieldBearingToken(token.address);
  return new Contract(aContractAddress, ERC20.abi, alice);
}

export async function getCContract(alice: Wallet, token: Token): Promise<Contract> {
  return new Contract(token.compound, CToken.abi, alice);
}

export async function getERC20Contract(alice: Wallet, token: Token): Promise<Contract> {
  return new Contract(token.address, AToken.abi, alice);
}

/**
 * convert an amount to Wei
 * @param inp if inp is number => inp is the number of decimal digits
 *            if inp is Token => the number of decimal digits will be extracted from Token
 */
export function amountToWei(amount: BN, decimal: number) {
  return BN.from(10).pow(decimal).mul(amount);
}

export async function emptyToken(tokenContract: Contract, person: Wallet) {
  let bal: BN = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
  bal = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
}

export function getGain(amount: BN, rate: BN, duration: BN): BN {
  const precision = BN.from(10).pow(27);
  const rateForDuration = rate.mul(duration).mul(amount).div(consts.ONE_YEAR).div(precision);

  return rateForDuration;
}

export function approxBigNumber(
  _actual: BigNumberish,
  _expected: BigNumberish,
  _delta: BigNumberish,
  log: boolean = true
) {
  let actual: BN = BN.from(_actual);
  let expected: BN = BN.from(_expected);
  let delta: BN = BN.from(_delta);

  var diff = expected.sub(actual);
  if (diff.lt(0)) {
    diff = diff.mul(-1);
  }
  if (diff.lte(delta) == false) {
    expect(
      diff.lte(delta),
      `expecting: ${expected.toString()}, received: ${actual.toString()}, diff: ${diff.toString()}, allowedDelta: ${delta.toString()}`
    ).to.be.true;
  } else {
    if (log) {
      console.log(
        `expecting: ${expected.toString()}, received: ${actual.toString()}, diff: ${diff.toString()}, allowedDelta: ${delta.toString()}`
      );
    }
  }
}

export function toFixedPoint(val: string | number): BN {
  if (typeof val === 'number') {
    return BN.from(val).mul(PRECISION);
  }
  var pos: number = val.indexOf('.');
  if (pos == -1) {
    return BN.from(val).mul(PRECISION);
  }
  var lenFrac = val.length - pos - 1;
  val = val.replace('.', '');
  return BN.from(val).mul(PRECISION).div(BN.from(10).pow(lenFrac));
}

export function toFPWei(val: string | number): BN {
  return toFixedPoint(val).mul(1000000);
}

export function randomBN(_range?: number | BN): BN {
  let range: number;
  if (_range == undefined) range = 1e15;
  else if (typeof _range === 'number') {
    range = _range;
  } else range = _range.toNumber();

  return BN.from(Math.floor(Math.random() * range));
}

export function randomNumber(range?: number): number {
  return randomBN(range).toNumber();
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

export async function addFakeIncomeCompound(env: TestEnv, user: Wallet) {
  await mint(tokens.USDT, user, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await env.USDTContract.connect(user).transfer(
    env.yUSDT.address,
    amountToWei(consts.INITIAL_COMPOUND_TOKEN_AMOUNT, 6)
  );
  await env.yUSDT.balanceOfUnderlying(user.address); // interact with compound so that it updates all info
}

export async function logTokenBalance(token: Contract, people: Wallet[]) {
  for (let person of people) {
    console.log((await token.balanceOf(person.address)).toString());
  }
}

export async function createAaveMarketWithExpiry(env: TestEnv, expiry: BN, wallets: any) {
  const [alice, bob, charlie, dave, eve] = wallets;

  await env.router.newYieldContracts(env.FORGE_ID, tokens.USDT.address, expiry, consts.HIGH_GAS_OVERRIDE);

  const otAddress = await env.data.otTokens(env.FORGE_ID, tokens.USDT.address, expiry, consts.HIGH_GAS_OVERRIDE);

  const xytAddress = await env.data.xytTokens(env.FORGE_ID, tokens.USDT.address, expiry, consts.HIGH_GAS_OVERRIDE);

  const ownershipToken = new Contract(otAddress, MockPendleOwnershipToken.abi, alice);

  const futureYieldToken = new Contract(xytAddress, PendleFutureYieldToken.abi, alice);

  for (var person of [alice, bob, charlie, dave]) {
    await mintAaveXytWithExpiry(tokens.USDT, person, consts.INITIAL_OT_XYT_AMOUNT, env.routerFixture, expiry);
  }

  const totalSupply = await env.testToken.totalSupply();
  // for (var person of [bob, charlie, dave, eve]) {
  //   await env.testToken.transfer(person.address, totalSupply.div(5), consts.HIGH_GAS_OVERRIDE);
  // }

  await env.router.createMarket(
    env.MARKET_FACTORY_ID,
    futureYieldToken.address,
    env.testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

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
