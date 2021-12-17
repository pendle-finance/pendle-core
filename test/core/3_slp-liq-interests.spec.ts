import { MiscConsts } from '@pendle/constants';
import { loadFixture } from 'ethereum-waffle';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import {
  checkDisabled,
  liquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  wallets,
} from '../fixtures';
import {
  advanceTime,
  approveAll,
  approxBigNumber,
  approxByPercent,
  emptyToken,
  evm_revert,
  evm_snapshot,
  mineBlock,
  mintSushiswapLpFixed,
  mintTraderJoeLpFixed,
  randomBN,
  randomNumber,
  setTimeNextBlock,
  stake,
  teConsts,
  withdraw,
} from '../helpers';

export async function runTest(mode: Mode) {
  describe('', async () => {
    enum MasterChefMode {
      REWARD_BY_BLOCK,
      REWARD_BY_TIME,
    }

    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;
    let REF_AMOUNT = BN.from('1000000');
    let yieldTokens: Contract[];
    let currentYieldTokens: Contract;
    let rewardMode: MasterChefMode;

    async function buildTestEnv() {
      env = await loadFixture(liquidityMiningFixture);
      await parseTestEnvLiquidityMiningFixture(env, mode);
      if (mode == Mode.JLP_LIQ) {
        REF_AMOUNT = BN.from('10000000000');
      }

      if (mode == Mode.SLP_LIQ) {
        yieldTokens = [env.SUSHIContract];
        rewardMode = MasterChefMode.REWARD_BY_BLOCK;
      } else if (mode == Mode.JLP_LIQ) {
        yieldTokens = [env.JOEContract, env.WNativeContract];
        rewardMode = MasterChefMode.REWARD_BY_TIME;
      }
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    async function _stake(isToMasterChef: boolean, person: Wallet, amount: BN): Promise<void> {
      if (isToMasterChef) {
        if (mode == Mode.SLP_LIQ) {
          await env.MasterchefV1.connect(person).deposit(env.ptokens.SUSHI_USDT_WETH_LP!.pid, amount, teConsts.HG);
        } else if (mode == Mode.JLP_LIQ) {
          await env.joeMasterChefV2.connect(person).deposit(env.ptokens.JOE_WAVAX_DAI_LP!.pid, amount, teConsts.HG);
        }
      } else {
        await stake(env, person, amount);
      }
    }

    async function _redeemDueInterests(isToMasterChef: boolean, person: Wallet): Promise<void> {
      if (isToMasterChef) {
        if (mode == Mode.SLP_LIQ) {
          await env.MasterchefV1.connect(person).withdraw(env.ptokens.SUSHI_USDT_WETH_LP!.pid, 0, teConsts.HG);
        } else if (mode == Mode.JLP_LIQ) {
          await env.joeMasterChefV2.connect(person).withdraw(env.ptokens.JOE_WAVAX_DAI_LP!.pid, 0, teConsts.HG);
        }
      } else {
        await env.liq.redeemDueInterests(person.address, teConsts.HG);
      }
    }

    async function _withdraw(isToMasterChef: boolean, person: Wallet, amount: BN): Promise<void> {
      if (isToMasterChef) {
        if (mode == Mode.SLP_LIQ) {
          await env.MasterchefV1.connect(person).withdraw(env.ptokens.SUSHI_USDT_WETH_LP!.pid, amount, teConsts.HG);
        } else if (mode == Mode.JLP_LIQ) {
          await env.joeMasterChefV2.connect(person).withdraw(env.ptokens.JOE_WAVAX_DAI_LP!.pid, amount, teConsts.HG);
        }
      } else {
        await withdraw(env, person, amount);
      }
    }

    async function _yieldBalanceOf(user: Wallet): Promise<BN> {
      return await currentYieldTokens.balanceOf(user.address);
    }

    async function _revertAndInitializeTest(): Promise<void> {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
      await approveAll([env.yToken], [env.MasterchefV1, env.joeMasterChefV2, env.liq]);
      for (let person of wallets) {
        if (mode == Mode.SLP_LIQ) {
          await mintSushiswapLpFixed(env, person);
        } else if (mode == Mode.JLP_LIQ) {
          await mintTraderJoeLpFixed(env, person);
        }
      }
      await setTimeNextBlock(env.liqParams.START_TIME);
    }

    async function runYieldTokensTest(testFunction: any) {
      for (let i = 0; i < yieldTokens.length; ++i) {
        currentYieldTokens = yieldTokens[i];
        await _revertAndInitializeTest();

        for (let j = 0; j < wallets.length; ++j) {
          await emptyToken(env, currentYieldTokens, wallets[j]);
        }
        await testFunction();
      }
    }

    beforeEach(async () => {
      await _revertAndInitializeTest();
    });

    it('Simple test', async () => {
      await runYieldTokensTest(async () => {
        let balanceBefore: BN[] = [];
        let balanceAfter: BN[] = [];

        if (rewardMode == MasterChefMode.REWARD_BY_BLOCK) {
          for (let i = 0; i < wallets.length; ++i) {
            await _stake(true, wallets[i], REF_AMOUNT.mul(i + 1));
          }
          await mineBlock();
          await mineBlock();
          await mineBlock();
          await mineBlock();
          for (let i = 0; i < wallets.length; ++i) {
            await _withdraw(true, wallets[i], REF_AMOUNT.mul(i + 1));
            balanceBefore.push(await _yieldBalanceOf(wallets[i]));
          }
          for (let i = 0; i < wallets.length; ++i) {
            await _stake(false, wallets[i], REF_AMOUNT.mul(i + 1));
          }
          await mineBlock();
          await mineBlock();
          await mineBlock();
          await mineBlock();

          for (let person of wallets) {
            await _redeemDueInterests(false, person);
            balanceAfter.push(await _yieldBalanceOf(person));
          }

          for (let i = 0; i < wallets.length; ++i) {
            approxBigNumber(balanceAfter[i].div(2), balanceBefore[i], 10, true);
          }
        } else if (rewardMode == MasterChefMode.REWARD_BY_TIME) {
          // mine the LIQ_START_TIME block
          await mineBlock();

          let currentTime = env.liqParams.START_TIME;
          async function _advanceTime(delta: BN): Promise<void> {
            currentTime = currentTime.add(delta);
            await setTimeNextBlock(currentTime);
          }

          async function burnTime(delta: BN) {
            await _advanceTime(delta);
            await mineBlock();
          }

          const PERIOD = MiscConsts.ONE_HOUR;
          for (let i = 0; i < wallets.length; ++i) {
            await _advanceTime(PERIOD);
            await _stake(true, wallets[i], REF_AMOUNT.mul(i + 1));
          }
          await burnTime(PERIOD.mul(4));
          for (let i = 0; i < wallets.length; ++i) {
            await _advanceTime(PERIOD);
            await _withdraw(true, wallets[i], REF_AMOUNT.mul(i + 1));
            balanceBefore.push(await _yieldBalanceOf(wallets[i]));
          }
          for (let i = 0; i < wallets.length; ++i) {
            await _advanceTime(PERIOD);
            await _stake(false, wallets[i], REF_AMOUNT.mul(i + 1));
          }
          await burnTime(PERIOD.mul(4));
          for (let i = 0; i < wallets.length; ++i) {
            await _advanceTime(PERIOD);
            await _redeemDueInterests(false, wallets[i]);
            balanceAfter.push(await _yieldBalanceOf(wallets[i]));
          }
          for (let i = 0; i < wallets.length; ++i) {
            approxBigNumber(balanceAfter[i].div(2), balanceBefore[i], 10, true);
          }
        }
      });
    });

    it('Stress test', async () => {
      await runYieldTokensTest(async () => {
        let liqBalance: BN[] = [BN.from(0), BN.from(0), BN.from(0), BN.from(0)];
        let lpBalance: BN[] = [];
        for (let i = 0; i < 4; i++) lpBalance.push((await env.yToken.balanceOf(wallets[i].address)).div(10000));
        for (let i = 1; i <= 50; i++) {
          let userID = randomNumber(2);
          let smltID = userID + 2;
          let actionType: number = randomNumber(3);
          if (liqBalance[userID].eq(0)) {
            actionType = 0;
          }
          if (actionType == 0) {
            let amount = randomBN(lpBalance[userID]);
            await _stake(true, wallets[smltID], amount);
            await _stake(false, wallets[userID], amount);
            liqBalance[userID] = liqBalance[userID].add(amount);
            lpBalance[userID] = lpBalance[userID].sub(amount);
          } else if (actionType == 1) {
            let amount = randomBN(liqBalance[userID]);
            await _withdraw(true, wallets[smltID], amount);
            await _withdraw(false, wallets[userID], amount);
            liqBalance[userID] = liqBalance[userID].sub(amount);
            lpBalance[userID] = lpBalance[userID].add(amount);
          } else {
            if (rewardMode == MasterChefMode.REWARD_BY_BLOCK) await mineBlock();
            else if (rewardMode == MasterChefMode.REWARD_BY_TIME) {
              await advanceTime(MiscConsts.ONE_DAY);
            }
          }
        }

        for (let i = 0; i < 2; i++) {
          await _redeemDueInterests(true, wallets[i + 2]);
          await _redeemDueInterests(false, wallets[i]);

          approxByPercent(await _yieldBalanceOf(wallets[i]), await _yieldBalanceOf(wallets[i + 2]), BN.from(10000));
        }
      });
    });
  });
}

describe('SLP-liquidity-mining-interests', function () {
  if (checkDisabled(Mode.SLP_LIQ)) return;
  runTest(Mode.SLP_LIQ);
});

describe('JLP-liquidity-mining-interests', function () {
  if (checkDisabled(Mode.JLP_LIQ)) return;
  runTest(Mode.JLP_LIQ);
});
