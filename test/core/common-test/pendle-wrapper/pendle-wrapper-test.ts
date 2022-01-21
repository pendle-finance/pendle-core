import { Erc20Token, MiscConsts, PendleConstsType, TokensConstsType } from '@pendle/constants';
import chai, { assert } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import {
  addToWhitelist,
  amountToWei,
  doInfinityApproveWrapper,
  getContract,
  getEth,
  setTimeNextBlock,
  weiToAmount,
} from '../../../../pendle-deployment-scripts';
import { marketFixture, Mode, parseTestEnvMarketFixture, TestEnv, wallets } from '../../../fixtures';
import {
  approve,
  approveAll,
  approxByPercent,
  createUniOrSushiPool,
  deployContract,
  emptyToken,
  evm_revert,
  evm_snapshot,
  liqParams,
  mint,
  teConsts,
  wrapEth,
} from '../../../helpers';
import {
  bootStrapMarkets,
  DataAddLiqOT,
  DataAddLiqYT,
  DataSwap,
  DataTknz,
  expectNonZeroBalUser,
  expectZeroBalUser,
  expectZeroBalWrapper,
  getDataTknzDouble,
  getDataTknzSingle,
  getPullData,
  isSingleData,
  manageApproval,
  ModeToModeMapping,
} from './helpers';

chai.use(solidity);

