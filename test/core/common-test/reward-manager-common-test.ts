import chai, { expect } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { Mode, parseTestEnvRouterFixture, routerFixture, TestEnv, wallets } from '../../fixtures';
import {
  advanceTime,
  advanceTimeAndBlock,
  approveAll,
  approxBigNumber,
  emptyToken,
  errMsg,
  evm_revert,
  evm_snapshot,
  mineAllPendingTransactions,
  mineBlock,
  minerStart,
  minerStop,
  redeemAfterExpiry,
  redeemOtRewards,
  redeemRewardsFromProtocol,
  redeemUnderlying,
  setTimeNextBlock,
  teConsts,
  tokenizeYield,
} from '../../helpers';
import { MiscConsts } from '@pendle/constants';
import { getContract } from '../../../pendle-deployment-scripts';

chai.use(solidity);

export function runTest(mode: Mode) {
  describe('', async () => {
    const [alice, bob, charlie, dave, eve] = wallets;
    let snapshotId: string;
    let globalSnapshotId: string;
    let env: TestEnv = {} as TestEnv;

    let rewardTokens: Contract[];
    let rewardToken: Contract;
    let yieldTokenHolder: string;
    let tokenToStake: string;

    let userInitialYieldToken: BN;
    let lowGasSetting = teConsts.LG;

    let trioTokens: any;
    let usingMultiReward: boolean = false;

    async function buildTestEnv() {
      env = await loadFixture(routerFixture);
      await parseTestEnvRouterFixture(env, mode);
      env.TEST_DELTA = BN.from(1500000);

      if (mode == Mode.SUSHISWAP_COMPLEX || mode == Mode.BENQI || mode == Mode.TRADER_JOE || mode == Mode.XJOE) {
        tokenToStake = env.underlyingAsset.address;
      } else {
        tokenToStake = env.USDTContract.address;
      }

      rewardTokens = [await getContract('TestToken', await env.forge.rewardToken())];

      if (mode == Mode.BENQI || mode == Mode.TRADER_JOE || mode == Mode.XJOE) {
        usingMultiReward = true;
        lowGasSetting.gasLimit = 300000;

        trioTokens = await env.rewardManager.rewardTokensForAsset(tokenToStake);
        rewardTokens = [];
        for (let tokenAddress of [trioTokens.tokenA, trioTokens.tokenB, trioTokens.tokenC]) {
          if (tokenAddress != MiscConsts.ZERO_ADDRESS) {
            rewardTokens.push(await getContract('TestToken', tokenAddress));
          }
        }
      }
    }

    before(async () => {
      await buildTestEnv();
      globalSnapshotId = await evm_snapshot();
      userInitialYieldToken = (await env.yToken.balanceOf(alice.address)).div(4);
      yieldTokenHolder = await env.forge.yieldTokenHolders(tokenToStake, env.EXPIRY);

      await minerStop();
      await approveAll([env.yToken], [env.router]);
      for (const person of [bob, charlie, dave]) {
        await env.yToken.transfer(person.address, userInitialYieldToken);
      }
      await redeemRewardsFromProtocol(env, [bob, charlie, dave]);
      await mineAllPendingTransactions();
      await minerStart();

      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    async function revertBlockchain(): Promise<void> {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    }

    beforeEach(async () => {
      await revertBlockchain();
    });

    function readFromTrio(trioUints: any): BN {
      switch (rewardToken.address) {
        case trioTokens.tokenA:
          return trioUints.uintA;
        case trioTokens.tokenB:
          return trioUints.uintB;
        case trioTokens.tokenC:
          return trioUints.uintC;
      }
      return BN.from(0);
    }

    async function readReward(user: Wallet): Promise<BN> {
      const rewardData = await env.rewardManager.readRewardData(tokenToStake, env.EXPIRY, user.address);
      if (usingMultiReward) {
        return readFromTrio(rewardData.dueRewards);
      } else {
        return rewardData.dueRewards;
      }
    }

    // run the same script on multiple rewardTokens
    async function runRewardTokenTest(testScript: any) {
      for (let token of rewardTokens) {
        rewardToken = token;
        await testScript();
        await revertBlockchain();
      }
    }

    // check that the new rewards are distributed proportionally to OT balances
    async function redeemAndCheckRewardAndSendTnx(transaction: any) {
      await minerStop();
      const users = [charlie, dave, eve];
      const rewardBalanceBefore: BN[] = new Array(3);
      const otBalance: BN[] = new Array(3);
      const rewardEarned: BN[] = new Array(3);
      const otTotalSupply = await env.ot.totalSupply();
      let totalRewardEarned = BN.from(0);
      await transaction();
      for (const index of [0, 1, 2]) {
        otBalance[index] = await env.ot.balanceOf(users[index].address);
        rewardBalanceBefore[index] = await rewardToken.balanceOf(users[index].address);
        await env.rewardManager
          .connect(users[index])
          .redeemRewards(tokenToStake, env.EXPIRY, users[index].address, teConsts.HG);
      }

      await mineAllPendingTransactions();
      await minerStart();

      for (const index of [0, 1, 2]) {
        const rewardBalanceAfter = await rewardToken.balanceOf(users[index].address);
        rewardEarned[index] = rewardBalanceAfter.sub(rewardBalanceBefore[index]);
        totalRewardEarned = totalRewardEarned.add(rewardEarned[index]);
      }

      for (const index of [0, 1, 2]) {
        const expectedReward = totalRewardEarned.mul(otBalance[index]).div(otTotalSupply);
        approxBigNumber(rewardEarned[index], expectedReward, BN.from(10));
      }

      const rewardLeftInYieldTokenHolder = await rewardToken.balanceOf(yieldTokenHolder);
      // not strict 0 since we buffered some tokens for sushi
      approxBigNumber(rewardLeftInYieldTokenHolder, BN.from(0), BN.from(1000));
    }

    // async function printForgeStatus() {
    //   console.log(`\n\tYieldTokenHolder = ${yieldTokenHolder}`);
    //   const rewardBalance = await rewardToken.balanceOf(yieldTokenHolder);
    //   console.log(`\tReward token balance of yieldTokenHolder = ${rewardBalance}`);
    //   console.log(`\t Total OT supply = ${await env.ot.totalSupply()}`);
    // }

    // Bob:
    //    - holds the yToken throughout from t0
    //    - redeem incentives directly from protocol at t5
    // Charlie:
    //    - tokenize half of yToken at t0
    //    - redeemUnderlying half of his OTs at t2
    //    - redeemAfterExpiry at t4 (after expiry)
    //    - redeemRewards() at t5
    // Dave:
    //    - tokenize 2/3 of yToken & empty XYTs at t1
    //    - send 2/3 of his OT to Eve at t3
    //    - redeemRewards() at t5
    // Eve:
    //    - Eve sends half of his OTs back to Dave at t4
    //    - redeemRewards() at t5
    // => At t5, this must hold:
    //       reward(Bob) = reward(Charlie) = reward(Dave) + reward(Eve)
    it('[Only Compound] OT users should receive same rewards as yToken holders', async () => {
      await runRewardTokenTest(async () => {
        if (mode !== Mode.COMPOUND) return;
        //t0
        await tokenizeYield(env, charlie, userInitialYieldToken);

        //t1
        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 3);
        await tokenizeYield(env, dave, userInitialYieldToken.mul(2).div(3)); // tokenize 2/3 of yToken & empty XYTs at t1
        const otMintedDave = await env.ot.balanceOf(dave.address);

        //t2
        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 3);
        await redeemUnderlying(env, charlie, userInitialYieldToken.div(2)); // redeemUnderlying half of his OTs at t2

        //t3
        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 3);
        await env.ot.connect(dave).transfer(eve.address, otMintedDave.mul(2).div(3));

        //t4
        await advanceTimeAndBlock(MiscConsts.SIX_MONTH, 5);
        await redeemAfterExpiry(env, charlie);
        await env.ot.connect(eve).transfer(dave.address, otMintedDave.div(3));

        //t5
        await advanceTimeAndBlock(MiscConsts.ONE_MONTH, 5);

        await minerStop();
        await redeemRewardsFromProtocol(env, [bob, charlie, dave, eve]);
        for (const person of [charlie, dave, eve]) {
          await redeemOtRewards(env, tokenToStake, person);
        }
        await mineAllPendingTransactions();
        await minerStart();

        const bobRewardBalance = await rewardToken.balanceOf(bob.address);
        const charlieRewardBalance = await rewardToken.balanceOf(charlie.address);
        const daveRewardBalance = await rewardToken.balanceOf(dave.address);
        const eveRewardBalance = await rewardToken.balanceOf(eve.address);

        approxBigNumber(bobRewardBalance, charlieRewardBalance, env.TEST_DELTA);

        approxBigNumber(bobRewardBalance, daveRewardBalance.add(eveRewardBalance), env.TEST_DELTA);
      });
    });

    it('OT users should receive proportionally to their OT balance', async () => {
      await runRewardTokenTest(async () => {
        await tokenizeYield(env, charlie, userInitialYieldToken);
        const otMinted = await env.ot.balanceOf(charlie.address);

        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(
          async () => await tokenizeYield(env, alice, userInitialYieldToken.div(2), dave.address)
        );
        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(async () => await redeemUnderlying(env, charlie, otMinted.div(3)));
        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(
          async () => await env.ot.connect(dave).transfer(eve.address, otMinted.div(4), teConsts.HG)
        );

        await advanceTimeAndBlock(MiscConsts.SIX_MONTH, 20);
        await redeemAndCheckRewardAndSendTnx(async () => await redeemAfterExpiry(env, charlie));

        await advanceTimeAndBlock(MiscConsts.ONE_MONTH, 4);
        await redeemAndCheckRewardAndSendTnx(async () => {});
      });
    });

    it('Reward manager should work normally after updating updateFrequency to INF', async () => {
      let amount = userInitialYieldToken.div(10);
      for (let person of [bob, charlie, dave, eve]) {
        await tokenizeYield(env, alice, amount, person.address);
      }

      await advanceTime(MiscConsts.ONE_MONTH);
      await env.rewardManager.setUpdateFrequency([tokenToStake], [BN.from(10 ** 9)], teConsts.HG);

      for (let person of [bob, charlie, dave, eve]) {
        await env.ot.connect(person).transfer(alice.address, amount.div(2), lowGasSetting);

        await advanceTime(MiscConsts.ONE_MONTH);
        await redeemOtRewards(env, tokenToStake, person);
      }

      // Try updateParamLManual
      for (let person of [bob, charlie, dave, eve]) {
        await env.ot.connect(person).transfer(alice.address, amount.div(2), lowGasSetting);

        await advanceTime(MiscConsts.ONE_MONTH);
        await redeemOtRewards(env, tokenToStake, person);
        await env.rewardManager.connect(person).updateParamLManual(tokenToStake, env.EXPIRY, teConsts.HG);
      }
    });

    it('updateFrequency should work correctly', async () => {
      if (mode == Mode.TRADER_JOE) return;
      /*
        Scenario: Set updateFrequency to 7
        Flow:
          TXN_COUNT = 0

          bob, charlie, dave transfers 1 ot to others so that their rewards are updated with the latest paramL
          -> their rewards change in these 3 txns
          TXN_COUNT = 3

          bob, charlie, dave transfers amount ot to others, here, paramL remains unchanged due to frequency=7
          -> their rewards unchanged in these 3 txns
          TXN_COUNT = 6

          eve makes a single dummy txn, here the paramL changes when it reaches 7 blocks
          -> eve's reward updated
          TXN_COUNT=7
      */

      rewardToken = rewardTokens[0];
      async function checkRewardBalanceAfterTxn(
        transaction: any,
        ofUser: Wallet,
        shouldBeChanging: boolean
      ): Promise<void> {
        let rewardBefore: BN = await readReward(ofUser);
        await transaction();
        const rewardAfter: BN = await readReward(ofUser);
        expect(rewardBefore.eq(rewardAfter)).to.be.equal(!shouldBeChanging);
      }

      const amount = userInitialYieldToken.div(10);
      const amountToTransfer = amount.div(10);
      for (let person of [bob, charlie, dave, eve]) {
        await tokenizeYield(env, alice, amount, person.address);
        // repeat the tokenization twice so that their last paramL is not zero
        await tokenizeYield(env, alice, amount, person.address);
      }

      await advanceTime(MiscConsts.ONE_MONTH);
      await env.rewardManager.setUpdateFrequency([tokenToStake], [7], teConsts.HG);
      await env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, teConsts.HG);

      for (let t = 0; t < 5; ++t) {
        // 3 dummy transactions so that all wallets are updated with the latest paramL
        for (let i = 1; i < 4; ++i) {
          await checkRewardBalanceAfterTxn(
            async () => {
              await env.ot.connect(wallets[i]).transfer(wallets[i - 1].address, 1, teConsts.HG);
            },
            wallets[i],
            true
          );
        }
        for (let person of [bob, charlie, dave]) {
          await checkRewardBalanceAfterTxn(
            async () => {
              await env.ot.connect(person).transfer(alice.address, amountToTransfer, lowGasSetting);
            },
            person,
            false
          );
        }
        await checkRewardBalanceAfterTxn(
          async () => {
            await env.ot.connect(eve).transfer(alice.address, amountToTransfer, teConsts.HG);
          },
          eve,
          true
        );
      }
    });

    it('skippingRewards should work correctly', async () => {
      if (mode == Mode.TRADER_JOE) return;

      async function redeemRewardsToken(person: Wallet): Promise<BN> {
        let lastBalance: BN = await rewardToken.balanceOf(person.address);
        await redeemOtRewards(env, tokenToStake, person);
        let currentBalance: BN = await rewardToken.balanceOf(person.address);
        return currentBalance.sub(lastBalance);
      }

      async function readParamL(): Promise<BN> {
        let readDataArguments: any[] = [tokenToStake, env.EXPIRY, alice.address];
        const rewardData = await env.rewardManager.readRewardData(...readDataArguments);

        if (usingMultiReward) {
          return readFromTrio(rewardData.paramL);
        } else {
          return rewardData.paramL;
        }
      }

      async function ensureParamLUnchanged(functionToCall: any) {
        /// This function aims to check the change of paramL before and after a promise function is called
        let paramLBefore: BN = await readParamL();
        await functionToCall;
        const paramLAfter: BN = await readParamL();
        approxBigNumber(paramLBefore, paramLAfter, 0, false);
      }

      await runRewardTokenTest(async () => {
        const amount = userInitialYieldToken.div(10);
        for (let person of [bob, charlie, dave, eve]) {
          await tokenizeYield(env, alice, amount, person.address);
        }

        // Should receive pending reward before skippingRewards
        await advanceTime(MiscConsts.ONE_MONTH);
        for (let person of [bob, charlie, dave, eve]) {
          expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(false);
        }

        // Should not receive pending reward after skippingRewards
        await env.rewardManager.setSkippingRewards(true);
        await advanceTime(MiscConsts.ONE_MONTH);

        for (let person of [bob, charlie, dave, eve]) {
          // ParamL was updated when eve last redeem their reward. Thus, other actors should still receive their pending reward calculated up to that moment.
          if (person.address == eve.address) {
            expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(true);
          } else {
            expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(false);
          }
        }
        // just to see if it affects the skipping rewards.
        await env.rewardManager.setUpdateFrequency([tokenToStake], [2], teConsts.HG);
        await env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, teConsts.HG);

        for (let person of [bob, charlie, dave, eve]) {
          expect((await redeemRewardsToken(person)).eq(0)).to.be.equal(true);
        }

        // Transfering ot should be cheap
        for (let person of [bob, charlie, dave]) {
          await env.ot.connect(person).transfer(alice.address, amount, lowGasSetting);
        }

        // After skippingRewards, nothing should be able to change paramL
        for (let person of [bob, charlie, dave]) {
          /// redeemRewards
          await ensureParamLUnchanged(redeemRewardsToken(person));
          await ensureParamLUnchanged(env.ot.connect(alice).transfer(person.address, 1, teConsts.HG));
        }
        await ensureParamLUnchanged(env.rewardManager.setUpdateFrequency([tokenToStake], [2], teConsts.HG));
        await ensureParamLUnchanged(env.rewardManager.setSkippingRewards(true)); /// Must not set it false here :joy:
        await ensureParamLUnchanged(
          env.rewardManager.connect(alice).updateParamLManual(tokenToStake, env.EXPIRY, teConsts.HG)
        );
      });
    });

    it('isValidOT modifier should reject redeem interest request on invalid OT token', async () => {
      await expect(
        env.rewardManager.redeemRewards(MiscConsts.DUMMY_ADDRESS, env.EXPIRY, bob.address)
      ).to.be.revertedWith(errMsg.INVALID_OT);
    });

    it('onlyForge modifier should reject update reward request from non-forge', async () => {
      await expect(env.rewardManager.updatePendingRewards(tokenToStake, env.EXPIRY, alice.address)).to.be.revertedWith(
        errMsg.ONLY_FORGE
      );
    });

    it('setUpdateFrequency should reject inconsistent input array length', async () => {
      await expect(
        env.rewardManager.setUpdateFrequency([tokenToStake], [BN.from(100), MiscConsts.RONE])
      ).to.be.revertedWith(errMsg.ARRAY_LENGTH_MISMATCH);
    });

    it('updataParamL should be rejected for underlying asset with no existing yield token holder', async () => {
      await expect(env.rewardManager.updateParamLManual(MiscConsts.DUMMY_ADDRESS, alice.address)).to.be.revertedWith(
        errMsg.INVALID_YIELD_TOKEN_HOLDER
      );
    });

    it('[Only Multi] should be able to send ot to a contract', async () => {
      if (!usingMultiReward) return;
      await tokenizeYield(env, alice, BN.from(1000));
      await env.ot.connect(alice).transfer(env.router.address, 100, teConsts.HG);
      await env.ot.connect(alice).transfer(env.router.address, 100, teConsts.HG);
      await env.ot.connect(alice).transfer(env.router.address, 100, teConsts.HG);
    });

    it('[Only multireward] Emergency V2', async () => {
      if (!usingMultiReward) return;
      rewardToken = rewardTokens[0];
      await tokenizeYield(env, bob, BN.from(10000));
      await mineBlock(); // ghost blocks for some reward
      await mineBlock();

      await env.pausingManagerMain.setForgeLocked(env.FORGE_ID);
      await env.forge.setUpEmergencyModeV2(env.underlyingAsset.address, env.EXPIRY, eve.address, true);

      const yieldTokenHolderAddrr = await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY);

      expect(
        (await env.yToken.allowance(yieldTokenHolderAddrr, eve.address)).gt(0) &&
          (await rewardToken.allowance(yieldTokenHolderAddrr, eve.address)).gt(0)
      ).to.be.equal(true);
    });

    it('[Only Multi] should be able to withdraw rewards generated by Joe Pools', async () => {
      if (mode == Mode.TRADER_JOE) return;

      if (!usingMultiReward) return;
      rewardToken = rewardTokens[0];
      const REF_AMOUNT = env.INITIAL_YIELD_TOKEN_AMOUNT.div(10);
      await tokenizeYield(env, alice, REF_AMOUNT, bob.address);
      // make sure that alice has 0 ot and 0 rewardToken
      await emptyToken(env, env.ot, alice);
      await emptyToken(env, rewardToken, alice);
      approxBigNumber(await env.ot.balanceOf(alice.address), 0, 0);
      approxBigNumber(await rewardToken.balanceOf(alice.address), 0, 0);
      // Bob sending OTs to joe pool
      await env.ot.connect(bob).transfer(env.ptokens.JOE_WAVAX_DAI_LP!.address, REF_AMOUNT, teConsts.HG);

      // skip a few blocks to generate rewards
      await setTimeNextBlock(env.EXPIRY.add(MiscConsts.THREE_MONTH));
      for (let i = 0; i < 10; ++i) {
        await mineBlock();
      }

      await redeemOtRewards(env, tokenToStake, env.ptokens.JOE_WAVAX_DAI_LP!.address);

      expect((await rewardToken.balanceOf(alice.address)).gt(0)).to.be.equal(true);
      console.log(
        '[MUST > 100]',
        (await rewardToken.balanceOf(alice.address)).toString(),
        '- Reward governance received from ot pool.'
      );
    });

    // This test is the same as the second test, but shall randomly migrate during the test
    it('[Only Joes] should be able to receive rewards after migrating back and forth', async () => {
      if (mode !== Mode.TRADER_JOE && mode !== Mode.XJOE) return;
      async function migrate(): Promise<void> {
        const yieldTokenHolderAddr = await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY);
        const yieldTokenHolderContract = await getContract('PendleTraderJoeYieldTokenHolder', yieldTokenHolderAddr);
        const currentMasterChef = await yieldTokenHolderContract.masterChef();

        let migratingDestination = env.pconsts.joe!.MASTERCHEF_V2;
        if (migratingDestination.toLowerCase() === currentMasterChef.toLowerCase()) {
          migratingDestination = env.masterChefRewardRedeemer.address;
        }
        await env.forge.migrateMasterChef(
          env.underlyingAsset.address,
          [env.EXPIRY],
          migratingDestination,
          env.MASTER_CHEF_PID,
          teConsts.HG
        );
      }

      await runRewardTokenTest(async () => {
        await tokenizeYield(env, charlie, userInitialYieldToken);
        const otMinted = await env.ot.balanceOf(charlie.address);

        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(
          async () => await tokenizeYield(env, alice, userInitialYieldToken.div(2), dave.address)
        );
        await migrate();

        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(async () => await redeemUnderlying(env, charlie, otMinted.div(3)));
        await migrate();

        await advanceTimeAndBlock(MiscConsts.ONE_DAY.mul(10), 20);
        await redeemAndCheckRewardAndSendTnx(
          async () => await env.ot.connect(dave).transfer(eve.address, otMinted.div(4), teConsts.HG)
        );
        await migrate();

        await advanceTimeAndBlock(MiscConsts.SIX_MONTH, 20);
        await redeemAndCheckRewardAndSendTnx(async () => await redeemAfterExpiry(env, charlie));
        await migrate();

        await advanceTimeAndBlock(MiscConsts.ONE_MONTH, 4);
        await redeemAndCheckRewardAndSendTnx(async () => {});
        await migrate();
      });
    });
  });
}
