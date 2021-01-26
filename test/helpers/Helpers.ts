import { BigNumber, Contract, providers, Wallet } from "ethers";
import ERC20 from "../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import AToken from "../../build/artifacts/contracts/interfaces/IAToken.sol/IAToken.json";
import TetherToken from "../../build/artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json";
import { aaveFixture } from "../core/fixtures/aave.fixture";
import { consts, Token } from "./Constants";

const hre = require("hardhat");
const PRECISION = BigNumber.from(2).pow(40);

type MutyiplierMap = Record<string, BigNumber>;

export async function impersonateAccount(address: String) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
}

export async function evm_snapshot(): Promise<string> {
  return await hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
}

export async function evm_revert(snapshotId: string) {
  return await hre.network.provider.request({
    method: "evm_revert",
    params: [snapshotId],
  });
}

export async function mintOtAndXyt(
  provider: providers.Web3Provider,
  token: Token,
  wallet: Wallet,
  amount: BigNumber,
  pendle: Contract,
  pendleAaveForge: Contract
) {
  await mint(provider, token, wallet, amount);
  await mintAaveToken(token, wallet, amount);
  const { lendingPoolCore } = await aaveFixture(wallet);

  const aContract = await getAContract(wallet, lendingPoolCore, token);
  await aContract.approve(pendleAaveForge.address, consts.MAX_ALLOWANCE);
  await pendle.tokenizeYield(
    consts.FORGE_AAVE,
    token.address,
    consts.T0.add(consts.SIX_MONTH),
    amount,
    wallet.address
  );
}

export async function mint(
  provider: providers.Web3Provider,
  token: Token,
  wallet: Wallet,
  amount: BigNumber
) {
  await impersonateAccount(token.owner!);
  const signer = await provider.getSigner(token.owner!);

  const contractToken = new Contract(token.address, TetherToken.abi, signer);
  const tokenAmount = amountToWei(token, amount);
  await contractToken.issue(tokenAmount);
  await contractToken.transfer(wallet.address, tokenAmount);
}

export async function mintAaveToken(
  token: Token,
  wallet: Wallet,
  amount: BigNumber
) {
  const { lendingPool, lendingPoolCore } = await aaveFixture(wallet);
  const tokenAmount = amountToWei(token, amount);

  const erc20 = new Contract(token.address, ERC20.abi, wallet);
  await erc20.approve(lendingPoolCore.address, tokenAmount);

  await lendingPool.deposit(token.address, tokenAmount, 0);
}

export async function transferToken(
  token: Token,
  from: Wallet,
  to: string,
  amount: BigNumber
) {
  const erc20 = new Contract(token.address, ERC20.abi, from);
  await erc20.transfer(to, amount);
}
export async function getAContract(
  wallet: Wallet,
  lendingPoolCore: Contract,
  token: Token
): Promise<Contract> {
  const aTokenAddress = await lendingPoolCore.getReserveATokenAddress(
    token.address
  );
  return new Contract(aTokenAddress, ERC20.abi, wallet);
}

export async function getERC20Contract(
  wallet: Wallet,
  token: Token
): Promise<Contract> {
  return new Contract(token.address, AToken.abi, wallet);
}

export function amountToWei({ decimal }: Token, amount: BigNumber) {
  return BigNumber.from(10 ** decimal).mul(amount);
}

export async function advanceTime(
  provider: providers.Web3Provider,
  duration: BigNumber
) {
  provider.send("evm_increaseTime", [duration.toNumber()]);
  provider.send("evm_mine", []);
}

export async function setTimeNextBlock(
  provider: providers.Web3Provider,
  time: BigNumber
) {
  provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

export async function getLiquidityRate(
  wallet: Wallet,
  token: Token
): Promise<BigNumber> {
  const { lendingPool } = await aaveFixture(wallet);
  const { liquidityRate } = await lendingPool.getReserveData(token.address);
  return liquidityRate;
}

export function getGain(
  amount: BigNumber,
  rate: BigNumber,
  duration: BigNumber
): BigNumber {
  const precision = BigNumber.from(10).pow(27);
  const rateForDuration = rate
    .mul(duration)
    .mul(amount)
    .div(consts.ONE_YEAR)
    .div(precision);

  return rateForDuration;
}

export function approxBigNumber(
  val1: BigNumber,
  val2: BigNumber,
  delta: BigNumber
): boolean {
  var diff = val1.sub(val2);
  if (diff.lt(0)) {
    diff = diff.mul(-1);
  }
  console.log("diff", diff);
  return diff.lte(delta);
}

export function toFixedPoint(val: string | number): BigNumber {
  if (typeof val === "number") {
    return BigNumber.from(val).mul(PRECISION);
  }
  var pos: number = val.indexOf(".");
  if (pos == -1) {
    return BigNumber.from(val).mul(PRECISION);
  }
  var lenFrac = val.length - pos - 1;
  val = val.replace(".", "");
  return BigNumber.from(val)
    .mul(PRECISION)
    .div(BigNumber.from(10).pow(lenFrac));
}

export function toFPWei(val: string | number): BigNumber {
  return toFixedPoint(val).mul(1000000);
}