const { waffle } = require('hardhat');
const { provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, governance] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;

    let env: TestEnv = {} as TestEnv;
    let consts: PendleConstsType;
    let tokens: TokensConstsType;

    let initialUnderlyingBalance: BN;

    async function buildTestEnv() {
      env = await loadFixture(marketFixture);
      await parseTestEnvMarketFixture(env, mode);
      tokens = env.ptokens;
      consts = env.pconsts;
    }

    async function addInitialFunds() {
      for (const person of wallets) {
        if (isSingleData(env)) {
          if (mode == Mode.WONDERLAND) {
            await mint(env, env.ptokens.wMEMO!, person, BN.from(0));
            await env.wMEMOContract.connect(person).unwrap(await env.wMEMOContract.balanceOf(person.address));
            initialUnderlyingBalance = (await env.MEMOContract.balanceOf(bob.address)).div(10);
          } else {
            await mint(env, env.underlyingAsset, person, env.INITIAL_YIELD_TOKEN_AMOUNT);
            initialUnderlyingBalance = await (
              await getContract('ERC20', env.underlyingAsset.address)
            ).balanceOf(bob.address);
          }
        } else {
          for (const token of env.underlyingTokens) {
            let mintAmount = env.INITIAL_YIELD_TOKEN_AMOUNT;
            if (mode == Mode.TRADER_JOE) {
              mintAmount = BN.from(6000);
            }
            await mint(env, token, person, mintAmount);
          }
        }
      }
    }

    async function insTokenizeForCharlie(env: TestEnv, alwaysSingle: boolean) {
      let dataTknz: DataTknz;
      if (alwaysSingle || isSingleData(env)) {
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        dataTknz = getDataTknzDouble(env, false);
      }
      await env.pendleWrapper
        .connect(charlie)
        .insTokenize(ModeToModeMapping[env.mode], getPullData([], dataTknz), dataTknz, teConsts.HG);
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      if (isSingleData(env)) {
        await approveAll([env.underlyingAsset, env.TIMEContract], [env.pendleWrapper]);
      } else {
        await approveAll(env.underlyingTokens, [env.pendleWrapper]);
      }
      await approveAll([env.testToken], [env.pendleWrapper.address]);
      await addInitialFunds();
      await manageApproval(env);
      await bootStrapMarkets(env);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      await emptyToken(env, env.xyt, bob);
      await emptyToken(env, env.ot, bob);
      await emptyToken(env, env.market, bob);
      await emptyToken(env, env.ot, charlie);
      await emptyToken(env, env.xyt, charlie);
      snapshotId = await evm_snapshot();
    });

    it('insTokenize should give user YT & OT', async () => {
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken];
      let dataTknz: DataTknz;
      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }
      await env.pendleWrapper
        .connect(bob)
        .insTokenize(ModeToModeMapping[mode], getPullData([], dataTknz), dataTknz, teConsts.HG);
      await expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });
    //
    it('[ONLY WONDERLAND] insTokenize with TIME', async () => {
      if (mode != Mode.WONDERLAND) return;
      await mint(env, env.ptokens.TIME!, bob, BN.from(100));

      let dataTknz = getDataTknzSingle(env, BN.from(1));
      dataTknz.single = { token: env.ptokens.TIME!.address, amount: await env.TIMEContract.balanceOf(bob.address) };

      await env.pendleWrapper
        .connect(bob)
        .insTokenize(ModeToModeMapping[mode], getPullData([], dataTknz), dataTknz, teConsts.HG);
      await expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);
    });
    //
    it('[ONLY BENQI]insTokenize should work correctly even if SWAP TO AVAX is required', async () => {
      if (mode != Mode.BENQI) return;
      const preInitialUnderlyingBalance = initialUnderlyingBalance;

      env.ot = env.benQiOtAvax;
      env.xyt = env.benQiYtAvax;
      env.yToken = await getContract('ERC20', env.ptokens.NATIVE.benqi!);
      env.underlyingAsset = env.ptokens.NATIVE;
      initialUnderlyingBalance = amountToWei(1, env.ptokens.NATIVE.decimal);

      await manageApproval(env);
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken];

      tokensInvolved.push(env.underlyingAsset);

      // swap from DAI to AVAX
      let swapData: DataSwap[] = [
        {
          amountInMax: amountToWei(3000, env.ptokens.DAI!.decimal),
          amountOut: initialUnderlyingBalance,
          path: [env.ptokens.DAI!.address, env.ptokens.NATIVE.address],
        },
      ];
      let dataTknz: DataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      await env.pendleWrapper
        .connect(bob)
        .insTokenize(ModeToModeMapping[mode], getPullData(swapData), dataTknz, teConsts.HG);

      await expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);

      env.ot = env.benQiOtDAI;
      env.xyt = env.benQiYtDAI;
      env.yToken = await getContract('ERC20', env.ptokens.DAI!.benqi!);
      env.underlyingAsset = env.ptokens.DAI!;
      initialUnderlyingBalance = preInitialUnderlyingBalance;
    });

    it('[ONLY BENQI]insTokenize should work correctly even if WAVAX->AVAX swap is required', async () => {
      if (mode != Mode.BENQI) return;
      const preInitialUnderlyingBalance = initialUnderlyingBalance;

      env.ot = env.benQiOtAvax;
      env.xyt = env.benQiYtAvax;
      env.yToken = await getContract('ERC20', env.ptokens.NATIVE.benqi!);
      env.underlyingAsset = env.ptokens.NATIVE;
      initialUnderlyingBalance = amountToWei(1, env.ptokens.NATIVE.decimal);

      // ----------------------------------------------------------------
      await mint(env, env.ptokens.WNATIVE, bob, BN.from(1));
      await manageApproval(env);
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken];

      tokensInvolved.push(env.underlyingAsset);

      // swap from WAVAX to AVAX
      let swapData: DataSwap[] = [
        {
          amountInMax: initialUnderlyingBalance,
          amountOut: initialUnderlyingBalance,
          path: [env.ptokens.WNATIVE!.address, env.ptokens.NATIVE.address],
        },
      ];
      await approve(bob, [env.ptokens.WNATIVE], [env.pendleWrapper]);
      let dataTknz: DataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      await env.pendleWrapper
        .connect(bob)
        .insTokenize(ModeToModeMapping[mode], getPullData(swapData), dataTknz, teConsts.HG);

      await expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);

      // ----------------------------------------------------------------
      env.ot = env.benQiOtDAI;
      env.xyt = env.benQiYtDAI;
      env.yToken = await getContract('ERC20', env.ptokens.DAI!.benqi!);
      env.underlyingAsset = env.ptokens.DAI!;
      initialUnderlyingBalance = preInitialUnderlyingBalance;
    });

    //
    it('[ONLY BENQI]insTokenize should work correctly even if SWAP FROM AVAX is required', async () => {
      if (mode != Mode.BENQI) return;
      await emptyToken(env, env.DAIContract, bob);
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken];
      const AvaxAmount = amountToWei(4000, env.ptokens.NATIVE!.decimal);

      tokensInvolved.push(env.underlyingAsset);

      let swapData: DataSwap[] = [
        {
          amountInMax: AvaxAmount,
          amountOut: initialUnderlyingBalance,
          path: [env.ptokens.NATIVE!.address, env.ptokens.DAI!.address],
        },
      ];
      let dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      // console.log(JSON.stringify(getPullData(swapData, dataTknz), savedDataJSONreplacer));
      await env.pendleWrapper
        .connect(bob)
        .insTokenize(ModeToModeMapping[mode], getPullData(swapData), dataTknz, wrapEth(teConsts.HG, AvaxAmount));

      await expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });
    //
    it('[ONLY BENQI] insSwap from ERC20 to ERC20 should work correctly', async () => {
      if (mode != Mode.BENQI) return;
      await emptyToken(env, env.USDTContract, bob);
      await approve(bob, [env.ptokens.USDC], [env.pendleWrapper.address]);

      const inAmount = amountToWei(1, env.ptokens.USDC.decimal);

      await mint(env, env.ptokens.USDC, bob, weiToAmount(inAmount.mul(10), env.ptokens.USDC.decimal));

      // swap from USDC to USDT
      let swapData: DataSwap[] = [
        {
          amountInMax: inAmount.mul(2),
          amountOut: inAmount,
          path: [env.ptokens.USDC.address, env.ptokens.USDT.address],
        },
      ];

      await env.pendleWrapper.connect(bob).insSwap(getPullData(swapData));

      await expectNonZeroBalUser(env, bob, [env.ptokens.USDT]);
      await expectZeroBalWrapper(env, [env.ptokens.USDT, env.ptokens.USDC]);
    });
    // //
    it('insAddSingleLiq should give user OT and LP token', async () => {
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken, env.market];
      let marketFactoryID = consts.common.GENERIC_MARKET_FACTORY_ID;

      let dataTknz: DataTknz;
      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }

      tokensInvolved.concat(env.underlyingTokens);
      await env.pendleWrapper
        .connect(bob)
        .insAddSingleLiq(
          ModeToModeMapping[mode],
          getPullData([], dataTknz),
          dataTknz,
          marketFactoryID,
          env.testToken.address,
          BN.from(1),
          MiscConsts.ZERO_ADDRESS,
          teConsts.HG
        );
      await expectNonZeroBalUser(env, bob, [env.ot, env.market]);
      await expectZeroBalUser(env, bob, [env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });

    it('insRealizeFutureYield should give user OT and baseToken', async () => {
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken, env.testToken];
      await emptyToken(env, env.testToken, bob);
      let marketFactoryID = consts.common.GENERIC_MARKET_FACTORY_ID;

      let dataTknz: DataTknz;
      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }

      await env.pendleWrapper
        .connect(bob)
        .insRealizeFutureYield(
          ModeToModeMapping[mode],
          getPullData([], dataTknz),
          dataTknz,
          marketFactoryID,
          env.testToken.address,
          BN.from(0),
          teConsts.HG
        );

      await expectNonZeroBalUser(env, bob, [env.ot, env.testToken]);
      await expectZeroBalUser(env, bob, [env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });

    it('insAddDualLiqForYT should give user OT and LP token', async () => {
      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken, env.testToken, env.market];
      await insTokenizeForCharlie(env, false);
      const initialYTBalance = await env.xyt.balanceOf(charlie.address);

      let dataTknz: DataTknz;
      let dataAddLiqYt: DataAddLiqYT = {
        baseToken: env.testToken.address,
        amountTokenDesired: initialYTBalance.mul(2),
        amountTokenMin: BN.from(0),
        marketFactoryId: env.MARKET_FACTORY_ID,
        liqMiningAddr: MiscConsts.ZERO_ADDRESS,
      };

      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }

      await env.pendleWrapper
        .connect(bob)
        .insAddDualLiqForYT(
          ModeToModeMapping[mode],
          getPullData([], dataTknz, undefined, dataAddLiqYt),
          dataTknz,
          dataAddLiqYt,
          0,
          teConsts.HG
        );

      await expectNonZeroBalUser(env, bob, [env.ot, env.market]);
      await expectZeroBalUser(env, bob, [env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });

    it('insAddDualLiqForOT should give user YT and SLP', async () => {
      let baseTokenAddress = tokens.WNATIVE.address;
      let baseTokenFunding = BN.from(10000000);
      await mint(env, tokens.WNATIVE, bob, baseTokenFunding);

      const baseTokenContract = await getContract('ERC20', baseTokenAddress);
      await baseTokenContract.connect(bob).approve(env.pendleWrapper.address, MiscConsts.INF);

      const SLPAddress = await createUniOrSushiPool(env, env.ot.address, baseTokenAddress);
      const SLPContract = await getContract('IUniswapV2Pair', SLPAddress);

      const tokensInvolved: (Contract | Erc20Token)[] = [env.ot, env.xyt, env.yToken, baseTokenContract, SLPContract];

      await emptyToken(env, SLPContract, bob);

      await insTokenizeForCharlie(env, false);

      let dataTknz: DataTknz;
      let dataAddLiqOt: DataAddLiqOT = {
        baseToken: baseTokenAddress,
        amountTokenDesired: baseTokenFunding,
        amountTokenMin: BN.from(0),
        deadline: MiscConsts.INF,
        liqMiningAddr: MiscConsts.ZERO_ADDRESS,
      };
      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }

      await env.pendleWrapper
        .connect(bob)
        .insAddDualLiqForOT(
          ModeToModeMapping[mode],
          getPullData([], dataTknz, dataAddLiqOt),
          dataTknz,
          dataAddLiqOt,
          0,
          MiscConsts.ZERO_ADDRESS,
          teConsts.HG
        );

      await expectNonZeroBalUser(env, bob, [env.xyt, SLPContract]);
      await expectZeroBalUser(env, bob, [env.ot]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });

    it('insAddDualLiqForOTandYT should give user Pendle LP and SLP', async () => {
      let OTBaseTokenAddress = tokens.WNATIVE.address;
      let OTBaseTokenFunding = BN.from(10000000);

      await mint(env, tokens.WNATIVE, bob, OTBaseTokenFunding);

      const OTBaseTokenContract = await getContract('ERC20', OTBaseTokenAddress);
      await OTBaseTokenContract.connect(bob).approve(env.pendleWrapper.address, MiscConsts.INF);

      const SLPAddress = await createUniOrSushiPool(env, env.ot.address, OTBaseTokenAddress);
      const SLPContract = await getContract('IUniswapV2Pair', SLPAddress);

      await emptyToken(env, SLPContract, bob);

      const tokensInvolved: (Contract | Erc20Token)[] = [
        env.ot,
        env.xyt,
        env.yToken,
        env.testToken,
        OTBaseTokenContract,
        env.market,
      ];

      await insTokenizeForCharlie(env, false);
      const initialYTBalance = await env.xyt.balanceOf(charlie.address);

      let dataTknz: DataTknz;
      let dataAddLiqOt: DataAddLiqOT = {
        baseToken: OTBaseTokenAddress,
        amountTokenDesired: OTBaseTokenFunding,
        amountTokenMin: BN.from(0),
        deadline: MiscConsts.INF,
        liqMiningAddr: MiscConsts.ZERO_ADDRESS,
      };
      let dataAddLiqYt: DataAddLiqYT = {
        baseToken: env.testToken.address,
        amountTokenDesired: initialYTBalance.mul(2),
        amountTokenMin: BN.from(0),
        marketFactoryId: env.MARKET_FACTORY_ID,
        liqMiningAddr: MiscConsts.ZERO_ADDRESS,
      };
      if (isSingleData(env)) {
        tokensInvolved.push(env.underlyingAsset);
        dataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      } else {
        tokensInvolved.concat(env.underlyingTokens);
        dataTknz = getDataTknzDouble(env, false);
      }

      await env.pendleWrapper
        .connect(bob)
        .insAddDualLiqForOTandYT(
          ModeToModeMapping[mode],
          getPullData([], dataTknz, dataAddLiqOt, dataAddLiqYt),
          dataTknz,
          dataAddLiqOt,
          dataAddLiqYt,
          0,
          teConsts.HG
        );

      await expectNonZeroBalUser(env, bob, [SLPContract, env.market]);
      await expectZeroBalUser(env, bob, [env.ot, env.xyt]);
      await expectZeroBalWrapper(env, tokensInvolved);
    });
    //
    it('[ONLY TRADER_JOE] Wrapper should forward all ETH sent and send back remaining ETH, when adding ETH to Sushi pool', async () => {
      if (mode != Mode.TRADER_JOE) return;
      await getEth(bob.address);
      const lpPool = env.joePool.address;
      const poolEthBalanceBefore: BN = await env.WNativeContract.balanceOf(lpPool);
      const BobEthBalanceBefore: BN = await provider.getBalance(bob.address);
      let dataTknz = getDataTknzDouble(env, true);
      await env.pendleWrapper
        .connect(bob)
        .insTokenize(
          ModeToModeMapping[mode],
          getPullData([], dataTknz),
          dataTknz,
          wrapEth(teConsts.HG, amountToWei(BN.from(1000), tokens.WNATIVE.decimal))
        );

      expectNonZeroBalUser(env, bob, [env.ot, env.xyt]);

      const tokensInvolved = [env.ot, env.xyt, env.yToken, tokens.USDT, env.ptokens.NATIVE.address];
      await expectZeroBalWrapper(env, tokensInvolved);

      const poolEthBalanceAfter: BN = await env.WNativeContract.balanceOf(lpPool);
      const BobEthBalanceAfter: BN = await provider.getBalance(bob.address);

      approxByPercent(
        // Since there is also gas used
        poolEthBalanceBefore.add(BobEthBalanceBefore),
        poolEthBalanceAfter.add(BobEthBalanceAfter),
        1000000000
      );
    });
    //
    it('[ONLY XJOE] Wrapper should be able to add YT and OT lp to Liquidity Minings', async () => {
      // Currently this test will apply for xJOE only (using LiquidityMiningV2multi)
      if (mode != Mode.XJOE) return;
      const REF_AMOUNT = BN.from(10000000);

      const baseTokenOT = tokens.WNATIVE;
      await mint(env, baseTokenOT, bob, REF_AMOUNT);
      await mint(env, baseTokenOT, dave, REF_AMOUNT);
      await approveAll([env.WNativeContract], [env.pendleWrapper]);

      const otMarketAddress = await createUniOrSushiPool(env, env.ot.address, baseTokenOT.address);
      const otMarketContract = await getContract('IUniswapV2Pair', otMarketAddress);
      await emptyToken(env, otMarketContract, bob);

      await insTokenizeForCharlie(env, false);
      const initialTokenizeBalance = await env.xyt.balanceOf(charlie.address);

      await addToWhitelist(env.penv, [env.pendleWrapper.address]);

      // YT liquidity mining
      const liqYT: Contract = await deployContract('PendleGenericLiquidityMining', [
        env.govManager.address,
        env.pausingManagerLiqMining.address,
        env.whitelist.address,
        env.pendle.address,
        env.router.address,
        env.MARKET_FACTORY_ID,
        env.FORGE_ID,
        env.underlyingAsset.address,
        env.testToken.address,
        liqParams.START_TIME,
        liqParams.EPOCH_DURATION,
        liqParams.VESTING_EPOCHS,
      ]);

      // this liqOT only works for JoeLP
      const liqOT: Contract = await deployContract('PendleLiquidityMiningBaseV2Multi', [
        [
          env.govManager.address,
          env.pausingManagerLiqMiningV2.address,
          env.whitelist.address,
          [env.pendle.address, MiscConsts.ZERO_ADDRESS],
          otMarketAddress,
          [tokens.JOE!.address, tokens.WNATIVE.address],
          liqParams.START_TIME,
          liqParams.EPOCH_DURATION,
          liqParams.VESTING_EPOCHS,
          tokens.WNATIVE.address,
        ],
      ]);

      // After launching LM
      await approveAll([env.pendle], [liqOT, liqYT]);
      await liqYT.setAllocationSetting([env.EXPIRY], [liqParams.TOTAL_NUMERATOR], teConsts.HG);
      await liqYT.fund(liqParams.REWARDS_PER_EPOCH);
      await liqOT.fund(liqParams.REWARDS_PER_EPOCH2);
      await setTimeNextBlock(liqParams.START_TIME);

      // Wrapper approve for LMs
      await doInfinityApproveWrapper(env.penv, [
        { token: env.market.address, to: liqYT.address },
        { token: otMarketAddress, to: liqOT.address },
      ]);

      // Wrapper Test - Bob will add to LM while Dave will receive the LPs
      await emptyToken(env, env.market, dave);
      await emptyToken(env, otMarketContract, dave);

      let dataTknz: DataTknz = getDataTknzSingle(env, initialUnderlyingBalance);
      let dataAddLiqOt: DataAddLiqOT = {
        baseToken: baseTokenOT.address,
        amountTokenDesired: REF_AMOUNT,
        amountTokenMin: BN.from(0),
        deadline: MiscConsts.INF,
        liqMiningAddr: liqOT.address,
      };
      let dataAddLiqYt: DataAddLiqYT = {
        baseToken: env.testToken.address,
        amountTokenDesired: initialTokenizeBalance.mul(2),
        amountTokenMin: BN.from(0),
        marketFactoryId: env.MARKET_FACTORY_ID,
        liqMiningAddr: liqYT.address,
      };

      await env.pendleWrapper
        .connect(bob)
        .insAddDualLiqForOTandYT(
          ModeToModeMapping[mode],
          getPullData([], dataTknz, dataAddLiqOt, dataAddLiqYt),
          dataTknz,
          dataAddLiqOt,
          dataAddLiqYt,
          0,
          teConsts.HG
        );

      const bobOtLmBalance = await liqOT.balances(bob.address);
      const bobYtLmBalance = (await liqYT.readUserSpecificExpiryData(env.EXPIRY, bob.address)).balances;

      assert(bobOtLmBalance.gt(0));
      assert(bobYtLmBalance.gt(0));
      await expectZeroBalUser(env, bob, [otMarketContract, env.market, env.xyt, env.ot]);
    });
  });
}
