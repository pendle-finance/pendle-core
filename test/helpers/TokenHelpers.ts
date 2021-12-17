import { assert } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import hre from 'hardhat';
import { getEth, impersonateAccount, impersonateAccountStop, teConsts, wrapEth } from '.';
import { Mode, TestEnv, wallets } from '../fixtures';
import { Erc20Token, MiscConsts } from '@pendle/constants';
import { amountToWei, getContract, mintFromSource } from '../../pendle-deployment-scripts';

export async function mintXytAave(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN, expiry: BN): Promise<BN> {
  const a2Contract = await getA2Token(env, token);
  let preA2TokenBal = await a2Contract.balanceOf(user.address);
  await mintAaveV2Token(env, token, user, amount);
  await approveAll([a2Contract], [env.router]);
  let postA2TokenBal = await a2Contract.balanceOf(user.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.aave!.FORGE_ID,
      token.address,
      expiry,
      postA2TokenBal.sub(preA2TokenBal),
      user.address,
      teConsts.HG
    );
  return postA2TokenBal.sub(preA2TokenBal);
}

export async function mintXytCompound(
  env: TestEnv,
  mode: Mode,
  token: Erc20Token,
  user: Wallet,
  amount: BN,
  expiry: BN
): Promise<BN> {
  const cContract = await getCContract(env, token);
  let preCTokenBal = await cContract.balanceOf(user.address);
  await mintCompoundToken(env, token, user, amount);
  await approveAll([cContract], [env.router]);
  let postCTokenBal = await cContract.balanceOf(user.address);
  let forgeId = mode == Mode.COMPOUND ? env.pconsts.compound!.FORGE_ID_V1 : env.pconsts.compound!.FORGE_ID_V2;
  await env.router
    .connect(user)
    .tokenizeYield(forgeId, token.address, expiry, postCTokenBal.sub(preCTokenBal), user.address, teConsts.HG);
  return postCTokenBal.sub(preCTokenBal);
}

export async function mintXytBenQi(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN, expiry: BN): Promise<BN> {
  let qiContract = await getQiContract(token);
  let preQiTokenBal = await qiContract.balanceOf(user.address);
  await mintQiToken(env, token, user, amount);
  await approveAll([qiContract], [env.router]);
  let postQiTokenBal = await qiContract.balanceOf(user.address);

  let forgeId = env.pconsts.benqi!.FORGE_ID;
  await env.router
    .connect(user)
    .tokenizeYield(forgeId, token.address, expiry, postQiTokenBal.sub(preQiTokenBal), user.address, teConsts.HG);

  return postQiTokenBal.sub(preQiTokenBal);
}

export async function mintXytSushiswapFixed(env: TestEnv, mode: Mode, user: Wallet, expiry: BN) {
  let preTokenBal: BN = await env.sushiPool.balanceOf(user.address);
  await mintSushiswapLpFixed(env, user);
  await approveAll([env.sushiPool], [env.router]);
  let postTokenBal: BN = await env.sushiPool.balanceOf(user.address);
  let forgeId =
    mode == Mode.SUSHISWAP_SIMPLE ? env.pconsts.sushi!.FORGE_ID_SIMPLE : env.pconsts.sushi!.FORGE_ID_COMPLEX;

  await env.router
    .connect(user)
    .tokenizeYield(forgeId, env.sushiPool.address, expiry, postTokenBal.sub(preTokenBal), user.address, teConsts.HG);
  return postTokenBal.sub(preTokenBal);
}

export async function mintXytUniswapFixed(env: TestEnv, user: Wallet, expiry: BN): Promise<BN> {
  let preTokenBal = await env.uniPool.balanceOf(user.address);
  await mintUniswapLpFixed(env, user);
  await approveAll([env.uniPool], [env.router]);
  let postTokenBal = await env.uniPool.balanceOf(user.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.uni!.FORGE_ID,
      env.ptokens.UNI_USDT_WETH_LP!.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      teConsts.HG
    );
  return postTokenBal.sub(preTokenBal);
}

