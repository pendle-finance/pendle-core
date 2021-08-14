import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import { checkDisabled, marketFixture, Mode } from '../fixtures';
import { advanceTime, amountToWei, consts, evm_revert, evm_snapshot } from '../helpers';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob] = wallets;
    let router: Contract;
    let marketReader: Contract;
    let xyt: Contract;
    let market: Contract;
    let testToken: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;

    before(async () => {
      const fixture = await loadFixture(marketFixture);
      globalSnapshotId = await evm_snapshot();

      router = fixture.core.router;
      marketReader = fixture.core.marketReader;
      xyt = fixture.cForge.cFutureYieldToken;
      testToken = fixture.testToken;
      market = fixture.cMarket;
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    async function bootstrapSampleMarket(amount: BN) {
      await router.bootstrapMarket(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        amount,
        amount,
        consts.HG
      );
    }

    it('should be able to join a bootstrapped market with a single standard token', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let totalSupply = await market.totalSupply();
      let initialWalletBalance = await market.balanceOf(alice.address);
      await router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HG
      );
      let currentWalletBalance = await market.balanceOf(alice.address);
      expect(currentWalletBalance).to.be.gt(initialWalletBalance);
    });

    it('should be able to bootstrap', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);
      let xytBalance = await xyt.balanceOf(market.address);
      let testTokenBalance = await testToken.balanceOf(market.address);

      expect(xytBalance).to.be.equal(amount);
      expect(testTokenBalance).to.be.equal(amount);
    });

    it('should be able to join a bootstrapped pool by dual tokens', async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapSampleMarket(amount);

      const totalSupply = await market.totalSupply();

      await router
        .connect(bob)
        .addMarketLiquidityDual(
          consts.MARKET_FACTORY_COMPOUND,
          xyt.address,
          testToken.address,
          amount,
          amount,
          BN.from(0),
          BN.from(0),
          consts.HG
        );

      let xytBalance = await xyt.balanceOf(market.address);
      let testTokenBalance = await testToken.balanceOf(market.address);
      let totalSupplyBalance = await market.totalSupply();

      expect(xytBalance).to.be.equal(amount.mul(2));
      expect(testTokenBalance).to.be.equal(amount.mul(2));
      expect(totalSupplyBalance).to.be.equal(totalSupply.mul(2));
    });

    it('should be able to swap amount out', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let xytBalanceBefore = await xyt.balanceOf(market.address);

      let result = await marketReader.getMarketRateExactOut(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_COMPOUND
      );

      await router
        .connect(bob)
        .swapExactOut(
          xyt.address,
          testToken.address,
          amountToWei(BN.from(10), 6),
          amountToWei(BN.from(100), 6),
          consts.MARKET_FACTORY_COMPOUND,
          consts.HG
        );

      let xytBalance = await xyt.balanceOf(market.address);
      let testTokenBalance = await testToken.balanceOf(market.address);

      expect(xytBalance.toNumber()).to.be.approximately(xytBalanceBefore.add(BN.from(result[1])).toNumber(), 200);
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it('should be able to swap amount in', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      await router
        .connect(bob)
        .swapExactIn(
          xyt.address,
          testToken.address,
          amountToWei(BN.from(10), 6),
          BN.from(0),
          consts.MARKET_FACTORY_COMPOUND,
          consts.HG
        );

      let xytBalance = await xyt.balanceOf(market.address);
      let testTokenBalance = await testToken.balanceOf(market.address);

      expect(xytBalance.toNumber()).to.be.approximately(amount.add(amount.div(10)).toNumber(), 300);

      expect(testTokenBalance.toNumber()).to.be.approximately(
        amount.sub(amount.div(10)).toNumber(),
        amount.div(100).toNumber()
      );
    });

    it('should be able to exit a pool by dual tokens', async () => {
      const amount = amountToWei(BN.from(100), 6);
      await bootstrapSampleMarket(amount);
      await advanceTime(consts.ONE_MONTH);
      const totalSupply = await market.totalSupply();

      await router.removeMarketLiquidityDual(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        totalSupply.div(10),
        BN.from(0),
        BN.from(0),
        consts.HG
      );

      let xytBalance = await xyt.balanceOf(market.address);
      let testTokenBalance = await testToken.balanceOf(market.address);

      expect(xytBalance).to.be.equal(amount.sub(amount.div(10)));
      expect(testTokenBalance).to.be.equal(amount.sub(amount.div(10)));
    });

    it('should be able to getReserves', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let { xytBalance, tokenBalance } = await market.getReserves();
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it('should be able to getMarketReserve', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let [xytBalance, tokenBalance] = await marketReader.getMarketReserves(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address
      );
      expect(xytBalance).to.be.equal(amount);
      expect(tokenBalance).to.be.equal(amount);
    });

    it('should be able to getMarketRateExactOut', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let result = await marketReader.getMarketRateExactOut(
        xyt.address,
        testToken.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_COMPOUND
      );

      expect(result[1].toNumber()).to.be.approximately(11111111, consts.TEST_TOKEN_DELTA.toNumber());
    });

    it('should be able to getMarketRateExactIn', async () => {
      const amount = amountToWei(BN.from(100), 6);

      await bootstrapSampleMarket(amount);

      let result = await marketReader.getMarketRateExactIn(
        testToken.address,
        xyt.address,
        amountToWei(BN.from(10), 6),
        consts.MARKET_FACTORY_COMPOUND
      );

      expect(result[1].toNumber()).to.be.approximately(9090909, consts.TEST_TOKEN_DELTA.toNumber());
    });

    it('should be able to add market liquidity for a token', async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapSampleMarket(amount);
      await testToken.approve(market.address, consts.INF);

      let initialLpTokenBal = await market.balanceOf(alice.address);
      let initialXytBal = await xyt.balanceOf(alice.address);
      let initialTestTokenBal = await testToken.balanceOf(alice.address);

      let totalSupply = await market.totalSupply();
      await router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        false,
        amount.div(10),
        totalSupply.div(21),
        consts.HG
      );

      let currentLpTokenBal = await market.balanceOf(alice.address);
      let currentXytBal = await xyt.balanceOf(alice.address);
      let currentTestTokenBal = await testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.lt(initialTestTokenBal);
      expect(currentXytBal).to.be.equal(initialXytBal);
    });

    it('should be able to add XYT market liquidity', async () => {
      const amount = amountToWei(BN.from(10), 6);

      await bootstrapSampleMarket(amount);
      await testToken.approve(market.address, consts.INF);

      let initialLpTokenBal = await market.balanceOf(alice.address);
      let initialXytBal = await xyt.balanceOf(alice.address);
      let initialTestTokenBal = await testToken.balanceOf(alice.address);

      let totalSupply = await market.totalSupply();
      await router.addMarketLiquiditySingle(
        consts.MARKET_FACTORY_COMPOUND,
        xyt.address,
        testToken.address,
        true,
        amount.div(10),
        totalSupply.div(21),
        consts.HG
      );

      let currentLpTokenBal = await market.balanceOf(alice.address);
      let currentXytBal = await xyt.balanceOf(alice.address);
      let currentTestTokenBal = await testToken.balanceOf(alice.address);

      expect(currentLpTokenBal).to.be.gt(initialLpTokenBal);
      expect(currentTestTokenBal).to.be.equal(initialTestTokenBal);
      expect(currentXytBal).to.be.lt(initialXytBal);
    });

    it('should be able to getMarketTokenAddresses', async () => {
      let { token: receivedToken, xyt: receivedXyt } = await marketReader.getMarketTokenAddresses(market.address);
      expect(receivedToken).to.be.equal(testToken.address);
      expect(receivedXyt).to.be.equal(xyt.address);
    });
  });
}

describe('compound-market', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
