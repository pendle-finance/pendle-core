import { expect } from "chai";
import {
  BigNumber as BN,
  BigNumberish,
  Contract,
  providers,
  Wallet,
} from "ethers";
import ERC20 from "../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import AToken from "../../build/artifacts/contracts/interfaces/IAToken.sol/IAToken.json";
import CToken from "../../build/artifacts/contracts/interfaces/ICToken.sol/ICToken.json";
import TetherToken from "../../build/artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json";
import { liqParams } from "../core/fixtures/";
import { aaveFixture } from "../core/fixtures/aave.fixture";
import { aaveV2Fixture } from "../core/fixtures/aaveV2.fixture";
import { consts, Token } from "./Constants";
import { impersonateAccount } from "./Evm";

const hre = require("hardhat");
const { waffle } = require("hardhat");
const { provider } = waffle;
const PRECISION = BN.from(2).pow(40);

export async function mintOtAndXyt(
  token: Token,
  user: Wallet,
  amount: BN,
  router: Contract,
  aaveForge: Contract,
  aaveV2Forge: Contract
): Promise<{ ATokenMinted: BN; A2TokenMinted: BN; CTokenMinted: BN }> {
  const aContract = await getAContract(user, aaveForge, token);
  const a2Contract = await getA2Contract(user, aaveV2Forge, token);
  const cContract = await getCContract(user, token);

  let preATokenBal = await aContract.balanceOf(user.address);
  let preA2TokenBal = await a2Contract.balanceOf(user.address);
  let preCTokenBal = await cContract.balanceOf(user.address);

  await mintAaveToken(token, user, amount, true);
  await mintAaveToken(token, user, amount, false);
  await mintCompoundToken(token, user, amount);
  await aContract.approve(router.address, consts.INF);
  await a2Contract.approve(router.address, consts.INF);
  await cContract.approve(router.address, consts.INF);

  let postATokenBal = await aContract.balanceOf(user.address);
  let postA2TokenBal = await a2Contract.balanceOf(user.address);
  let postCTokenBal = await cContract.balanceOf(user.address);

  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_AAVE,
      token.address,
      consts.T0.add(consts.SIX_MONTH),
      postATokenBal.sub(preATokenBal),
      user.address
    );
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_AAVE_V2,
      token.address,
      consts.T0_A2.add(consts.SIX_MONTH),
      postA2TokenBal.sub(preA2TokenBal),
      user.address
    );
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_COMPOUND,
      token.address,
      consts.T0_C.add(consts.SIX_MONTH),
      postCTokenBal.sub(preCTokenBal),
      user.address
    );
  return {
    ATokenMinted: postATokenBal.sub(preATokenBal),
    A2TokenMinted: postA2TokenBal.sub(preA2TokenBal),
    CTokenMinted: postCTokenBal.sub(preCTokenBal),
  };
}

export async function mint(token: Token, alice: Wallet, amount: BN) {
  await impersonateAccount(token.owner!);
  const signer = await provider.getSigner(token.owner!);

  const contractToken = new Contract(token.address, TetherToken.abi, signer);
  const tokenAmount = amountToWei(amount, token.decimal);
  await contractToken.issue(tokenAmount);
  await contractToken.transfer(alice.address, tokenAmount);
}

export async function convertToAaveToken(
  token: Token,
  alice: Wallet,
  amount: BN
) {
  const { lendingPool, lendingPoolCore } = await aaveFixture(alice);
  const tokenAmount = amountToWei(amount, token.decimal);

  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(lendingPoolCore.address, tokenAmount);

  await lendingPool.deposit(
    token.address,
    tokenAmount,
    0,
    consts.HIGH_GAS_OVERRIDE
  );
}

export async function convertToAaveV2Token(
  token: Token,
  alice: Wallet,
  amount: BN
) {
  const { lendingPool } = await aaveV2Fixture(alice);
  const tokenAmount = amountToWei(amount, token.decimal);

  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(lendingPool.address, tokenAmount);

  await lendingPool.deposit(token.address, tokenAmount, alice.address, 0);
}

