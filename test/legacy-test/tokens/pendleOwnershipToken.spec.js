/* eslint-disable prettier/prettier */
const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { consts, errMsg } = require('../../helpers');

const {
  shouldBehaveLikeERC20,
  shouldBehaveLikeERC20Transfer,
  shouldBehaveLikeERC20Approve,
} = require('./ERC20.behavior');

const MockPendleOwnerShipToken = artifacts.require(
  '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json'
);
const TestToken = artifacts.require('../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json');

contract('PendleOwnershipToken @skip-on-coverage', function (accounts) {
  const [initialHolder, recipient, anotherAccount] = accounts;
  const name = 'My Token';
  const symbol = 'MTKN';

  const initialSupply = new BN(100);

  beforeEach(async function () {
    this.token = await MockPendleOwnerShipToken.new(
      consts.RANDOM_ADDRESS,
      consts.RANDOM_ADDRESS,
      name,
      symbol,
      6,
      consts.T0_A2,
      consts.T0_A2.add(consts.SIX_MONTH),
      initialHolder,
      initialSupply
    );
  });

  it('has a name', async function () {
    expect(await this.token.name()).to.equal(name);
  });

  it('has a symbol', async function () {
    expect(await this.token.symbol()).to.equal(symbol);
  });

  it('has 6 decimals', async function () {
    expect(await this.token.decimals()).to.be.bignumber.equal('6');
  });

  describe('_setupDecimals', function () {
    const decimals = new BN(6);

    it('can set decimals during construction', async function () {
      const token = await TestToken.new(name, symbol, decimals);
      expect(await token.decimals()).to.be.bignumber.equal(decimals);
    });
  });

  // shouldBehaveLikeERC20('ERC20', initialSupply, initialHolder, recipient, anotherAccount);

  // describe('decrease allowance', function () {
  //   describe('when the spender is not the zero address', function () {
  //     const spender = recipient;
  //
  //     function shouldDecreaseApproval(amount) {
  //       describe('when there was no approved amount before', function () {
  //         it('reverts', async function () {
  //           await expectRevert(
  //             this.token.decreaseAllowance(spender, amount, {from: initialHolder}),
  //             errMsg.NEGATIVE_ALLOWANCE
  //           );
  //         });
  //       });
  //
  //       describe('when the spender had an approved amount', function () {
  //         const approvedAmount = amount;
  //
  //         beforeEach(async function () {
  //           ({logs: this.logs} = await this.token.approve(spender, approvedAmount, {from: initialHolder}));
  //         });
  //
  //         it('emits an approval event', async function () {
  //           const {logs} = await this.token.decreaseAllowance(spender, approvedAmount, {from: initialHolder});
  //
  //           expectEvent.inLogs(logs, 'Approval', {
  //             owner: initialHolder,
  //             spender: spender,
  //             value: new BN(0),
  //           });
  //         });
  //
  //         it('decreases the spender allowance subtracting the requested amount', async function () {
  //           await this.token.decreaseAllowance(spender, approvedAmount.subn(1), {from: initialHolder});
  //
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('1');
  //         });
  //
  //         it('sets the allowance to zero when all allowance is removed', async function () {
  //           await this.token.decreaseAllowance(spender, approvedAmount, {from: initialHolder});
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal('0');
  //         });
  //
  //         it('reverts when more than the full allowance is removed', async function () {
  //           await expectRevert(
  //             this.token.decreaseAllowance(spender, approvedAmount.addn(1), {from: initialHolder}),
  //             errMsg.NEGATIVE_ALLOWANCE
  //           );
  //         });
  //       });
  //     }
  //
  //     describe('when the sender has enough balance', function () {
  //       const amount = initialSupply;
  //
  //       shouldDecreaseApproval(amount);
  //     });
  //
  //     describe('when the sender does not have enough balance', function () {
  //       const amount = initialSupply.addn(1);
  //
  //       shouldDecreaseApproval(amount);
  //     });
  //   });
  //
  //   describe('when the spender is the zero address', function () {
  //     const amount = initialSupply;
  //     const spender = consts.ZERO_ADDRESS;
  //
  //     it('reverts', async function () {
  //       await expectRevert(
  //         this.token.decreaseAllowance(spender, amount, {from: initialHolder}),
  //         errMsg.NEGATIVE_ALLOWANCE
  //       );
  //     });
  //   });
  // });
  //
  // describe('increase allowance', function () {
  //   const amount = initialSupply;
  //
  //   describe('when the spender is not the zero address', function () {
  //     const spender = recipient;
  //
  //     describe('when the sender has enough balance', function () {
  //       it('emits an approval event', async function () {
  //         const {logs} = await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //         expectEvent.inLogs(logs, 'Approval', {
  //           owner: initialHolder,
  //           spender: spender,
  //           value: amount,
  //         });
  //       });
  //
  //       describe('when there was no approved amount before', function () {
  //         it('approves the requested amount', async function () {
  //           await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
  //         });
  //       });
  //
  //       describe('when the spender had an approved amount', function () {
  //         beforeEach(async function () {
  //           await this.token.approve(spender, new BN(1), {from: initialHolder});
  //         });
  //
  //         it('increases the spender allowance adding the requested amount', async function () {
  //           await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
  //         });
  //       });
  //     });
  //
  //     describe('when the sender does not have enough balance', function () {
  //       const amount = initialSupply.addn(1);
  //
  //       it('emits an approval event', async function () {
  //         const {logs} = await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //         expectEvent.inLogs(logs, 'Approval', {
  //           owner: initialHolder,
  //           spender: spender,
  //           value: amount,
  //         });
  //       });
  //
  //       describe('when there was no approved amount before', function () {
  //         it('approves the requested amount', async function () {
  //           await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount);
  //         });
  //       });
  //
  //       describe('when the spender had an approved amount', function () {
  //         beforeEach(async function () {
  //           await this.token.approve(spender, new BN(1), {from: initialHolder});
  //         });
  //
  //         it('increases the spender allowance adding the requested amount', async function () {
  //           await this.token.increaseAllowance(spender, amount, {from: initialHolder});
  //
  //           expect(await this.token.allowance(initialHolder, spender)).to.be.bignumber.equal(amount.addn(1));
  //         });
  //       });
  //     });
  //   });
  //
  //   describe('when the spender is the zero address', function () {
  //     const spender = consts.ZERO_ADDRESS;
  //
  //     it('reverts', async function () {
  //       await expectRevert(
  //         this.token.increaseAllowance(spender, amount, {from: initialHolder}),
  //         errMsg.SPENDER_ZERO_ADDR
  //       );
  //     });
  //   });
  // });
  //
  // describe('_mint', function () {
  //   const amount = new BN(50);
  //   it('rejects a null account', async function () {
  //     await expectRevert(this.token.mint(consts.ZERO_ADDRESS, amount), errMsg.MINT_TO_ZERO_ADDR);
  //   });
  //
  //   describe('for a non zero account', function () {
  //     beforeEach('minting', async function () {
  //       const {logs} = await this.token.mint(recipient, amount);
  //       this.logs = logs;
  //     });
  //
  //     it('increments totalSupply', async function () {
  //       const expectedSupply = initialSupply.add(amount);
  //       expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
  //     });
  //
  //     it('increments recipient balance', async function () {
  //       expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(amount);
  //     });
  //
  //     it('emits Transfer event', async function () {
  //       const event = expectEvent.inLogs(this.logs, 'Transfer', {
  //         from: consts.ZERO_ADDRESS,
  //         to: recipient,
  //       });
  //
  //       expect(event.args.value).to.be.bignumber.equal(amount);
  //     });
  //   });
  // });
  //
  // describe('_burn', function () {
  //   it('rejects a null account', async function () {
  //     await expectRevert(this.token.burn(consts.ZERO_ADDRESS, new BN(1)), errMsg.BURN_FROM_ZERO_ADDRESS);
  //   });
  //
  //   describe('for a non zero account', function () {
  //     it('rejects burning more than balance', async function () {
  //       await expectRevert(this.token.burn(initialHolder, initialSupply.addn(1)), errMsg.BURN_EXCEED_BALANCE);
  //     });
  //
  //     const describeBurn = function (description, amount) {
  //       describe(description, function () {
  //         beforeEach('burning', async function () {
  //           const {logs} = await this.token.burn(initialHolder, amount);
  //           this.logs = logs;
  //         });
  //
  //         it('decrements totalSupply', async function () {
  //           const expectedSupply = initialSupply.sub(amount);
  //           expect(await this.token.totalSupply()).to.be.bignumber.equal(expectedSupply);
  //         });
  //
  //         it('decrements initialHolder balance', async function () {
  //           const expectedBalance = initialSupply.sub(amount);
  //           expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal(expectedBalance);
  //         });
  //
  //         it('emits Transfer event', async function () {
  //           const event = expectEvent.inLogs(this.logs, 'Transfer', {
  //             from: initialHolder,
  //             to: consts.ZERO_ADDRESS,
  //           });
  //
  //           expect(event.args.value).to.be.bignumber.equal(amount);
  //         });
  //       });
  //     };
  //
  //     describeBurn('for entire balance', initialSupply);
  //     describeBurn('for less amount than balance', initialSupply.subn(1));
  //   });
  // });
  //
  // describe('_transfer', function () {
  //   shouldBehaveLikeERC20Transfer('ERC20', initialHolder, recipient, initialSupply, function (from, to, amount) {
  //     return this.token.transferInternal(from, to, amount);
  //   });
  //
  //   describe('when the sender is the zero address', function () {
  //     it('reverts', async function () {
  //       await expectRevert(
  //         this.token.transferInternal(consts.ZERO_ADDRESS, recipient, initialSupply),
  //         errMsg.SENDER_ZERO_ADDR
  //       );
  //     });
  //   });
  // });
  //
  // describe('_approve', function () {
  //   shouldBehaveLikeERC20Approve('ERC20', initialHolder, recipient, initialSupply, function (owner, spender, amount) {
  //     return this.token.approveInternal(owner, spender, amount);
  //   });
  //
  //   describe('when the owner is the zero address', function () {
  //     it('reverts', async function () {
  //       await expectRevert(
  //         this.token.approveInternal(consts.ZERO_ADDRESS, recipient, initialSupply),
  //         errMsg.OWNER_ZERO_ADDR
  //       );
  //     });
  //   });
  // });
});
