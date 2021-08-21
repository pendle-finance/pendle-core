import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, utils } from 'ethers';
import hre from 'hardhat';
import PendleGovernanceManager from '../../../build/artifacts/contracts/core/PendleGovernanceManager.sol/PendleGovernanceManager.json';
import MockWithdrawableV2 from '../../../build/artifacts/contracts/mock/MockWithdrawableV2.sol/MockWithdrawableV2.json';
import { errMsg, mint, tokens } from '../../helpers';
chai.use(solidity);

const { waffle } = require('hardhat');
const { deployContract, provider } = waffle;

describe('WithdrawableV2 @skip-on-coverage', () => {
  const [alice] = provider.getWallets();

  let govManager: Contract;
  let withdrawableV2: Contract;
  let usdt: Contract;

  before(async () => {
    govManager = await deployContract(alice, PendleGovernanceManager, [alice.address]);
    withdrawableV2 = await deployContract(alice, MockWithdrawableV2, [govManager.address]);

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

  it('should be able to withdraw tokens', async () => {
    await usdt.transfer(withdrawableV2.address, BN.from(10 ** 5));

    let balance = await usdt.balanceOf(withdrawableV2.address);
    expect(balance).to.equal(BN.from(10 ** 5));

    await withdrawableV2.withdrawToken(usdt.address, BN.from(10 ** 5), alice.address);

    balance = await usdt.balanceOf(withdrawableV2.address);
    expect(balance).to.equal(0);
  });

  it('should not be allowed to withdraw usdt token', async () => {
    await withdrawableV2.setAllowed(false);

    await usdt.transfer(withdrawableV2.address, BN.from(10 ** 5));

    let balance = await usdt.balanceOf(withdrawableV2.address);
    expect(balance).to.equal(BN.from(10 ** 5));

    await expect(withdrawableV2.withdrawToken(usdt.address, BN.from(10 ** 5), alice.address)).to.be.revertedWith(
      errMsg.TOKEN_NOT_ALLOWED
    );

    balance = await usdt.balanceOf(withdrawableV2.address);
    expect(balance).to.equal(BN.from(10 ** 5));
  });
});
