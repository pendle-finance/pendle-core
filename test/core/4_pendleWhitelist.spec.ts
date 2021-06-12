import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import PendleWhitelist from '../../build/artifacts/contracts/core/PendleWhitelist.sol/PendleWhitelist.json'
import MockPendleWhitelist from '../../build/artifacts/contracts/mock/MockPendleWhitelist.sol/MockPendleWhitelist.json'
import { consts, evm_revert, evm_snapshot, setTimeNextBlock } from '../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider, deployContract } = waffle;

describe('pendleWhitelist', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, governance] = wallets;

  let snapshotId: string;
  let globalSnapshotId: string;

  let pendleWhitelistContract: Contract;
  let mockPendleWhitelistContract: Contract;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    pendleWhitelistContract =  await deployContract(alice, PendleWhitelist, [governance.address]);
    mockPendleWhitelistContract = await deployContract(alice, MockPendleWhitelist, [governance.address]);

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('should have correct governance and initializer after deployment', async () => {
    await expect(mockPendleWhitelistContract.getInitializer()).to.be.eq(alice.address);
    await expect(pendleWhitelistContract.governanceManager()).to.be.eq(governance.address);
  })

  it('should not ba able to assign zero address as governance', async () => {
    await expect(deployContract(bob, PendleWhitelist, [consts.ZERO_ADDRESS])).to.be.revertedWith("ZERO_ADDRESS");
  })

  it('should have empty whitelist after deployment', async () => {
    await expect(pendleWhitelistContract.getWhitelist()).to.be.empty;
  })
 
});
