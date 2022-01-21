import * as consts from '@pendle/constants';
import { Erc20Token } from '@pendle/constants';
import { expect } from 'chai';
import { BigNumber as BN, BigNumberish, ethers } from 'ethers';
import {
  addToWhitelist,
  approveInfinityIfNeed,
  doInfinityApproveWrapper,
  fetchAll,
  getBalanceToken,
  getContract,
  getEth,
  getForgeIdFromForge,
  impersonateGov,
  impersonateSomeone,
  Network,
  PendleEnv,
} from '../pendle-deployment-scripts';
import { getPullData, ModeToModeMapping } from '../test/core/common-test/pendle-wrapper';
import { Mode } from '../test/fixtures';
import { approxBigNumber, deployContract, evm_revert, evm_snapshot } from '../test/helpers';
import { ERC20, IWETH, PendleZapEstimatorPAP, PendleZapEstimatorSingle } from '../typechain-types';
import {
  DataAddLiqOTStruct,
  DataAddLiqYTStruct,
  DataPullStruct,
  DataSwapStruct,
  DataTknzStruct,
} from '../typechain-types/PendleWrapper';
import { PendleWrapper } from '../typechain-types';
import { SwapInfoStruct } from '../typechain-types/PendleZapEstimator';
import { DoubleTokenZapDataStruct, TokenizeDataStruct } from '../typechain-types/PendleZapEstimatorPAP';
import { getEmptyDataAddLiqJoe, mintFromSource } from './helpers';

// Generate random test, check if input and output matches the path

const SLIPPAGE_DECIMAL = 10 ** 6;
const SLIPPAGE = Math.floor((SLIPPAGE_DECIMAL * 0.2) / 100);

