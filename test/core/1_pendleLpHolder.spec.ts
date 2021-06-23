import { expect } from 'chai';
import { BigNumber as BN, Contract } from 'ethers';
import { consts, evm_revert, evm_snapshot, getCContract, tokens } from '../helpers';
import { LiqParams, liquidityMiningFixture, LiquidityMiningFixture } from './fixtures';
import pendleLpHolder from '../../build/artifacts/contracts/core/PendleLpHolder.sol/PendleLpHolder.json';
import mockPendleLpHolder from '../../build/artifacts/contracts/mock/MockPendleLpHolder.sol/MockPendleLpHolder.json';

const { waffle } = require('hardhat');
const { loadFixture, provider, deployContract } = waffle;

describe('pendleLpHolder', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  let liq: Contract;
  let market: Contract;
  let pdl: Contract;
  let params: LiqParams;
  let cUSDT: Contract;
  let router: Contract;
  let lpHolder: Contract;
  let mockLpHolder: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let EXPIRY: BN = consts.T0_C.add(consts.SIX_MONTH);
  before(async () => {
    const fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
    globalSnapshotId = await evm_snapshot();
    liq = fixture.cLiquidityMining;
    market = fixture.cMarket;
    params = fixture.params;
    router = fixture.core.router
    pdl = fixture.pdl;
    cUSDT = await getCContract(alice, tokens.USDT);
    lpHolder = await deployContract(alice, pendleLpHolder, [fixture.core.govManager.address, market.address, router.address, cUSDT.address]);
    mockLpHolder = await deployContract(alice, mockPendleLpHolder, [fixture.core.govManager.address, market.address, router.address, cUSDT.address]);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('Cannot be initialized with zero address as argument(s)', async() => {
    await expect(deployContract(alice, pendleLpHolder, [consts.ZERO_ADDRESS, market.address, router.address, cUSDT.address])).to.be.revertedWith("ZERO_ADDRESS");
  })

  it('Should correctly initialize', async() => {
    const underlyingYieldToken = await lpHolder.underlyingYieldToken();
    expect(underlyingYieldToken.toLowerCase()).to.be.eq(cUSDT.address.toLowerCase());
    const pendleMarket = await lpHolder.pendleMarket();
    expect(pendleMarket.toLowerCase()).to.be.eq(market.address.toLowerCase());
  })

  it('Only liquidityMoning modifier should reject transactions by non-liquidity-mining address', async() => {
    await expect(lpHolder.connect(bob).sendInterests(bob.address, BN.from(100))).to.be.revertedWith("ONLY_LIQUIDITY_MINING");
  })

  it('Should return correct allowed_to_withdraw information', async() => {
    const allowed = await mockLpHolder.allowedToWithdraw(consts.RANDOM_ADDRESS);
    expect(allowed).to.be.true;
    const notAllowed = await mockLpHolder.allowedToWithdraw(cUSDT.address);
    expect(notAllowed).to.be.false;
  })


  
});
