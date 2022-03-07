import { loadFixture } from 'ethereum-waffle';
import { Mode, parseTestEnvRouterFixture, routerFixture, TestEnv } from '../fixtures';
import { amountToWei, approveInfinityIfNeed, evm_revert, evm_snapshot } from '../../pendle-deployment-scripts';
import { BigNumber as BN, utils } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { expect } from 'chai';

describe('', async () => {
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: TestEnv = {} as TestEnv;

  async function buildTestEnv() {
    env = await loadFixture(routerFixture);
    await parseTestEnvRouterFixture(env, Mode.GENERAL_TEST);
  }

  before(async () => {
    await buildTestEnv();
    globalSnapshotId = await evm_snapshot();
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it('should be able to set merkle root & allow users to redeem', async () => {
    const users = [
      { address: '0xD08c8e6d78a1f64B1796d6DC3137B19665cb6F1F', amount: BN.from(10).pow(17) },
      { address: '0xb7D15753D3F76e7C892B63db6b4729f700C01298', amount: BN.from(10).pow(17).mul(2) },
      { address: '0xf69Ca530Cd4849e3d1329FBEC06787a96a3f9A68', amount: BN.from(10).pow(17).mul(3) },
      { address: '0xa8532aAa27E9f7c3a96d754674c99F1E2f824800', amount: BN.from(10).pow(17).mul(4) },
    ];

    // equal to MerkleDistributor.sol #keccak256(abi.encodePacked(account, amount));
    const elements = users.map((x) => utils.solidityKeccak256(['address', 'uint256'], [x.address, x.amount]));

    const merkleTree = new MerkleTree(elements, keccak256, { sort: true });
    await env.merkleDistributor.setNewRootAndFund(merkleTree.getHexRoot(), 0);
    await approveInfinityIfNeed(env.penv, env.pendle.address, env.merkleDistributor.address);
    await env.merkleDistributor.connect(env.penv.deployer).fund(amountToWei(1, 18));

    for (let userId = 0; userId < users.length; userId++) {
      const leaf = elements[userId];
      const proof = merkleTree.getHexProof(leaf);
      await expect(env.merkleDistributor.claim(users[userId].address, users[userId].amount, proof))
        .to.emit(env.merkleDistributor, 'Claimed')
        .withArgs(users[userId].address, users[userId].amount);
    }
  });
});
