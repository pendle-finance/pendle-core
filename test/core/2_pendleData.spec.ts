import { expect } from 'chai';
import { Contract } from 'ethers';
import { evm_revert, evm_snapshot, Token, tokens } from '../helpers';
import { marketFixture } from './fixtures';

import { waffle } from 'hardhat';
const { loadFixture } = waffle;

describe('PendleData', async () => {
  let router: Contract;
  let aMarketFactory: Contract;
  let a2MarketFactory: Contract;
  let cMarketFactory: Contract;
  let data: Contract;
  let treasury: Contract;
  let xyt: Contract;
  let tokenUSDT: Token;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    const fixture = await loadFixture(marketFixture);
    globalSnapshotId = await evm_snapshot();

    router = fixture.core.router;
    treasury = fixture.core.treasury;
    data = fixture.core.data;
    aMarketFactory = fixture.core.aMarketFactory;
    a2MarketFactory = fixture.core.a2MarketFactory;
    cMarketFactory = fixture.core.cMarketFactory;
    xyt = fixture.aForge.aFutureYieldToken;
    tokenUSDT = tokens.USDT;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('should be able to setMarketFees', async () => {
    await data.setMarketFees(10, 101);
    let swapFee = await data.swapFee();
    let protocolSwapFee = await data.protocolSwapFee();
    expect(swapFee).to.be.eq(10);
    expect(protocolSwapFee).to.be.eq(101);
  });

  it('should be able to get allMarketsLength', async () => {
    let allMarketsLength = await data.allMarketsLength();
    expect(allMarketsLength).to.be.eq(4); // numbers of markets that have been created in marketFixture
  });

  it('Should be able to setTreasury', async () => {
    await expect(data.setTreasury(treasury.address)).to.emit(data, 'TreasurySet').withArgs(treasury.address);
  });
});