export async function mintXytTraderJoeFixed(env: TestEnv, user: Wallet, expiry: BN): Promise<BN> {
  const joeContract = env.joePool;
  let preTokenBal = await joeContract.balanceOf(user.address);
  await mintTraderJoeLpFixed(env, user);
  await approveAll([joeContract], [env.router]);
  let postTokenBal = await joeContract.balanceOf(user.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.joe!.FORGE_ID_COMPLEX,
      env.ptokens.JOE_WAVAX_DAI_LP!.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      teConsts.HG
    );
  return postTokenBal.sub(preTokenBal);
}
export async function mintXytKyberDMMFixed(env: TestEnv, user: Wallet, expiry: BN): Promise<BN> {
  let kContract = await getContract('ERC20', env.ptokens.KYBER_USDT_WETH_LP!);
  let preTokenBal = await kContract.balanceOf(user.address);
  await mintKyberDMMFixed(env, user);

  await approveAll([kContract], [env.router]);
  let postTokenBal = await kContract.balanceOf(user.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.kyber!.FORGE_ID,
      env.ptokens.KYBER_USDT_WETH_LP!.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      teConsts.HG
    );
  return postTokenBal.sub(preTokenBal);
}

export async function mintXytXJoeFixed(env: TestEnv, user: Wallet, expiry: BN): Promise<BN> {
  let preTokenBal = await env.xJoe.balanceOf(user.address);
  await mintXJoe(env, env.xJoe, user, teConsts.INITIAL_xJOE_AMOUNT);
  let postTokenBal = await env.xJoe.balanceOf(user.address);
  await approveAll([env.xJoe], [env.router]);

  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.joe!.FORGE_ID_XJOE,
      env.ptokens.JOE!.address,
      expiry,
      postTokenBal.sub(preTokenBal),
      user.address,
      teConsts.HG
    );
  return postTokenBal.sub(preTokenBal);
}

export async function mintXytWMEMOFixed(env: TestEnv, user: Wallet, expiry: BN) {
  await mintFixedWMEMO(env, user);
  await approveAll([env.wMEMOContract], [env.router]);

  await env.router
    .connect(user)
    .tokenizeYield(
      env.pconsts.wonderland!.FORGE_ID,
      env.ptokens.MEMO!.address,
      expiry,
      await env.wMEMOContract.balanceOf(user.address),
      user.address,
      teConsts.HG
    );
}

export async function mint(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  switch (token) {
    case env.ptokens.USDT!:
      await mintUSDT(env, user, amount);
      break;
    case env.ptokens.DAI!:
      await mintDAI(env, user, amount);
      break;
    case env.ptokens.WNATIVE!:
      await mintWETH(env, user, amount);
      break;
    case env.ptokens.USDC!:
      await mintUSDC(env, user, amount);
      break;
    case env.ptokens.JOE!:
      await mintJOE(env, user, amount);
      break;
    case env.ptokens.TIME!:
      await mintTIME(env, user, amount);
      break;
    case env.ptokens.wMEMO!:
      await mintFixedWMEMO(env, user);
      break;
    default:
      assert(false, 'Token not supported');
      break;
  }
}

export async function convertToAaveV2Token(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  const tokenAmount = amountToWei(amount, token.decimal);
  await env.aaveLendingPool.connect(user).deposit(token.address, tokenAmount, user.address, 0);
}

export async function convertToCompoundToken(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  const tokenAmount = amountToWei(amount, token.decimal);
  if (token == env.ptokens.WNATIVE!) {
    const cToken = await getContract('ICEtherTest', token.compound!);
    let override: any = wrapEth(teConsts.HG, tokenAmount);
    await cToken.connect(user).mint(override);
    return;
  }
  const cToken = await getContract('ICTokenTest', token.compound!);
  await approve(user, [token], [cToken]);
  await cToken.connect(user).mint(tokenAmount);
}

export async function convertToBenqiToken(token: Erc20Token, user: Wallet, amount: BN) {
  const tokenAmount = amountToWei(amount, token.decimal);
  const qiToken = await getContract('ICTokenTest', token.benqi!);
  await approve(user, [token], [qiToken]);
  await qiToken.connect(user).mint(tokenAmount);
}

