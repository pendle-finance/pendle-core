import { assert } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { amountToWei, consts, impersonateAccount, impersonateAccountStop, Token, tokens, wrapEth } from '.';
import ERC20 from '../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import AToken from '../../build/artifacts/contracts/interfaces/IAToken.sol/IAToken.json';
import TetherToken from '../../build/artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json';
import ICTokenTest from '../../build/artifacts/contracts/mock/ICTokenTest.sol/ICTokenTest.json';
import ICEtherTest from '../../build/artifacts/contracts/mock/ICEtherTest.sol/ICEtherTest.json';
import { RouterFixture } from '../core/fixtures';
import { aaveV2Fixture } from '../core/fixtures/aaveV2.fixture';

const hre = require('hardhat');
const { waffle } = require('hardhat');
const { provider } = waffle;

export async function mintXytAave(token: Token, user: Wallet, amount: BN, env: RouterFixture, expiry: BN): Promise<BN> {
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
      consts.HG
    );
  return postA2TokenBal.sub(preA2TokenBal);
}

export async function mintXytCompound(
  token: Token,
  user: Wallet,
  amount: BN,
  env: RouterFixture,
  expiry: BN
): Promise<BN> {
  let router = env.core.router;
  const cContract = await getCContract(user, token);
  let preCTokenBal = await cContract.balanceOf(user.address);
  await mintCompoundToken(token, user, amount);
  await cContract.approve(router.address, consts.INF);
  let postCTokenBal = await cContract.balanceOf(user.address);
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_COMPOUND,
      token.address,
      expiry,
      postCTokenBal.sub(preCTokenBal),
      user.address,
      consts.HG
    );
  return postCTokenBal.sub(preCTokenBal);
}

export async function mint(token: Token, alice: Wallet, amount: BN) {
  if (token == tokens.USDT) {
    await mintUSDT(alice, amount);
  } else if (token == tokens.UNI) {
    await mintUNI(alice, amount);
  } else {
    assert(false, 'Token not supported');
  }
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
  if (token == tokens.WETH) {
    const cToken = new Contract(token.compound, ICEtherTest.abi, alice);
    let override: any = wrapEth(consts.HG, tokenAmount);
    await cToken.mint(override);
    return;
  }
  const cToken = new Contract(token.compound, ICTokenTest.abi, alice);
  const erc20 = new Contract(token.address, ERC20.abi, alice);
  await erc20.approve(cToken.address, tokenAmount);
  await cToken.mint(tokenAmount);
}

export async function mintAaveV2Token(token: Token, alice: Wallet, amount: BN) {
  await mint(token, alice, amount);
  await convertToAaveV2Token(token, alice, amount);
}

export async function mintCompoundToken(token: Token, alice: Wallet, amount: BN) {
  if (token != tokens.WETH) {
    await mint(token, alice, amount);
  }
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
  if (token == tokens.WETH) {
    return new Contract(token.compound, ICEtherTest.abi, alice);
  }
  return new Contract(token.compound, ICTokenTest.abi, alice);
}

export async function getERC20Contract(alice: Wallet, token: Token): Promise<Contract> {
  return new Contract(token.address, AToken.abi, alice);
}

export async function emptyToken(tokenContract: Contract, person: Wallet) {
  let bal: BN = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
  bal = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
}

async function mintUSDT(alice: Wallet, amount: BN) {
  let USDT: Token = tokens.USDT;
  await impersonateAccount(USDT.owner!);
  const signer = await provider.getSigner(USDT.owner!);
  const contractToken = new Contract(USDT.address, TetherToken.abi, signer);
  const tokenAmount = amountToWei(amount, USDT.decimal);
  await contractToken.issue(tokenAmount);
  await contractToken.transfer(alice.address, tokenAmount);
}

async function mintUNI(alice: Wallet, amount: BN) {
  amount = amountToWei(amount, tokens.UNI.decimal);
  let source: string = tokens.UNI.source!;
  await impersonateAccount(source);
  const signer = await provider.getSigner(source);
  const contractToken = new Contract(tokens.UNI.address, ERC20.abi, signer);
  let balanceOfSource: BN = await contractToken.balanceOf(source);
  assert(amount <= balanceOfSource, 'Total amount of UNI minted exceeds limit');
  await contractToken.transfer(alice.address, amount);
  await impersonateAccountStop(source);
}
