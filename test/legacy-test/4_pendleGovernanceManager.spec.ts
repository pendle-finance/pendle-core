import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { Contract } from 'ethers';
import PendleGovernanceManager from '../../build/artifacts/contracts/core/PendleGovernanceManager.sol/PendleGovernanceManager.json';
import MockPendleGovernanceManager from '../../build/artifacts/contracts/mock/MockPendleGovernanceManager.sol/MockPendleGovernanceManager.json';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { consts, evm_revert, evm_snapshot } from '../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider, deployContract } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, salesMultisig, liqIncentivesRecipient] = wallets;

    let snapshotId: string;
    let globalSnapshotId: string;

    let pendleGovernanceManagerContract: Contract;

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      pendleGovernanceManagerContract = await deployContract(alice, PendleGovernanceManager, [alice.address]);
      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('should have the correct governance after deployment', async () => {
      const governance = await pendleGovernanceManagerContract.governance();
      const pendingGovernance = await pendleGovernanceManagerContract.pendingGovernance();

      expect(governance).to.be.eq(alice.address);
      expect(pendingGovernance).to.be.eq(consts.ZERO_ADDRESS);
    });

    it('should not be able to deploy zero address as governance', async () => {
      await expect(deployContract(alice, PendleGovernanceManager, [consts.ZERO_ADDRESS])).to.be.revertedWith(
        'ZERO_ADDRESS'
      );
    });

    it('should not be able to transfer governance to zero address', async () => {
      await expect(
        pendleGovernanceManagerContract.connect(alice).transferGovernance(consts.ZERO_ADDRESS)
      ).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should be able to transfer governance', async () => {
      await pendleGovernanceManagerContract.connect(alice).transferGovernance(bob.address);
      const pendingGovernance = await pendleGovernanceManagerContract.pendingGovernance();
      expect(pendingGovernance).to.be.eq(bob.address);
      await pendleGovernanceManagerContract.connect(bob).claimGovernance();
      const newGovernance = await pendleGovernanceManagerContract.governance();
      expect(newGovernance).to.be.eq(bob.address);
      const newPendingGovernance = await pendleGovernanceManagerContract.pendingGovernance();
      expect(newPendingGovernance).to.be.eq(consts.ZERO_ADDRESS);
    });

    it('non-governance address shall not be able to transfer governance', async () => {
      await expect(pendleGovernanceManagerContract.connect(bob).transferGovernance(bob.address)).to.be.revertedWith(
        'ONLY_GOVERNANCE'
      );
    });

    it('non-pendingGovernance shall not be able to claim governance', async () => {
      await pendleGovernanceManagerContract.connect(alice).transferGovernance(bob.address);
      await expect(pendleGovernanceManagerContract.connect(charlie).claimGovernance()).to.be.revertedWith(
        'WRONG_GOVERNANCE'
      );
      await pendleGovernanceManagerContract.connect(alice).transferGovernance(charlie.address);
      await expect(pendleGovernanceManagerContract.connect(bob).claimGovernance()).to.be.revertedWith(
        'WRONG_GOVERNANCE'
      );
    });

    it('TransferGovernancePending and GovernanceClaimed event should be emitted upon successful transfer and claiming', async () => {
      await expect(pendleGovernanceManagerContract.connect(alice).transferGovernance(bob.address))
        .to.emit(pendleGovernanceManagerContract, 'TransferGovernancePending')
        .withArgs(bob.address);
      await expect(pendleGovernanceManagerContract.connect(bob).claimGovernance())
        .to.emit(pendleGovernanceManagerContract, 'GovernanceClaimed')
        .withArgs(bob.address, alice.address);
    });

    it('OnlyGovernance modifier should reject non-governance address', async () => {
      let MockPendleGovernanceManagerContract: Contract;
      MockPendleGovernanceManagerContract = await deployContract(alice, MockPendleGovernanceManager, [alice.address]);
      await expect(MockPendleGovernanceManagerContract.connect(bob).stub()).to.be.revertedWith('ONLY_GOVERNANCE');
    });
  });
}

describe('pendleGovernanceManager', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