export async function mintAaveV2Token(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  await mint(env, token, user, amount);
  await convertToAaveV2Token(env, token, user, amount);
}

export async function mintCompoundToken(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  if (token != env.ptokens.WNATIVE!) {
    await mint(env, token, user, amount);
  }
  await convertToCompoundToken(env, token, user, amount);
}

export async function mintQiToken(env: TestEnv, token: Erc20Token, user: Wallet, amount: BN) {
  await mint(env, token, user, amount);
  await convertToBenqiToken(token, user, amount);
}

export async function mintXJoe(env: TestEnv, xJoe: Contract, user: Wallet, amount: BN) {
  await mint(env, env.ptokens.JOE!, user, amount);
  await xJoe.connect(user).enter(amountToWei(amount, env.ptokens.JOE!.decimal));
}

export async function transferToken(token: Erc20Token, from: Wallet, to: string, amount: BN) {
  const erc20 = await getContract('ERC20', token.address);
  await erc20.transfer(to, amount);
}

export async function getA2Token(env: TestEnv, token: Erc20Token): Promise<Contract> {
  const aContractAddress = await env.a2Forge.callStatic.getYieldBearingToken(token.address);
  return await getContract('ERC20', aContractAddress);
}

export async function getCContract(env: TestEnv, token: Erc20Token): Promise<Contract> {
  if (token == env.ptokens.WNATIVE!) {
    return await getContract('ICEtherTest', token.compound!);
  }
  return await getContract('ICTokenTest', token.compound!);
}

export async function getQiContract(token: Erc20Token): Promise<Contract> {
  return await getContract('ICTokenTest', token.benqi!);
}

