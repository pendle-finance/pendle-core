import { expect } from 'chai';
import { Contract } from 'ethers';
import { waffle } from 'hardhat';
import { evm_revert, evm_snapshot } from '../helpers';
import { marketFixture, MarketFixture } from './fixtures';

const { loadFixture } = waffle;

describe('PendleData', async () => {
  let data: Contract;
  let treasury: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    const fixture: MarketFixture = await loadFixture(marketFixture);
    globalSnapshotId = await evm_snapshot();

    treasury = fixture.core.treasury;
    data = fixture.core.data;
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
