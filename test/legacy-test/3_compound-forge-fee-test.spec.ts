import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { routerFixture } from '../fixtures';
import { checkDisabled, Mode } from '../fixtures/TestEnv';
import {
  amountToWei,
  approxBigNumber,
  consts,
  evm_revert,
  evm_snapshot,
  getCContract,
  getERC20Contract,
  mint,
  mintCompoundToken,
  setTimeNextBlock,
  toFixedPoint,
  Token,
  tokens,
} from '../helpers';

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const wallets = provider.getWallets();
    const [alice, bob, charlie, dave, eve] = wallets;

    let router: Contract;
    let data: Contract;
    let cOt: Contract;
    let cUSDT: Contract;
    let cForge: Contract;
    let snapshotId: string;
    let globalSnapshotId: string;
    let tokenUSDT: Token;

    before(async () => {
      globalSnapshotId = await evm_snapshot();
      const fixture = await loadFixture(routerFixture);

      router = fixture.core.router;
      data = fixture.core.data;
      cOt = fixture.cForge.cOwnershipToken;
      tokenUSDT = tokens.USDT;
      cForge = fixture.cForge.compoundForge;
      cUSDT = await getCContract(alice, tokenUSDT);

      await mintCompoundToken(tokens.USDT, bob, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
      await mintCompoundToken(tokens.USDT, charlie, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
      await mintCompoundToken(tokens.USDT, dave, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
      await cUSDT.connect(bob).approve(router.address, consts.INF);
      await cUSDT.connect(charlie).approve(router.address, consts.INF);

      snapshotId = await evm_snapshot();
    });

    after(async () => {
      await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
      await evm_revert(snapshotId);
      snapshotId = await evm_snapshot();
    });

    async function redeemDueInterests(user: Wallet) {
      await router.redeemDueInterests(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        user.address,
        consts.HG
      );
    }

    async function tokenizeYield(user: Wallet, amount: BN) {
      await router
        .connect(user)
        .tokenizeYield(
          consts.FORGE_COMPOUND,
          tokenUSDT.address,
          consts.T0_C.add(consts.SIX_MONTH),
          amount,
          user.address,
          consts.HG
        );
    }

    async function addFakeIncome(token: Token, user: Wallet, amount: BN) {
      await mint(token, user, amount);
      let USDTcontract = await getERC20Contract(user, token);
      USDTcontract.connect(user).transfer(cUSDT.address, amountToWei(amount, token.decimal));
    }

    it('Compound forge fee', async () => {
      const amount = BN.from(100000000000);
      const period = consts.SIX_MONTH;

      async function getInterestRate(_forgeFee: string) {
        let forgeFee = toFixedPoint(_forgeFee);
        await data.setForgeFee(forgeFee);
        await tokenizeYield(bob, amount);
        await tokenizeYield(alice, BN.from(100));

        let balanceBefore = await cUSDT.balanceOf(bob.address);

        await setTimeNextBlock(consts.T0_C.add(period.div(2)));
        await addFakeIncome(tokens.USDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
        await redeemDueInterests(alice);

        await setTimeNextBlock(consts.T0_C.add(period.sub(consts.ONE_DAY)));
        await addFakeIncome(tokens.USDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
        await redeemDueInterests(dave);

        await setTimeNextBlock(consts.T0_C.add(period.add(100)));
        await addFakeIncome(tokens.USDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
        await redeemDueInterests(bob);

        let balanceNow = await cUSDT.balanceOf(bob.address);
        return balanceNow.sub(balanceBefore);
      }

      let tempSnapshot = await evm_snapshot();
      let withoutForgeFee = await getInterestRate('0');
      await evm_revert(tempSnapshot);
      let withForgeFee = await getInterestRate('0.1');

      let expectedWithForgeFee = withoutForgeFee.mul(9).div(10);
      approxBigNumber(withForgeFee, expectedWithForgeFee, BN.from(10), true);
    });
  });
}

describe('compound-forge-fee', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