export async function convertToCompoundToken(
  token: Token,
  alice: Wallet,
  amount: BN
) {
  const tokenAmount = amountToWei(amount, token.decimal);

  const cToken = new Contract(token.compound, CToken.abi, alice);
  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(cToken.address, tokenAmount);

  await cToken.mint(tokenAmount);
}

export async function mintAaveToken(
  token: Token,
  alice: Wallet,
  amount: BN,
  isAaveV1: boolean
) {
  await mint(token, alice, amount);
  if (isAaveV1) {
    await convertToAaveToken(token, alice, amount);
  } else {
    await convertToAaveV2Token(token, alice, amount);
  }
}

export async function mintCompoundToken(
  token: Token,
  alice: Wallet,
  amount: BN
) {
  await mint(token, alice, amount);
  await convertToCompoundToken(token, alice, amount);
}

export async function transferToken(
  token: Token,
  from: Wallet,
  to: string,
  amount: BN
) {
  const erc20 = new Contract(token.address, ERC20.abi, from);
  await erc20.transfer(to, amount);
}

export async function getAContract(
  alice: Wallet,
  aaveForge: Contract,
  token: Token
): Promise<Contract> {
  const aContractAddress = await aaveForge.callStatic.getYieldBearingToken(
    token.address
  );
  return new Contract(aContractAddress, ERC20.abi, alice);
}

export async function getA2Contract(
  alice: Wallet,
  aaveV2Forge: Contract,
  token: Token
): Promise<Contract> {
  const aContractAddress = await aaveV2Forge.callStatic.getYieldBearingToken(
    token.address
  );
  return new Contract(aContractAddress, ERC20.abi, alice);
}

export async function getCContract(
  alice: Wallet,
  token: Token
): Promise<Contract> {
  return new Contract(token.compound, CToken.abi, alice);
}

export async function getERC20Contract(
  alice: Wallet,
  token: Token
): Promise<Contract> {
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

export async function getLiquidityRate(
  alice: Wallet,
  token: Token
): Promise<BN> {
  const { lendingPool } = await aaveFixture(alice);
  const { liquidityRate } = await lendingPool.getReserveData(token.address);
  return liquidityRate;
}

export async function emptyToken(tokenContract: Contract, person: Wallet) {
  let bal: BN = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract
    .connect(person)
    .transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
  bal = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract
    .connect(person)
    .transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
}

export function getGain(amount: BN, rate: BN, duration: BN): BN {
  const precision = BN.from(10).pow(27);
  const rateForDuration = rate
    .mul(duration)
    .mul(amount)
    .div(consts.ONE_YEAR)
    .div(precision);

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
  if (typeof val === "number") {
    return BN.from(val).mul(PRECISION);
  }
  var pos: number = val.indexOf(".");
  if (pos == -1) {
    return BN.from(val).mul(PRECISION);
  }
  var lenFrac = val.length - pos - 1;
  val = val.replace(".", "");
  return BN.from(val).mul(PRECISION).div(BN.from(10).pow(lenFrac));
}

export function toFPWei(val: string | number): BN {
  return toFixedPoint(val).mul(1000000);
}

export function epochRelativeTime(params: liqParams, t: BN): BN {
  return t.sub(params.START_TIME).mod(params.EPOCH_DURATION);
}

export function epochOfTimestamp(params: liqParams, t: BN): BN {
  if (t.lt(params.START_TIME)) return BN.from(0);
  return t.sub(params.START_TIME).div(params.EPOCH_DURATION).add(BN.from(1));
}

export function startOfEpoch(params: liqParams, e: number): BN {
  return params.EPOCH_DURATION.mul(e - 1).add(params.START_TIME);
}

export function randomBN(range?: number): BN {
  if (range == undefined) range = 1e15;
  return BN.from(Math.floor(Math.random() * range));
}
