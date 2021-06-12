import chai, { expect } from 'chai';
import { solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import { addMarketLiquidityDual, bootstrapMarket, consts, emptyToken, evm_revert, evm_snapshot, logTokenBalance, mint, mintAaveV2Token, mintCompoundToken, tokenizeYield, tokens } from '../../helpers';
import { Mode, TestEnv, liquidityMiningFixture, LiquidityMiningFixture, parseTestEnvLiquidityMiningFixture } from '../fixtures';
const { waffle } = require('hardhat');
chai.use(solidity);

const { loadFixture, provider } = waffle;

/// TODO: Modify this test to new format
export async function runTest(mode: Mode) {
  const wallets = provider.getWallets();
  const refAmount = BN.from(10 ** 9);
  const [alice, bob, charlie, dave, eve] = wallets;

  let env: TestEnv = {} as TestEnv;
  let snapshotId: string;
  let globalSnapshotId: string;

  async function buildCommonEnv() {
    let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
    await parseTestEnvLiquidityMiningFixture(alice, mode, env, fixture);
    console.log(`\tLoaded routerFixture`);
  }

  before(async () => {
    await buildCommonEnv();
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

  async function checkWithdraw(contract: Contract, allowedTokens: Contract[], disallowedTokens: Contract[]): Promise<void> {
    const testAmount = BN.from(100000);
    for(let person of [alice, bob]) {
      for(let token of allowedTokens) {
        if (token.address != contract.address){
          await token.connect(person).transfer(contract.address, testAmount, consts.HG);
        }
        await contract.connect(alice).withdrawToken(token.address, testAmount, alice.address, consts.HG);
      }
      for(let token of disallowedTokens) {
        if (token.address != contract.address){
          await token.connect(person).transfer(contract.address, testAmount, consts.HG);
        }
        await expect(
          contract.connect(alice).withdrawToken(token.address, testAmount, alice.address, consts.HG)
        ).to.be.reverted;
      }
    }
  }

  async function distributeTokensEvenly(): Promise<void> {
    const tokensToTest: Contract[] = [env.testToken, env.pdl, env.xyt, env.ot, env.market, env.yToken];

    // Prepare yeild token, marketToken
    for(let person of wallets) {
      if (mode == Mode.AAVE_V2) {
        await mintAaveV2Token(tokens.USDT, person, refAmount.mul(3));
      }
      else {
        await mintCompoundToken(tokens.USDT, person, refAmount.mul(3));
      }
      await env.yToken.connect(person).approve(env.router.address, refAmount.mul(2));
      await tokenizeYield(env, person, refAmount.mul(2));
      await addMarketLiquidityDual(env, person, refAmount);
    }

    for (let token of tokensToTest) {
      for(let person of [alice, bob]) {
        await emptyToken(token, person);
      }
      const balance: BN = (await token.balanceOf(eve.address));
      for(let person of [alice, bob]) {
        await token.connect(eve).transfer(person.address, balance.div(5), consts.HG);
      }
    }
  }

  it("should be able to withdraw allowed (and not for disallowed) tokens", async () => {
    const tokensToTest: Contract[] = [env.testToken, env.pdl, env.xyt, env.ot, env.market, env.yToken];
    await distributeTokensEvenly();
    await checkWithdraw(env.market, [env.ot, env.pdl], [env.testToken, env.xyt, env.market, env.yToken]);
    await checkWithdraw(env.liq, [env.testToken, env.xyt, env.ot, env.market, env.yToken], [env.pdl]);
    for(let contract of [env.forge, env.rewardManager, env.router]) {
      await checkWithdraw(contract, tokensToTest, []);
    }
  });
}
