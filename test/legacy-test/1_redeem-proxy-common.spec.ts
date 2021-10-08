import { createFixtureLoader } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import hre from 'hardhat';
import PendleRedeemProxy from '../../build/artifacts/contracts/misc/PendleRedeemProxy.sol/PendleRedeemProxy.json';
import { checkDisabled, LiqParams, liquidityMiningFixture, Mode } from '../fixtures';
import { approxBigNumber, consts, evm_revert, evm_snapshot, getA2Contract, setTimeNextBlock, tokens } from '../helpers';

const { waffle } = hre;
const { provider, deployContract } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const loadFixture = createFixtureLoader(wallets, provider);
    const [alice, bob] = wallets;
    let liq: Contract;
    let router: Contract;
    let market: Contract;
    let xyt: Contract;
    let pdl: Contract;
    let params: LiqParams;
    let aUSDT: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let EXPIRY: BN = consts.T0_A2.add(consts.SIX_MONTH);
    let redeemProxy: Contract;
    before(async () => {
      globalSnapshotId = await evm_snapshot();
      const fixture = await loadFixture(liquidityMiningFixture);
      liq = fixture.a2LiquidityMining;
      router = fixture.core.router;
      pdl = fixture.pdl;
      market = fixture.a2Market;
      xyt = fixture.marketFix.a2Forge.a2FutureYieldToken;
      params = fixture.params;
      aUSDT = await getA2Contract(alice, fixture.marketFix.a2Forge.aaveV2Forge, tokens.USDT);
      redeemProxy = await deployContract(alice, PendleRedeemProxy, [router.address]);
      await fixture.core.data.setInterestUpdateRateDeltaForMarket(BN.from(0));
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('should be able to redeem using redeemProxy', async () => {
      await setTimeNextBlock(params.START_TIME.add(100));

      const aliceBalance = await market.balanceOf(alice.address);
      console.log(`alice LP Balance  = ${aliceBalance}`);

      await setTimeNextBlock(params.START_TIME.add(consts.ONE_MONTH));

      await liq.stake(EXPIRY, aliceBalance.div(2), consts.HG);
      await setTimeNextBlock(params.START_TIME.add(consts.THREE_MONTH));
      await alice.sendTransaction({ to: bob.address, value: 1 });

      const pendingXytInterests = await router.callStatic.redeemDueInterests(
        consts.FORGE_AAVE_V2,
        tokens.USDT.address,
        EXPIRY,
        alice.address
      );

      const pendingLpInterests = await router.callStatic.redeemLpInterests(market.address, alice.address);

      const pendingStakedLpInterests = await liq.callStatic.redeemLpInterests(EXPIRY, alice.address);

      const pendingRewards = await liq.callStatic.redeemRewards(EXPIRY, alice.address);

      console.log(`alice pending lpInterest = ${pendingLpInterests}`);
      console.log(`alice pending xyt interests  = ${pendingXytInterests}`);
      console.log(`alice pending staked Lp interests  = ${pendingStakedLpInterests}`);

      const balanceBeforeRedeem = await aUSDT.balanceOf(alice.address);
      const pendleBeforeRedeem = await pdl.balanceOf(alice.address);
      const response = await redeemProxy.callStatic.redeem(
        {
          xyts: [xyt.address],
          markets: [market.address],
          lmContractsForRewards: [liq.address, liq.address],
          expiriesForRewards: [EXPIRY, EXPIRY.add(consts.SIX_MONTH)],
          lmContractsForInterests: [liq.address, liq.address],
          expiriesForInterests: [EXPIRY, EXPIRY.add(consts.SIX_MONTH)],
          lmV2ContractsForRewards: [],
          lmV2ContractsForInterests: [],
        },
        alice.address,
        consts.HG
      );

      await redeemProxy.redeem(
        {
          xyts: [xyt.address],
          markets: [market.address],
          lmContractsForRewards: [liq.address, liq.address],
          expiriesForRewards: [EXPIRY, EXPIRY.add(consts.SIX_MONTH)],
          lmContractsForInterests: [liq.address, liq.address],
          expiriesForInterests: [EXPIRY, EXPIRY.add(consts.SIX_MONTH)],
          lmV2ContractsForRewards: [],
          lmV2ContractsForInterests: [],
        },
        alice.address,
        consts.HG
      );

      console.log(response);

      const balanceAfterRedeem = await aUSDT.balanceOf(alice.address);
      const pendleAfterRedeem = await pdl.balanceOf(alice.address);
      approxBigNumber(
        balanceAfterRedeem.sub(balanceBeforeRedeem),
        pendingLpInterests.add(pendingXytInterests).add(pendingStakedLpInterests),
        1000
      );
      approxBigNumber(pendleAfterRedeem.sub(pendleBeforeRedeem), pendingRewards, 0);
    });
  });
}

describe('Redeem Proxy', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
