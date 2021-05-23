import { expect } from 'chai';
import { BigNumber as BN, constants, Contract, utils } from 'ethers';
import hre from 'hardhat';
import { mint, tokens, withdraw } from '../helpers';
import MockWithdrawableV2 from '../../build/artifacts/contracts/mock/MockWithdrawableV2.sol/MockWithdrawableV2.json';

import { waffle } from 'hardhat';
const { deployContract, provider } = waffle;

describe('WithdrawableV2', () => {
  const [alice] = provider.getWallets();

  let withdrawableV2: Contract;
  let usdt: Contract;

  before(async () => {
    withdrawableV2 = await deployContract(alice, MockWithdrawableV2);

    await mint(tokens.USDT, alice, BN.from(10 ** 5));
    usdt = await hre.ethers.getContractAt('TestToken', tokens.USDT.address);
  });

  it('should be able to withdraw ether', async () => {
    await alice.sendTransaction({
      to: withdrawableV2.address,
      value: utils.parseEther('1.0'),
    });

    let balance = await provider.getBalance(withdrawableV2.address);

    expect(balance).to.equal(utils.parseEther('1.0'));

    await withdrawableV2.withdrawEther(utils.parseEther('1.0'), alice.address);

    balance = await provider.getBalance(withdrawableV2.address);

    expect(balance).to.equal(0);
  });

  // it('should be able to withdraw tokens', async () => {
  //   await usdt.transfer(withdrawableV2.address, BN.from(10 ** 5));
  //   await usdt.balanceOf(alice.address);
  // });

  // it('should not be allowed to withdraw ether', async () => {

  // });

  // it('should not be allowed to withdraw tokens', async () => {

  // });
});
