import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract } from 'ethers';
import PendleGovernanceManager from '../../build/artifacts/contracts/core/PendleGovernanceManager.sol/PendleGovernanceManager.json';
import PendleWhitelist from '../../build/artifacts/contracts/core/PendleWhitelist.sol/PendleWhitelist.json';
import MockPendleWhitelist from '../../build/artifacts/contracts/mock/MockPendleWhitelist.sol/MockPendleWhitelist.json';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { consts, evm_revert, evm_snapshot } from '../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider, deployContract } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, governance] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;

    let pendleWhitelistContract: Contract;
    let mockPendleWhitelistContract: Contract;
    let pendleGovernanceManagerContract: Contract;

    before(async () => {
      globalSnapshotId = await evm_snapshot();

      pendleGovernanceManagerContract = await deployContract(alice, PendleGovernanceManager, [governance.address]);

      pendleWhitelistContract = await deployContract(alice, PendleWhitelist, [pendleGovernanceManagerContract.address]);
      mockPendleWhitelistContract = await deployContract(alice, MockPendleWhitelist, [
        pendleGovernanceManagerContract.address,
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

    it('should have correct governance and initializer after deployment', async () => {
      const initializer = await mockPendleWhitelistContract.getInitializer();
      expect(initializer).to.be.eq(alice.address);
      const governanceAddress = await pendleWhitelistContract.governanceManager();
      expect(governanceAddress).to.be.eq(pendleGovernanceManagerContract.address);
    });

    it('should not ba able to assign zero address as governance', async () => {
      await expect(deployContract(bob, PendleWhitelist, [consts.ZERO_ADDRESS])).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should have empty whitelist after deployment', async () => {
      const whitelist = await pendleWhitelistContract.getWhitelist();
      await expect(whitelist).to.be.empty;
    });

    it('should be able to add to whitelist, and emit corresponding events', async () => {
      await expect(pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, charlie.address]))
        .to.emit(pendleWhitelistContract, 'AddedToWhiteList')
        .withArgs(bob.address)
        .to.emit(pendleWhitelistContract, 'AddedToWhiteList')
        .withArgs(charlie.address);
      const whitelist = await pendleWhitelistContract.getWhitelist();
      await expect(whitelist).to.have.members([bob.address, charlie.address]);
    });

    it('should not be able to add zero address to whitelist', async () => {
      await expect(
        pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, consts.ZERO_ADDRESS])
      ).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should not be able to add duplicate address to whitelist', async () => {
      await pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, charlie.address]);
      await expect(
        pendleWhitelistContract.connect(governance).addToWhitelist([charlie.address, dave.address])
      ).to.be.revertedWith('ALREADY_WHITELISTED');
    });

    it('non-governance address shall not be able to add to or remove from whitelist', async () => {
      await expect(pendleWhitelistContract.connect(alice).addToWhitelist([alice.address])).to.be.revertedWith(
        'ONLY_GOVERNANCE'
      );
      await expect(pendleWhitelistContract.connect(alice).removeFromWhitelist([bob.address])).to.be.revertedWith(
        'ONLY_GOVERNANCE'
      );
    });

    it('should be able to remove from whitelist, and emit corresponding eevnts', async () => {
      await pendleWhitelistContract.connect(governance).addToWhitelist([alice.address, bob.address, charlie.address]);
      await expect(pendleWhitelistContract.connect(governance).removeFromWhitelist([alice.address]))
        .to.emit(pendleWhitelistContract, 'RemovedFromWhiteList')
        .withArgs(alice.address);
      const whitelistAfterOneRemoval = await pendleWhitelistContract.getWhitelist();
      expect(whitelistAfterOneRemoval).to.have.members([bob.address, charlie.address]);
      await expect(pendleWhitelistContract.connect(governance).removeFromWhitelist([bob.address, charlie.address]))
        .to.emit(pendleWhitelistContract, 'RemovedFromWhiteList')
        .withArgs(bob.address)
        .to.emit(pendleWhitelistContract, 'RemovedFromWhiteList')
        .withArgs(charlie.address);
      const whitelistAftertwoRemoval = await pendleWhitelistContract.getWhitelist();
      expect(whitelistAftertwoRemoval).to.be.empty;
    });

    it('should not be able to remove zero address from whitelist', async () => {
      await expect(
        pendleWhitelistContract.connect(governance).removeFromWhitelist([consts.ZERO_ADDRESS])
      ).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should not be able to remove address that is not currently in whitelist', async () => {
      await pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, charlie.address]);
      await expect(
        pendleWhitelistContract.connect(governance).removeFromWhitelist([bob.address, consts.DUMMY_ADDRESS])
      ).to.be.revertedWith('NOT_WHITELISTED_YET');
    });

    it('should not be able to add or remove repeated address', async () => {
      await expect(
        pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, bob.address])
      ).to.be.revertedWith('ALREADY_WHITELISTED');
      await pendleWhitelistContract.connect(governance).addToWhitelist([bob.address, charlie.address]);
      await expect(
        pendleWhitelistContract.connect(governance).removeFromWhitelist([charlie.address, charlie.address])
      ).to.be.revertedWith('NOT_WHITELISTED_YET');
    });

    it('should correctly return whether an adddress is in whitelist', async () => {
      await pendleWhitelistContract.connect(governance).addToWhitelist([alice.address, bob.address, charlie.address]);
      const isAliceInWhitelist = await pendleWhitelistContract.whitelisted(alice.address);
      expect(isAliceInWhitelist).to.be.true;
      const isDaveInWhitelist = await pendleWhitelistContract.whitelisted(dave.address);
      expect(isDaveInWhitelist).to.be.false;
    });
  });
}

describe('pendleWhitelist', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
