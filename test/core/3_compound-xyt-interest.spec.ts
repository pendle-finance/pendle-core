import { BigNumber as BN, Contract, Wallet } from 'ethers';
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
  Token,
  tokens,
} from '../helpers';
import { routerFixture } from './fixtures';
import testData from './fixtures/yieldTokenizeAndRedeem.scenario.json';

import { waffle } from 'hardhat';
const { loadFixture, provider } = waffle;

interface YieldTest {
  type: string;
  user: number;
  amount: number;
  timeDelta: number;
}

describe('compound-xyt-interest', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;

  let router: Contract;
  let cOt: Contract;
  let cUSDT: Contract;
  let cForge: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let tokenUSDT: Token;

  before(async () => {
    const fixture = await loadFixture(routerFixture);
    globalSnapshotId = await evm_snapshot();

    router = fixture.core.router;
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
      consts.HIGH_GAS_OVERRIDE
    );
  }

  async function redeemUnderlying(user: Wallet, amount: BN) {
    await router
      .connect(user)
      .redeemUnderlying(
        consts.FORGE_COMPOUND,
        tokenUSDT.address,
        consts.T0_C.add(consts.SIX_MONTH),
        amount,
        consts.HIGH_GAS_OVERRIDE
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
        consts.HIGH_GAS_OVERRIDE
      );
  }

  async function addFakeIncome(token: Token, user: Wallet, amount: BN) {
    await mint(token, user, amount);
    let USDTcontract = await getERC20Contract(user, token);
    USDTcontract.connect(user).transfer(cUSDT.address, amountToWei(amount, token.decimal));
  }

  async function runTest(yieldTest: YieldTest[]) {
    let curTime = consts.T0;
    for (let id = 0; id < yieldTest.length; id++) {
      let curTest = yieldTest[id];
      let user = wallets[curTest.user];
      curTime = curTime.add(BN.from(curTest.timeDelta));
      await setTimeNextBlock(curTime);
      if (curTest.type == 'redeemDueInterests') {
        await redeemDueInterests(user);
      } else if (curTest.type == 'redeemUnderlying') {
        await redeemUnderlying(user, BN.from(curTest.amount));
      } else if (curTest.type == 'tokenizeYield') {
        await tokenizeYield(user, BN.from(curTest.amount));
      } else if (curTest.type == 'redeemUnderlyingAll') {
        let balance = await cOt.balanceOf(user.address);
        await redeemUnderlying(user, balance);
      }
      await addFakeIncome(tokens.USDT, eve, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    }
    await cUSDT.balanceOfUnderlying(cForge.address);
    await cUSDT.balanceOfUnderlying(alice.address);
    await cUSDT.balanceOfUnderlying(bob.address);
    await cUSDT.balanceOfUnderlying(dave.address);
    await cUSDT.balanceOfUnderlying(charlie.address);

    const expectedBalance = await cUSDT.callStatic.balanceOfUnderlying(dave.address);
    const allowedDelta = expectedBalance.div(10 ** 6 / 2); // 5e-5 % delta

    approxBigNumber(await cUSDT.callStatic.balanceOfUnderlying(alice.address), expectedBalance, BN.from(2 * 10 ** 6));
    approxBigNumber(await cUSDT.callStatic.balanceOfUnderlying(bob.address), expectedBalance, BN.from(2 * 10 ** 6));
    approxBigNumber(await cUSDT.callStatic.balanceOfUnderlying(charlie.address), expectedBalance, BN.from(2 * 10 ** 6));
  }
  it('test 1', async () => {
    await runTest((<any>testData).test1);
  });
  it('test 2', async () => {
    await runTest((<any>testData).test2);
  });

  xit('stress 1 [only enable when necessary]', async () => {
    await runTest((<any>testData).stress1);
  });
  xit('stress 2 [only enable when necessary]', async () => {
    await runTest((<any>testData).stress2);
  });
});