export async function emptyToken(env: TestEnv, tokenContract: Contract, user: Wallet) {
  let bal: BN = await tokenContract.balanceOf(user.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(user).transfer(MiscConsts.DUMMY_ADDRESS, bal);
  bal = await tokenContract.balanceOf(user.address);
  if (bal.eq(0)) return;
  await tokenContract.connect(user).transfer(MiscConsts.DUMMY_ADDRESS, bal);
}

async function mintUSDT(env: TestEnv, user: Wallet, amount: BN) {
  let USDT: Erc20Token = env.ptokens.USDT!;
  await impersonateAccount(MiscConsts.USDT_OWNER_ON_ETH);
  const signer = await hre.ethers.getSigner(MiscConsts.USDT_OWNER_ON_ETH);
  const contractToken = await getContract('IUSDT', USDT.address);
  const tokenAmount = amountToWei(amount, USDT.decimal);
  await contractToken.connect(signer).issue(tokenAmount);
  await contractToken.connect(signer).transfer(user.address, tokenAmount);
  await impersonateAccountStop(MiscConsts.USDT_OWNER_ON_ETH);
}

async function mintDAI(env: TestEnv, user: Wallet, amount: BN) {
  await mintFromSource(user, amount, env.ptokens.DAI!);
}

async function mintJOE(env: TestEnv, user: Wallet, amount: BN) {
  await mintFromSource(user, amount, env.ptokens.JOE!);
}

async function mintWETH(env: TestEnv, user: Wallet, amount: BN) {
  await getEth(user.address);
  amount = amountToWei(amount, env.ptokens.WNATIVE!.decimal);
  let WETH: Contract = await getContract('IWETH', env.ptokens.WNATIVE!.address);
  await user.sendTransaction({ to: WETH.address, value: amount });
}

async function mintUSDC(env: TestEnv, user: Wallet, amount: BN) {
  await mintFromSource(user, amount, env.ptokens.USDC!);
}

async function mintTIME(env: TestEnv, user: Wallet, amount: BN) {
  await mintFromSource(user, amount, env.ptokens.TIME!);
}

async function mintFixedWMEMO(env: TestEnv, user: Wallet) {
  await mintTIME(env, user, BN.from(1000));
  await env.wonderlandTimeStaking.connect(user).stake(await env.TIMEContract.balanceOf(user.address), user.address);
  await env.wonderlandTimeStaking.connect(user).claim(user.address);
  await env.wMEMOContract.connect(user).wrap(await env.MEMOContract.balanceOf(user.address));
  // Burn so that it remains the same amount every time
  await env.wMEMOContract
    .connect(user)
    .transfer(
      env.wMEMOContract.address,
      (await env.wMEMOContract.balanceOf(user.address)).sub(teConsts.INITIAL_wMEMO_TOKEN_AMOUNT)
    );
}

export async function mintSushiswapLpFixed(env: TestEnv, user: Wallet) {
  const amountUSDT = BN.from(13000000);
  const amountWETH = BN.from(6100);
  await mint(env, env.ptokens.USDT!, user, amountUSDT);
  await mint(env, env.ptokens.WNATIVE!, user, amountWETH);

  await env.sushiRouter
    .connect(user)
    .addLiquidity(
      env.ptokens.USDT!.address,
      env.ptokens.WNATIVE!.address,
      amountToWei(amountUSDT, 6),
      amountToWei(amountWETH, 18),
      0,
      0,
      user.address,
      MiscConsts.INF,
      teConsts.HG
    );
}

export async function mintUniswapLpFixed(env: TestEnv, user: Wallet) {
  const amountUSDT = BN.from(13000000);
  const amountWETH = BN.from(6100);
  await mint(env, env.ptokens.USDT!, user, amountUSDT);
  await mint(env, env.ptokens.WNATIVE!, user, amountWETH);

  await env.uniRouter
    .connect(user)
    .addLiquidity(
      env.ptokens.USDT!.address,
      env.ptokens.WNATIVE!.address,
      amountToWei(amountUSDT, 6),
      amountToWei(amountWETH, 18),
      0,
      0,
      user.address,
      MiscConsts.INF,
      teConsts.HG
    );
}

export async function mintTraderJoeLpFixed(env: TestEnv, user: Wallet) {
  const amountDAI = BN.from(6600);
  const amountWAVAX = BN.from(100);

  await mint(env, env.ptokens.DAI!, user, amountDAI);
  await mint(env, env.ptokens.WNATIVE!, user, amountWAVAX);

  await env.joeRouter
    .connect(user)
    .addLiquidity(
      env.ptokens.DAI!.address,
      env.ptokens.WNATIVE!.address,
      amountToWei(amountDAI, 18),
      amountToWei(amountWAVAX, 18),
      0,
      0,
      user.address,
      MiscConsts.INF,
      teConsts.HG
    );
}

export async function mintKyberDMMFixed(env: TestEnv, user: Wallet) {
  const amountUSDT = BN.from(13000000);
  const amountWETH = BN.from(6100);
  await mint(env, env.ptokens.USDT!, user, amountUSDT);
  await mint(env, env.ptokens.WNATIVE!, user, amountWETH);
  await env.kyberRouter.addLiquidity(
    env.ptokens.WNATIVE!.address,
    env.ptokens.USDT!.address,
    env.ptokens.KYBER_USDT_WETH_LP!.address,
    amountToWei(amountUSDT, 6),
    amountToWei(amountWETH, 18),
    0,
    0,
    [0, MiscConsts.INF],
    user.address,
    MiscConsts.INF,
    teConsts.HG
  );
}

export async function approve(user: Wallet, _tokens: (string | Contract | Erc20Token)[], _tos: (string | Contract)[]) {
  let tokens: Contract[] = [];
  let tos: string[] = [];

  for (let it of _tokens) {
    if (typeof it == 'string') tokens.push!(await getContract('ERC20', it));
    else tokens.push!(await getContract('ERC20', it.address));
  }
  for (let it of _tos) {
    if (!it) continue;
    tos.push(typeof it == 'string' ? it : it.address);
  }

  for (let token of tokens) {
    for (let to of tos) {
      await token.connect(user).approve(to, 0, teConsts.HG);
      await token.connect(user).approve(to, MiscConsts.INF, teConsts.HG);
    }
  }
}

export async function approveAll(_tokens: (string | Contract | Erc20Token)[], _tos: (string | Contract)[]) {
  for (let person of wallets) {
    await approve(person, _tokens, _tos);
  }
}
