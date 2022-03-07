import { Erc20Token, LpToken } from '@pendle/constants';
import { BigNumber as BN } from 'ethers';
import { sendAndWaitForTransaction } from '../helpers';
import { getInfoYO, saveNewYieldContract } from '../index';
import { PendleEnv } from '../type/pendle-env';

export interface JoeComplexTokens {
  lpToken: LpToken;
  masterChef: string;
  rewardToken2: string;
  rewardToken3: string;
}

export async function registerNewJoeComplexTokens(env: PendleEnv, token: JoeComplexTokens) {
  await sendAndWaitForTransaction(env.pendleTraderJoeComplexForge.registerTokens, 'register new token for JoeComplex', [
    [token.lpToken.address],
    [[token.masterChef, token.lpToken.pid!, env.tokens.JOE!.address, token.rewardToken2, token.rewardToken3]],
  ]);
}

export async function registerNewBenQiTokens(env: PendleEnv, token: Erc20Token) {
  await sendAndWaitForTransaction(env.pendleBenQiForge.registerTokens, 'register new token for BenQi', [
    [token.address],
    [[token.benqi!, env.tokens.QI!.address, env.tokens.WNATIVE.address, env.consts.misc.ZERO_ADDRESS]],
  ]);
}

export async function registerNewJoeSimpleToken(env: PendleEnv, token: LpToken) {
  await sendAndWaitForTransaction(env.pendleTraderJoeSimpleForge.registerTokens, 'register new token for JoeSimple', [
    [token.address],
    [[token.address]],
  ]);
}

export async function registerNewWonderlandToken(env: PendleEnv) {
  await sendAndWaitForTransaction(
    env.pendleWonderlandForge.connect(env.deployer).registerTokens,
    'register new token for Wonderland',
    [[env.tokens.MEMO!.address], [[env.tokens.wMEMO!.address]]]
  );
}

export async function registerNewRedactedToken(env: PendleEnv) {
  await sendAndWaitForTransaction(
    env.pendleRedactedForge.connect(env.deployer).registerTokens,
    'register new token for Redacted',
    [[env.tokens.xBTRFLY!.address], [[env.tokens.wxBTRFLY!.address]]]
  );
}

export async function newYieldContracts(env: PendleEnv, forgeIdHex: string, underlyingAssetAddr: string, expiry: BN) {
  await sendAndWaitForTransaction(env.pendleRouter.newYieldContracts, 'newYieldContract', [
    forgeIdHex,
    underlyingAssetAddr,
    expiry,
  ]);

  const YTAddr: string = await env.pendleData.xytTokens(forgeIdHex, underlyingAssetAddr, expiry);
  const OTAddr: string = await env.pendleData.otTokens(forgeIdHex, underlyingAssetAddr, expiry);
  await saveNewYieldContract(env, forgeIdHex, OTAddr, YTAddr);

  return { YTAddr, OTAddr };
}