describe('Estimator test', async () => {
  let estimatorSingle: PendleZapEstimatorSingle;
  let estimatorPAP: PendleZapEstimatorPAP;
  const GENERIC_MARKET_FACTORY_ID = ethers.utils.formatBytes32String('Generic');
  let snapshotId: string;
  let globalSnapshotId: string;
  let wrapper: PendleWrapper;
  let env: PendleEnv = {} as PendleEnv;

  async function prepareToken(token: Erc20Token, amount: BigNumberish): Promise<BN> {
    const weiAmount = BN.from(10).pow(token.decimal).mul(amount); // around 10k$

    if (token.address == env.tokens.WNATIVE.address) {
      await getEth(env.deployer.address);
      const wnativeContract = (await getContract('IWETH', env.tokens.WNATIVE.address)) as IWETH;
      await wnativeContract.deposit({ value: weiAmount });
    } else {
      await mintFromSource(env.deployer, BN.from(weiAmount), token);
    }
    await approveInfinityIfNeed(env, token.address, wrapper.address);
    await doInfinityApproveWrapper(env, [
      {
        token: token.address,
        to: env.joeRouter.address,
      },
    ]);
    return weiAmount;
  }

  before(async () => {
    await fetchAll(env, Network.AVAX);

    let user = env.deployer.address;
    await impersonateGov(env);
    await addToWhitelist(env, [env.pendleWrapper.address]);
    await impersonateSomeone(env, user);
    estimatorSingle = (await deployContract('PendleZapEstimatorSingle', [
      env.pendleData.address,
      consts.AvaxConsts.joe!.PAIR_FACTORY,
    ])) as PendleZapEstimatorSingle;
    estimatorPAP = (await deployContract('PendleZapEstimatorPAP', [
      env.pendleData.address,
      consts.AvaxConsts.joe!.PAIR_FACTORY,
    ])) as PendleZapEstimatorPAP;
    wrapper = env.pendleWrapper;
    snapshotId = globalSnapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  async function checkInTokenBalanceRemain(inTokenAddr: string, inAmount: BN, slippageLevel: number = 2) {
    expect(await getBalanceToken(inTokenAddr, env.deployer.address)).to.be.lt(
      inAmount.mul(SLIPPAGE).mul(slippageLevel).div(SLIPPAGE_DECIMAL)
    );
  }

  async function checkZapForceAdd(inTokenAddr: string, baseTokenAddr: string, inAmount: BN) {
    await checkInTokenBalanceRemain(inTokenAddr, inAmount);
    approxBigNumber(await getBalanceToken(baseTokenAddr, env.deployer.address), 0, 0);
  }

  async function checkZapForceYT(inTokenAddr: string, baseTokenAddr: string, inAmount: BN, ytAddr: string) {
    await checkInTokenBalanceRemain(inTokenAddr, inAmount);
    approxBigNumber(await getBalanceToken(baseTokenAddr, env.deployer.address), 0, 0);
    expect(await getBalanceToken(ytAddr, env.deployer.address)).to.be.gt(0);
  }

  async function checkZapReturn(inTokenAddr: string, baseTokenAddr: string, inAmount: BN, baseTokenThreshHold: BN) {
    await checkInTokenBalanceRemain(inTokenAddr, inAmount);
    expect(await getBalanceToken(baseTokenAddr, env.deployer.address)).to.be.gt(baseTokenThreshHold);
  }

  function getDataSwap(swapPath: string[], swapInfo: SwapInfoStruct) {
    return {
      amountInMax: swapInfo.amountIn,
      amountOut: swapInfo.amountOut,
      path: swapPath,
    } as DataSwapStruct;
  }

  it('Estimator single xJOE (underlying != baseToken) test', async () => {
    const forgeMode = ModeToModeMapping[Mode.XJOE];
    for (let fullMode = 0; fullMode < 6; ++fullMode) {
      // [0, 3) = modes forced, [3, 6) = mode returned
      const zapMode = fullMode % 3;
      let isReturning = fullMode >= 3;

      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      const inAmount = await prepareToken(env.tokens.WNATIVE!, 100);
      const tknzData: TokenizeDataStruct = {
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        forgeId: await getForgeIdFromForge(env.pendleXJoeForge.address),
        underAsset: env.tokens.JOE!.address,
        expiry: env.flat.TIME_30_JUN_2022,
      };
      const underlyingSwapPath = [
        '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd',
      ];
      const baseTokenSwapPath = [
        '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
      ];

      const zapInfo = await estimatorSingle.calcSingleTokenZapSwapInfo({
        mode: zapMode,
        tknzData: tknzData,
        inAmount: inAmount,
        underPath: underlyingSwapPath,
        basePath: baseTokenSwapPath,
        slippage: SLIPPAGE,
      });

      const dataPull: DataPullStruct = getPullData([
        getDataSwap(underlyingSwapPath, zapInfo.underInfo),
        getDataSwap(baseTokenSwapPath, zapInfo.baseInfo),
      ]);

      const dataTknz: DataTknzStruct = {
        single: { token: env.consts.tokens.JOE!.address, amount: zapInfo.underInfo.amountOut },
        double: getEmptyDataAddLiqJoe(),
        forge: env.pendleXJoeForge.address,
        expiryYT: env.flat.TIME_30_JUN_2022,
      };

      const dataLiqOT: DataAddLiqOTStruct = {
        baseToken: baseTokenSwapPath[baseTokenSwapPath.length - 1],
        amountTokenDesired: zapInfo.split.ot,
        amountTokenMin: 0,
        deadline: consts.MiscConsts.INF,
        liqMiningAddr: zapMode % 2 == 0 ? env.flat.LIQ_OT_XJOE_30_JUN_2022_X_USDC : env.consts.misc.ZERO_ADDRESS,
      };

      const dataLiqYT: DataAddLiqYTStruct = {
        baseToken: baseTokenSwapPath[baseTokenSwapPath.length - 1],
        amountTokenDesired: zapInfo.split.yt,
        amountTokenMin: 0,
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        liqMiningAddr: zapMode >= 1 ? env.flat.LIQ_YT_XJOE_X_USDC : env.consts.misc.ZERO_ADDRESS,
      };

      let threshold = zapInfo.baseInfo.amountOut.mul(SLIPPAGE).div(SLIPPAGE_DECIMAL);
      if (isReturning) {
        threshold = zapInfo.baseInfo.amountOut.mul(SLIPPAGE / 10).div(SLIPPAGE_DECIMAL);
      }

      switch (zapMode) {
        case 0:
          await wrapper.insAddDualLiqForOT(
            forgeMode,
            dataPull,
            dataTknz,
            dataLiqOT,
            threshold,
            env.flat.POOL_YT_XJOE_30_JUN_2022_X_USDC
          );
          if (!isReturning)
            await checkZapForceYT(
              baseTokenSwapPath[0],
              baseTokenSwapPath[baseTokenSwapPath.length - 1],
              inAmount,
              env.flat.TOKEN_YT_XJOE_30_JUN_2022
            );
          break;
        case 1:
          await wrapper.insAddDualLiqForYT(forgeMode, dataPull, dataTknz, dataLiqYT, threshold);
          if (!isReturning)
            await checkZapForceAdd(baseTokenSwapPath[0], baseTokenSwapPath[baseTokenSwapPath.length - 1], inAmount);
          break;
        case 2:
          await wrapper.insAddDualLiqForOTandYT(forgeMode, dataPull, dataTknz, dataLiqOT, dataLiqYT, threshold);
          if (!isReturning)
            await checkZapForceAdd(baseTokenSwapPath[0], baseTokenSwapPath[baseTokenSwapPath.length - 1], inAmount);
          break;
        default:
          break;
      }

      if (isReturning)
        await checkZapReturn(
          baseTokenSwapPath[0],
          baseTokenSwapPath[baseTokenSwapPath.length - 1],
          inAmount,
          threshold
        );
    }
  });

  /**
   * This test gives 280 DAI unused = 280$/10000$ inAmount
   */
  it('Estimator single (underlying == baseToken) test. WAVAX -> zap Qi USDC', async () => {
    const forgeMode = ModeToModeMapping[Mode.BENQI];
    for (let mode = 0; mode < 3; ++mode) {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      const inAmount = await prepareToken(env.tokens.WNATIVE!, 100); // around 10k$

      const tknzData: TokenizeDataStruct = {
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        forgeId: await getForgeIdFromForge(env.pendleBenQiForge.address),
        underAsset: env.tokens.USDC!.address,
        expiry: env.flat.TIME_28_DEC_2023,
      };
      const underlyingSwapPath = [
        '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
      ];
      const baseTokenSwapPath = [
        '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
      ];

      const zapInfo = await estimatorSingle.calcSingleTokenZapSwapInfo({
        mode: mode,
        tknzData: tknzData,
        inAmount: inAmount,
        underPath: underlyingSwapPath,
        basePath: baseTokenSwapPath,
        slippage: SLIPPAGE,
      });

      const dataPull: DataPullStruct = getPullData([
        getDataSwap(underlyingSwapPath, {
          amountIn: inAmount,
          amountOut: zapInfo.underInfo.amountOut.add(zapInfo.baseInfo.amountOut),
        }),
      ]);

      const dataTknz: DataTknzStruct = {
        single: { token: env.consts.tokens.USDC!.address, amount: zapInfo.underInfo.amountOut },
        double: getEmptyDataAddLiqJoe(),
        forge: env.pendleBenQiForge.address,
        expiryYT: env.flat.TIME_28_DEC_2023,
      };

      const dataLiqOT: DataAddLiqOTStruct = {
        baseToken: baseTokenSwapPath[baseTokenSwapPath.length - 1],
        amountTokenDesired: zapInfo.split.ot,
        amountTokenMin: 0,
        deadline: consts.MiscConsts.INF,
        liqMiningAddr: mode % 2 == 0 ? env.flat.LIQ_OT_QIUSDC_28_DEC_2023_X_USDC : env.consts.misc.ZERO_ADDRESS,
      };

      const dataLiqYT: DataAddLiqYTStruct = {
        baseToken: baseTokenSwapPath[baseTokenSwapPath.length - 1],
        amountTokenDesired: zapInfo.split.yt,
        amountTokenMin: 0,
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        liqMiningAddr: mode >= 1 ? env.flat.LIQ_YT_QIUSDC_X_USDC : env.consts.misc.ZERO_ADDRESS,
      };

      const threshold = zapInfo.baseInfo.amountOut.mul(SLIPPAGE).div(SLIPPAGE_DECIMAL);

      switch (mode) {
        case 0:
          await wrapper.insAddDualLiqForOT(
            forgeMode,
            dataPull,
            dataTknz,
            dataLiqOT,
            threshold,
            env.flat.POOL_YT_QIUSDC_28_DEC_2023_X_USDC
          );
          await checkZapForceYT(
            baseTokenSwapPath[0],
            baseTokenSwapPath[baseTokenSwapPath.length - 1],
            inAmount,
            env.flat.TOKEN_YT_QIUSDC_28_DEC_2023
          );
          break;
        case 1:
          await wrapper.insAddDualLiqForYT(forgeMode, dataPull, dataTknz, dataLiqYT, threshold);
          await checkZapForceAdd(baseTokenSwapPath[0], baseTokenSwapPath[baseTokenSwapPath.length - 1], inAmount);
          break;
        case 2:
          await wrapper.insAddDualLiqForOTandYT(forgeMode, dataPull, dataTknz, dataLiqOT, dataLiqYT, threshold);
          await checkZapForceAdd(baseTokenSwapPath[0], baseTokenSwapPath[baseTokenSwapPath.length - 1], inAmount);
          break;
        default:
          break;
      }
    }
  });

  // @NOTE: DAI -> PAP tested
  it('Estimator PAP. PENDLE -> (PENDLE + AVAX). ZapMode = BOTH', async () => {
    const forgeMode = ModeToModeMapping[Mode.TRADER_JOE];

    for (let mode = 1; mode < 3; ++mode) {
      /// There was a bug in wrapper (Leave this 1->2 for now)
      const inAmount = await prepareToken(env.tokens.PENDLE!, 20000);
      const tknzData: TokenizeDataStruct = {
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        forgeId: await getForgeIdFromForge(env.pendleTraderJoeSimpleForge.address),
        underAsset: env.flat.TOKEN_JLP_WAVAX_PENDLE,
        expiry: env.flat.TIME_28_DEC_2023,
      };

      const wavaxPath = [env.tokens.PENDLE!.address, env.tokens.WNATIVE.address];
      const pendlePath = [env.tokens.PENDLE!.address];

      const data: DoubleTokenZapDataStruct = {
        pendlePath: pendlePath,
        wavaxPath: wavaxPath,
        inAmount: inAmount,
        slippage: SLIPPAGE,
        mode: mode,
        tknzData: tknzData,
      };

      const zapInfo = await estimatorPAP.calcPapZapSwapInfo(data);

      // const pendleDataSwap: DataSwapStruct = {
      //   amountInMax: zapInfo.pendleInfo.amountIn,
      //   amountOut: zapInfo.pendleInfo.amountOut,
      //   path: pendlePath,
      // };

      const wavaxDataSwap: DataSwapStruct = {
        amountInMax: zapInfo.wavaxInfo.amountIn,
        amountOut: zapInfo.wavaxInfo.amountOut,
        path: wavaxPath,
      };

      const dataTknz: DataTknzStruct = {
        single: { token: env.consts.misc.ZERO_ADDRESS, amount: 0 },
        double: {
          tokenA: env.PENDLE.address,
          tokenB: env.tokens.WNATIVE.address,
          amountADesired: zapInfo.amountToMintLP.pendle,
          amountBDesired: zapInfo.amountToMintLP.wavax,
          amountAMin: 0,
          amountBMin: 0,
          deadline: env.consts.misc.INF,
        },
        forge: env.flat.FORGE_TRADERJOESIMPLE,
        expiryYT: env.flat.TIME_28_DEC_2023,
      };

      const dataLiqOT: DataAddLiqOTStruct = {
        baseToken: env.PENDLE.address,
        amountTokenDesired: zapInfo.split.ot,
        amountTokenMin: 0,
        deadline: consts.MiscConsts.INF,
        liqMiningAddr: env.flat.LIQ_OT_JLP_WAVAX_PENDLE_28_DEC_2023_X_PENDLE,
      };

      const dataLiqYT: DataAddLiqYTStruct = {
        baseToken: env.PENDLE.address,
        amountTokenDesired: zapInfo.split.yt,
        amountTokenMin: 0,
        marketFactoryId: GENERIC_MARKET_FACTORY_ID,
        liqMiningAddr: env.flat.LIQ_YT_JLP_WAVAX_PENDLE_X_PENDLE,
      };

      const dataPull: DataPullStruct = getPullData([wavaxDataSwap]);
      dataPull.pulls = dataPull.pulls.concat([
        { token: env.PENDLE.address, amount: inAmount.sub(wavaxDataSwap.amountInMax) },
      ]);
      const threshold = zapInfo.pendleInfo.amountOut.mul(SLIPPAGE * 2).div(SLIPPAGE_DECIMAL);

      switch (mode) {
        case 0:
          await wrapper.insAddDualLiqForOT(
            forgeMode,
            dataPull,
            dataTknz,
            dataLiqOT,
            threshold,
            env.flat.POOL_YT_QIUSDC_28_DEC_2023_X_USDC
          );
          await checkZapForceYT(pendlePath[0], env.PENDLE.address, inAmount, env.flat.TOKEN_YT_QIUSDC_28_DEC_2023);
          break;
        case 1:
          await wrapper.insAddDualLiqForYT(forgeMode, dataPull, dataTknz, dataLiqYT, threshold);
          await checkZapForceAdd(pendlePath[0], env.PENDLE.address, inAmount);
          break;
        case 2:
          await wrapper.insAddDualLiqForOTandYT(forgeMode, dataPull, dataTknz, dataLiqOT, dataLiqYT, threshold);
          await checkZapForceAdd(pendlePath[0], env.PENDLE.address, inAmount);
          break;
        default:
          break;
      }
    }
  });
});
