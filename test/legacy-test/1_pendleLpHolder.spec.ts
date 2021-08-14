import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import pendleLpHolder from '../../build/artifacts/contracts/core/PendleLpHolder.sol/PendleLpHolder.json';
import mockPendleLpHolder from '../../build/artifacts/contracts/mock/MockPendleLpHolder.sol/MockPendleLpHolder.json';
import { checkDisabled, liquidityMiningFixture, LiquidityMiningFixture, Mode } from '../fixtures';
import { consts, errMsg, evm_revert, evm_snapshot, getCContract, tokens } from '../helpers';

const { waffle } = require('hardhat');
const { loadFixture, provider, deployContract } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;
    let market: Contract;
    let cUSDT: Contract;
    let router: Contract;
    let lpHolder: Contract;
    let mockLpHolder: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    before(async () => {
      const fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
      globalSnapshotId = await evm_snapshot();
      market = fixture.cMarket;
      router = fixture.core.router;
      router = fixture.core.router;
      cUSDT = await getCContract(alice, tokens.USDT);
      lpHolder = await deployContract(alice, pendleLpHolder, [
        fixture.core.govManager.address,
        market.address,
        router.address,
        cUSDT.address,
      ]);
      mockLpHolder = await deployContract(alice, mockPendleLpHolder, [
        fixture.core.govManager.address,
        market.address,
        router.address,
        cUSDT.address,
      ]);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('Cannot be initialized with zero address as argument(s)', async () => {
      await expect(
        deployContract(alice, pendleLpHolder, [consts.ZERO_ADDRESS, market.address, router.address, cUSDT.address])
      ).to.be.revertedWith(errMsg.ZERO_ADDRESS);
    });

    it('Should correctly initialize', async () => {
      const underlyingYieldToken = await lpHolder.underlyingYieldToken();
      expect(underlyingYieldToken.toLowerCase()).to.be.eq(cUSDT.address.toLowerCase());
      const pendleMarket = await lpHolder.pendleMarket();
      expect(pendleMarket.toLowerCase()).to.be.eq(market.address.toLowerCase());
    });

    it('Only liquidityMoning modifier should reject transactions by non-liquidity-mining address', async () => {
      await expect(lpHolder.connect(bob).sendInterests(bob.address, BN.from(100))).to.be.revertedWith(
        errMsg.ONLY_LIQUIDITY_MINING
      );
    });

    it('Should return correct allowed_to_withdraw information', async () => {
      expect(await mockLpHolder.allowedToWithdraw(consts.RANDOM_ADDRESS)).to.be.true;
      expect(await mockLpHolder.allowedToWithdraw(cUSDT.address)).to.be.false;
    });
  });
}

describe('pendleLpHolder', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
