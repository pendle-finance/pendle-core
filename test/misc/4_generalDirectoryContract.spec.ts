import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, ethers } from 'ethers';
import DirectoryContract from '../../build/artifacts/contracts/misc/Directory.sol/Directory.json';
import MockPendleWhitelist from '../../build/artifacts/contracts/mock/MockPendleWhitelist.sol/MockPendleWhitelist.json';
import PendleGovernanceManager from '../../build/artifacts/contracts/core/PendleGovernanceManager.sol/PendleGovernanceManager.json';
import { consts, evm_revert, evm_snapshot } from '../helpers';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider, deployContract } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, governance] = wallets;
    const bytesString = ethers.utils.formatBytes32String('test');

    let snapshotId: string;
    let globalSnapshotId: string;

    let directoryContract: Contract;

    before(async () => {
      globalSnapshotId = await evm_snapshot();

      //   pendleGovernanceManagerContract = await deployContract(alice, PendleGovernanceManager, [governance.address]);

      directoryContract = await deployContract(governance, DirectoryContract, []);
      //   mockPendleWhitelistContract = await deployContract(alice, MockPendleWhitelist, [
      //     pendleGovernanceManagerContract.address,
      //   ]);

      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    it('should have empty directory after deployment', async () => {
      const directory = await directoryContract.getAddressesFromType(ethers.utils.formatBytes32String('test'));
      await expect(directory).to.be.empty;
    });

    it('should be able to add to directory, and emit corresponding events', async () => {
      await expect(directoryContract.connect(governance).addAddress(bytesString, [bob.address, charlie.address]))
        .to.emit(directoryContract, 'NewAddress')
        .withArgs(bytesString, bob.address)
        .to.emit(directoryContract, 'NewAddress')
        .withArgs(bytesString, charlie.address);
      const directoryList = await directoryContract.getAddressesFromType(bytesString);
      await expect(directoryList).to.have.members([bob.address, charlie.address]);
    });

    it('should not be able to add zero address to directory', async () => {
      await expect(
        directoryContract.connect(governance).addAddress(bytesString, [bob.address, consts.ZERO_ADDRESS])
      ).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should not be able to add duplicate address to directory', async () => {
      await directoryContract.connect(governance).addAddress(bytesString, [bob.address, charlie.address]);
      await expect(
        directoryContract.connect(governance).addAddress(bytesString, [charlie.address, dave.address])
      ).to.be.revertedWith('ALREADY_EXISTS');
    });

    it('non-governance address shall not be able to add to or remove from directory', async () => {
      await expect(directoryContract.connect(alice).addAddress(bytesString, [alice.address])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
      await expect(directoryContract.connect(alice).removeAddress(bytesString, [bob.address])).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should be able to remove from directory, and emit corresponding eevnts', async () => {
      await directoryContract
        .connect(governance)
        .addAddress(bytesString, [alice.address, bob.address, charlie.address]);
      await expect(directoryContract.connect(governance).removeAddress(bytesString, [alice.address]))
        .to.emit(directoryContract, 'RemoveAddress')
        .withArgs(bytesString, alice.address);
      const whitelistAfterOneRemoval = await directoryContract.getAddressesFromType(bytesString);
      expect(whitelistAfterOneRemoval).to.have.members([bob.address, charlie.address]);
      await expect(directoryContract.connect(governance).removeAddress(bytesString, [bob.address, charlie.address]))
        .to.emit(directoryContract, 'RemoveAddress')
        .withArgs(bytesString, bob.address)
        .to.emit(directoryContract, 'RemoveAddress')
        .withArgs(bytesString, charlie.address);
      const whitelistAftertwoRemoval = await directoryContract.getAddressesFromType(bytesString);
      expect(whitelistAftertwoRemoval).to.be.empty;
    });

    it('should not be able to remove zero address from directory', async () => {
      await expect(
        directoryContract.connect(governance).removeAddress(bytesString, [consts.ZERO_ADDRESS])
      ).to.be.revertedWith('ZERO_ADDRESS');
    });

    it('should not be able to remove address that is not currently in directory', async () => {
      await directoryContract.connect(governance).addAddress(bytesString, [bob.address, charlie.address]);
      await expect(
        directoryContract.connect(governance).removeAddress(bytesString, [bob.address, consts.DUMMY_ADDRESS])
      ).to.be.revertedWith('DOES_NOT_EXIST');
    });

    it('should not be able to add or remove repeated address', async () => {
      await expect(
        directoryContract.connect(governance).addAddress(bytesString, [bob.address, bob.address])
      ).to.be.revertedWith('ALREADY_EXISTS');
      await directoryContract.connect(governance).addAddress(bytesString, [bob.address, charlie.address]);
      await expect(
        directoryContract.connect(governance).removeAddress(bytesString, [charlie.address, charlie.address])
      ).to.be.revertedWith('DOES_NOT_EXIST');
    });

    it('should correctly return whether an adddress is in directory', async () => {
      await directoryContract
        .connect(governance)
        .addAddress(bytesString, [alice.address, bob.address, charlie.address]);
      const isAliceInWhitelist = await directoryContract.addressExist(bytesString, alice.address);
      expect(isAliceInWhitelist).to.be.true;
      const isDaveInWhitelist = await directoryContract.addressExist(bytesString, dave.address);
      expect(isDaveInWhitelist).to.be.false;
    });
  });
}

describe('Directory Contract', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
