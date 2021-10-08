import { assert } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { amountToWei, consts, impersonateAccount, impersonateAccountStop, Token, tokens, wrapEth } from '.';
import ERC20 from '../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json';
import IUniswapV2Router02 from '../../build/artifacts/contracts/interfaces/IUniswapV2Router02.sol/IUniswapV2Router02.json';
import TetherToken from '../../build/artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json';
import IWETH from '../../build/artifacts/contracts/interfaces/IWETH.sol/IWETH.json';
import ICEtherTest from '../../build/artifacts/contracts/mock/ICEtherTest.sol/ICEtherTest.json';
import ICTokenTest from '../../build/artifacts/contracts/mock/ICTokenTest.sol/ICTokenTest.json';
import { RouterFixture } from '../fixtures';
import { aaveV2Fixture } from '../fixtures/aaveV2.fixture';

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

export async function mintXytCompoundV2(
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
      consts.FORGE_COMPOUND_V2,
      token.address,
      expiry,
      postCTokenBal.sub(preCTokenBal),
      user.address,
      consts.HG
    );
  return postCTokenBal.sub(preCTokenBal);
}

export async function mintXytSushiswapComplexFixed(user: Wallet, env: RouterFixture, expiry: BN): Promise<BN> {
  let router = env.core.router;
  const scContract = await getERC20Contract(user, tokens.SUSHI_USDT_WETH_LP);
  let preTokenBal = await scContract.balanceOf(user.address);
  await mintSushiswapLpFixed(user);
  await scContract.approve(router.address, consts.INF);
  let postTokenBal = await scContract.balanceOf(user.address);
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_SUSHISWAP_COMPLEX,
      tokens.SUSHI_USDT_WETH_LP.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      consts.HG
    );
  return postTokenBal.sub(preTokenBal);
}

export async function mintXytSushiswapSimpleFixed(user: Wallet, env: RouterFixture, expiry: BN): Promise<BN> {
  let router = env.core.router;
  const ssContract = await getERC20Contract(user, tokens.SUSHI_USDT_WETH_LP);
  let preTokenBal = await ssContract.balanceOf(user.address);
  await mintSushiswapLpFixed(user);
  await ssContract.approve(router.address, consts.INF);
  let postTokenBal = await ssContract.balanceOf(user.address);
  await router
    .connect(user)
    .tokenizeYield(
      consts.FORGE_SUSHISWAP_SIMPLE,
      tokens.SUSHI_USDT_WETH_LP.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      consts.HG
    );
  return postTokenBal.sub(preTokenBal);
}

export async function mint(token: Token, alice: Wallet, amount: BN) {
  if (token == tokens.USDT) {
    await mintUSDT(alice, amount);
  } else if (token == tokens.UNI) {
    await mintUNI(alice, amount);
  } else if (token == tokens.WETH) {
    await mintWETH(alice, amount);
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
    const cToken = new Contract(token.compound!, ICEtherTest.abi, alice);
    let override: any = wrapEth(consts.HG, tokenAmount);
    await cToken.mint(override);
    return;
  }
  const cToken = new Contract(token.compound!, ICTokenTest.abi, alice);
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
    return new Contract(token.compound!, ICEtherTest.abi, alice);
  }
  return new Contract(token.compound!, ICTokenTest.abi, alice);
}

export async function getERC20Contract(alice: Wallet, token: Token): Promise<Contract> {
  return new Contract(token.address, ERC20.abi, alice);
}

export async function emptyToken(tokenContract: Contract, person: Wallet) {
  let bal: BN = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
  bal = await tokenContract.balanceOf(person.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(person).transfer(consts.DUMMY_GOVERNANCE_ADDRESS, bal);
}

async function mintUSDT(user: Wallet, amount: BN) {
  let USDT: Token = tokens.USDT;
  await provider.send('hardhat_setBalance', [USDT.owner, '0x1000000000000000000000000000']);
  await impersonateAccount(USDT.owner!);
  const signer = await provider.getSigner(USDT.owner!);
  const contractToken = new Contract(USDT.address, TetherToken.abi, signer);
  const tokenAmount = amountToWei(amount, USDT.decimal);
  await contractToken.issue(tokenAmount);
  await contractToken.transfer(user.address, tokenAmount);
}

async function mintUNI(user: Wallet, amount: BN) {
  amount = amountToWei(amount, tokens.UNI.decimal);
  let source: string = tokens.UNI.source!;
  await impersonateAccount(source);
  const signer = await provider.getSigner(source);
  const contractToken = new Contract(tokens.UNI.address, ERC20.abi, signer);
  let balanceOfSource: BN = await contractToken.balanceOf(source);
  assert(amount <= balanceOfSource, 'Total amount of UNI minted exceeds limit');
  await contractToken.transfer(user.address, amount);
  await impersonateAccountStop(source);
}

async function mintWETH(user: Wallet, amount: BN) {
  amount = amountToWei(amount, tokens.WETH.decimal);
  let WETH: Contract = new Contract(tokens.WETH.address, IWETH.abi, user);
  await user.sendTransaction({ to: WETH.address, value: amount });
}

export async function mintSushiswapLpFixed(user: Wallet) {
  let sushiRouter: Contract = new Contract(consts.SUSHISWAP_ROUTER_ADDRESS, IUniswapV2Router02.abi, user);
  let USDTErc20: Contract = await getERC20Contract(user, tokens.USDT);
  let WETHErc20: Contract = await getERC20Contract(user, tokens.WETH);

  const amountUSDT = BN.from(13000000);
  const amountWETH = BN.from(6100);
  await mint(tokens.USDT, user, amountUSDT);
  await mint(tokens.WETH, user, amountWETH);
  await USDTErc20.connect(user).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
  await WETHErc20.connect(user).approve(consts.SUSHISWAP_ROUTER_ADDRESS, 0, consts.HG);
  await USDTErc20.connect(user).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);
  await WETHErc20.connect(user).approve(consts.SUSHISWAP_ROUTER_ADDRESS, consts.INF, consts.HG);

  await sushiRouter.addLiquidity(
    tokens.USDT.address,
    tokens.WETH.address,
    amountToWei(amountUSDT, 6),
    amountToWei(amountWETH, 18),
    0,
    0,
    user.address,
    consts.INF,
    consts.HG
  );
}
