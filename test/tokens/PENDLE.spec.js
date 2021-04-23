/* eslint-disable prettier/prettier */
const {BN, expectEvent, expectRevert} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const {consts, errMsg} = require('../helpers');

const {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
} = require('./ERC20.behavior');

const MockPENDLE = artifacts.require('../../build/artifacts/contracts/mock/MockPENDLE.sol/MockPENDLE.json');
const TestToken = artifacts.require('../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json');

contract('PENDLE', function (accounts) {
  const [initialHolder, recipient, anotherAccount] = accounts;
  const name = 'Pendle';
  const symbol = 'PENDLE';

  const initialSupply = new BN('188700000000000000000000000');

  beforeEach(async function () {
    this.token = await MockPENDLE.new(initialHolder, initialHolder, initialHolder, initialHolder, initialHolder);
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 18 decimals', async function () {
    expect(await this.token.decimals()).to.be.bignumber.equal('18');
  });

  describe('_setupDecimals', function () {
    const decimals = new BN(18);

    it('can set decimals during construction', async function () {
      const token = await TestToken.new(name, symbol, decimals);
      expect(await token.decimals()).to.be.bignumber.equal(decimals);
    });
  });

  shouldBehaveLikeERC20('ERC20', initialSupply, initialHolder, recipient, anotherAccount);

  describe('_transfer', function () {
    shouldBehaveLikeERC20Transfer('ERC20', initialHolder, recipient, initialSupply, function (from, to, amount) {
      return this.token.transferInternal(from, to, amount);
    });

    describe('when the sender is the zero address', function () {
      it('reverts', async function () {
        await expectRevert(
          this.token.transferInternal(consts.ZERO_ADDRESS, recipient, initialSupply),
          errMsg.SENDER_ZERO_ADDR
        );
      });
    });
  });
});
