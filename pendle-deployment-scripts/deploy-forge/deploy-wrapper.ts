import { assert } from 'hardhat';
import { deployOrFetchContract, getContract, getOTAddrFromJoePool } from '../helpers';
import { DeployOrFetch, isEth, PendleEnv } from '../type';
import { PendleWrapper } from '../../typechain-types';
import { ApprovalStruct } from '../../typechain-types/PendleWrapper';
import { Erc20Token, LpToken } from '@pendle/constants';
import { getInfoJoePool, getInfoLiqOT, getInfoMarket, getInfoOTMarket } from '../storage';
import { doInfinityApproveWrapper } from '../admin';

export async function deployPendleWrapper(env: PendleEnv, runMode: DeployOrFetch) {
  if (isEth(env.network)) {
    assert(false, 'Cannot deploy Wrapper on ETH');
  } else {
    await deployPendleWrapperImplementation(env, runMode);
    await deployPendleWrapperProxy(env, runMode);
  }
}

export async function deployPendleWrapperImplementation(env: PendleEnv, runMode: DeployOrFetch) {
  env.pendleWrapperImplementation = (await deployOrFetchContract(
    env,
    runMode,
    'PendleWrapperImplementation',
    'PendleWrapper',
    [
      {
        pendleRouter: env.pendleRouter.address,
        joeRouter: env.consts.joe!.ROUTER,
        joeBar: env.tokens.XJOE!.address,
        weth: env.tokens.WNATIVE.address,
        wMEMO: env.tokens.wMEMO!.address,
        timeStaking: env.consts.wonderland!.TIME_STAKING,
        codeHashJoe: env.consts.joe!.CODE_HASH,
      },
    ]
  )) as PendleWrapper;
}

export async function deployPendleWrapperProxy(env: PendleEnv, runMode: DeployOrFetch) {
  let wrapperProxy = await deployOrFetchContract(env, runMode, 'PendleWrapper', 'TransparentUpgradeableProxy', [
    env.pendleWrapperImplementation.address,
    env.proxyAdmin.address,
    [],
  ]);

  // force the abi of implementation onto the proxy contract
  env.pendleWrapper = (await getContract('PendleWrapper', wrapperProxy.address)) as PendleWrapper;
}

export async function initialSetUpPendleWrapper(env: PendleEnv) {
  let arr: ApprovalStruct[] = [];
  arr = arr.concat(
    await supportNewQiToken(
      env,
      env.tokens.USDC,
      env.flat.POOL_YT_QIUSDC_28_DEC_2023_X_USDC,
      env.flat.LIQ_YT_QIUSDC_X_USDC,
      env.flat.LIQ_OT_QIUSDC_28_DEC_2023_X_USDC
    )
  );
  arr = arr.concat(
    await supportNewQiToken(
      env,
      env.tokens.NATIVE,
      env.flat.POOL_YT_QIAVAX_28_DEC_2023_X_USDC,
      env.flat.LIQ_YT_QIAVAX_X_USDC,
      env.flat.LIQ_OT_QIAVAX_28_DEC_2023_X_USDC
    )
  );
  arr = arr.concat(
    await supportXJoe(
      env,
      env.flat.POOL_YT_XJOE_30_JUN_2022_X_USDC,
      env.flat.LIQ_YT_XJOE_X_USDC,
      env.flat.LIQ_OT_XJOE_30_JUN_2022_X_USDC
    )
  );
  arr = arr.concat(
    await supportNewJoeSimpleToken(
      env,
      env.tokens.JOE_PENDLE_AVAX!,
      env.flat.POOL_YT_JLP_WAVAX_PENDLE_28_DEC_2023_X_PENDLE,
      env.flat.LIQ_YT_JLP_WAVAX_PENDLE_X_PENDLE,
      env.flat.LIQ_OT_JLP_WAVAX_PENDLE_28_DEC_2023_X_PENDLE
    )
  );
  arr = arr.concat(
    await supportWonderland(
      env,
      env.flat.POOL_YT_WMEMO_24_FEB_2022_X_MIM,
      env.flat.LIQ_YT_WMEMO_X_MIM,
      env.flat.LIQ_OT_WMEMO_24_FEB_2022_X_MIM
    )
  );
  await doInfinityApproveWrapper(env, arr);
  return arr;
}

export async function supportNewQiToken(
  env: PendleEnv,
  underlyingAsset: Erc20Token,
  YTMarketAddr: string,
  liqYTAddr: string,
  liqOTAddr: string
) {
  let arr: ApprovalStruct[] = [{ token: underlyingAsset.benqi!, to: env.pendleRouter.address }];
  if (underlyingAsset !== env.tokens.NATIVE) {
    arr = arr.concat([{ token: underlyingAsset.address, to: underlyingAsset.benqi! }]);
  }
  arr = arr.concat(await supportNewYoToken(env, YTMarketAddr, liqYTAddr, liqOTAddr));
  return arr;
}

export async function supportNewJoeSimpleToken(
  env: PendleEnv,
  lpToken: LpToken,
  YTMarketAddr: string,
  liqYTAddr: string,
  liqOTAddr: string
) {
  let joePool = await getInfoJoePool(lpToken.address);
  let arr: ApprovalStruct[] = [
    { token: joePool.token0.address, to: env.joeRouter.address },
    { token: joePool.token1.address, to: env.joeRouter.address },
    { token: joePool.address, to: env.pendleRouter.address },
  ];
  arr = arr.concat(await supportNewYoToken(env, YTMarketAddr, liqYTAddr, liqOTAddr));
  return arr;
}

export async function supportXJoe(env: PendleEnv, YTMarketAddr: string, liqYTAddr: string, liqOTAddr: string) {
  let arr: ApprovalStruct[] = [
    { token: env.tokens.JOE!.address, to: env.tokens.XJOE!.address },
    { token: env.tokens.XJOE!.address, to: env.pendleRouter.address },
  ];
  arr = arr.concat(await supportNewYoToken(env, YTMarketAddr, liqYTAddr, liqOTAddr));
  return arr;
}

export async function supportWonderland(env: PendleEnv, YTMarketAddr: string, liqYTAddr: string, liqOTAddr: string) {
  let arr: ApprovalStruct[] = [
    { token: env.tokens.TIME!.address, to: env.consts.wonderland!.TIME_STAKING },
    { token: env.tokens.MEMO!.address, to: env.tokens.wMEMO!.address },
    { token: env.tokens.wMEMO!.address, to: env.pendleRouter.address },
  ];
  arr = arr.concat(await supportNewYoToken(env, YTMarketAddr, liqYTAddr, liqOTAddr));
  return arr;
}

async function supportNewYoToken(env: PendleEnv, YTMarketAddr: string, liqYTAddr: string, liqOTAddr: string) {
  let liqOT = await getInfoLiqOT(liqOTAddr);
  let YTMarket = await getInfoMarket(env, YTMarketAddr);
  let OTMarket = await getInfoOTMarket(liqOT.stakeToken.address);
  let OT = await getOTAddrFromJoePool(env, OTMarket.address);

  let arr: ApprovalStruct[] = [
    { token: OT, to: env.consts.joe!.ROUTER },
    { token: OTMarket.baseToken.address, to: env.consts.joe!.ROUTER },
    { token: OTMarket.address, to: liqOT.address },
    { token: YTMarket.baseToken.address, to: env.pendleRouter.address },
    { token: YTMarket.address, to: liqYTAddr },
  ];
  return arr;
}
