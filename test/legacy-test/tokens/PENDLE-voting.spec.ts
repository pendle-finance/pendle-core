import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, utils, Wallet } from 'ethers';
import MockPENDLE from '../../../build/artifacts/contracts/mock/MockPENDLE.sol/MockPENDLE.json';
import { consts, errMsg, evm_revert, evm_snapshot } from '../../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { provider, deployContract } = waffle;

describe('PENDLE-voting @skip-on-coverage', () => {
  const wallets: Wallet[] = provider.getWallets();
  const [root, a1, a2, ...accounts] = wallets;

  const name = 'Pendle';
  const symbol = 'PENDLE';
  const initialSupply = BN.from('188700000000000000000000000');

  let chainId: number;
  let PENDLE: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    chainId = consts.DEFAULT_CHAIN_ID;
    PENDLE = await deployContract(root, MockPENDLE, [
      root.address,
      root.address,
      root.address,
      root.address,
      root.address,
    ]);
    snapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  describe('metadata', () => {
    it('has given name', async () => {
      expect(await PENDLE.name()).to.equal(name);
    });

    it('has given symbol', async () => {
      expect(await PENDLE.symbol()).to.equal(symbol);
    });
  });

  describe('balanceOf', () => {
    it('grants to initial account', async () => {
      expect(await PENDLE.balanceOf(root.address)).to.equal(initialSupply);
    });
  });

  function bytes32(str: string) {
    return utils.formatBytes32String(str);
  }

  describe('delegateBySig', () => {
    const Domain = (contract: any) => ({
      name,
      chainId,
      verifyingContract: contract.address,
    });
    const Types = {
      Delegation: [
        { name: 'delegatee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
      ],
    };

    it('reverts if the signatory is invalid', async () => {
      const delegatee = root,
        nonce = 0,
        expiry = 0;
      await expect(
        PENDLE.delegateBySig(delegatee.address, nonce, expiry, 0, bytes32('bad'), bytes32('bad'))
      ).to.be.revertedWith(errMsg.INVALID_SIGNATURE);
    });

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root.address,
        nonce = 1,
        expiry = 0;
      const Data = { delegatee, nonce, expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      await expect(PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith('INVALID_NONCE');
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root.address,
        nonce = 0,
        expiry = 0;
      const Data = { delegatee, nonce, expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      await expect(PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith('SIGNATURE_EXPIRED');
    });

    it('delegates on behalf of the signatory', async () => {
      const delegatee = root.address,
        nonce = 0,
        expiry = 10e9;
      const Data = { delegatee, nonce, expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      expect(await PENDLE.delegates(a1.address)).to.equal(consts.ZERO_ADDRESS);
      const tx = await PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s);
      expect(tx.gasUsed < 80000);
      expect(await PENDLE.delegates(a1.address)).to.equal(root.address);
    });
  });

  // function checkValidCheckpoints(checkpoints: any, fromBlock: number, votes: BN) {
  //   expect(checkpoints.fromBlock).to.equal(fromBlock);
  //   expect(checkpoints.votes).to.equal(votes);
  // }

  // describe('numCheckpoints', () => {
  //   it('returns the number of checkpoints for a delegate', async () => {
  //     let guy = accounts[0];
  //     await PENDLE.transfer(guy.address, BN.from(100)); //give an account a few tokens for readability
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('0'));

  //     let t1 = await PENDLE.connect(guy).delegate(a1.address);
  //     t1['blockNumber'] = await provider.getBlockNumber();
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('1'));

  //     const t2 = await PENDLE.connect(guy).transfer(a2.address, BN.from(10));
  //     t2['blockNumber'] = await provider.getBlockNumber();
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('2'));

  //     const t3 = await PENDLE.connect(guy).transfer(a2.address, BN.from(10));
  //     t3['blockNumber'] = await provider.getBlockNumber();
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('3'));

  //     const t4 = await PENDLE.connect(root).transfer(guy.address, BN.from(20));
  //     t4['blockNumber'] = await provider.getBlockNumber();
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('4'));

  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(0)), t1.blockNumber, BN.from(100));
  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(1)), t2.blockNumber, BN.from(90));
  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(2)), t3.blockNumber, BN.from(80));
  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(3)), t4.blockNumber, BN.from(100));
  //   });

  //   it.only('does not add more than one checkpoint in a block', async () => {
  //     let guy = accounts[0];

  //     await PENDLE.transfer(guy.address, BN.from(100)); //give an account a few tokens for readability
  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('0'));
  //     // await minerStop(provider);

  //     let t1 = await PENDLE.connect(guy).delegate(a1.address);
  //     let t2 = await PENDLE.connect(guy).transfer(a2.address, BN.from(10));
  //     let t3 = await PENDLE.connect(guy).transfer(a2.address, BN.from(10));

  //     console.log(t1, t2, t3);
  //     return;
  //     // await minerStart(provider);
  //     // t1['blockNumber'] = await provider.getBlockNumber();
  //     // t2['blockNumber'] = await provider.getBlockNumber();
  //     // t3['blockNumber'] = await provider.getBlockNumber();
  //     // console.log(t1, t2, t3);

  //     expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from('1'));

  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(0)), t1.blockNumber, BN.from(80));
  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(1)), 0, BN.from(0));
  //     checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(2)), 0, BN.from(0));

  //     // const t4 = await PENDLE.transfer(guy.address, 20);
  //     // t4['blockNumber'] = await provider.getBlockNumber();

  //     // expect(await PENDLE.numCheckpoints(a1.address)).to.equal(BN.from(2));
  //     // checkValidCheckpoints(await PENDLE.checkpoints(a1.address, BN.from(1)), t4.blockNumber, BN.from(100));
  //   });
  // });
});
