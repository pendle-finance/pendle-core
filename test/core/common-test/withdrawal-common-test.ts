import { MiscConsts } from '@pendle/constants';
import chai, { expect } from 'chai';
import { loadFixture, solidity } from 'ethereum-waffle';
import { BigNumber as BN, Contract } from 'ethers';
import PendleYieldTokenHolder from '../../../build/artifacts/contracts/core/abstract/PendleYieldTokenHolderBase.sol/PendleYieldTokenHolderBase.json';
import PendleLpHolder from '../../../build/artifacts/contracts/core/PendleLpHolder.sol/PendleLpHolder.json';
import { liquidityMiningFixture, Mode, parseTestEnvLiquidityMiningFixture, TestEnv, wallets } from '../../fixtures';
import {
  addMarketLiquidityDual,
  advanceTime,
  approveAll,
  evm_revert,
  evm_snapshot,
  mintAaveV2Token,
  mintCompoundToken,
  redeemOtRewards,
  stake,
  teConsts,
  tokenizeYield,
} from '../../helpers';

chai.use(solidity);

/// TODO: Modify this test to new format
export async function runTest(mode: Mode) {
  const refAmount = BN.from(10 ** 5);
  const [alice, bob, charlie, dave, eve] = wallets;

  let env: TestEnv = {} as TestEnv;
  let snapshotId: string;
  let globalSnapshotId: string;
  let rewardToken: Contract;

  async function buildCommonEnv() {
    env = await loadFixture(liquidityMiningFixture);
    await parseTestEnvLiquidityMiningFixture(env, mode);
    rewardToken = await getContract('TestToken', await env.forge.rewardToken());
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

  async function checkWithdraw(
    contract: Contract,
    allowedTokens: Contract[],
    disallowedTokens: Contract[]
  ): Promise<void> {
    const testAmount = BN.from(1);
    for (let person of [alice, bob]) {
      for (let token of allowedTokens) {
        if (token.address != contract.address) {
          await token.connect(person).transfer(contract.address, testAmount, teConsts.HG);
        }
        await contract.connect(alice).withdrawToken(token.address, testAmount, alice.address, teConsts.HG);
      }
      for (let token of disallowedTokens) {
        if (token.address != contract.address) {
          await token.connect(person).transfer(contract.address, testAmount, teConsts.HG);
        }
        await expect(contract.connect(alice).withdrawToken(token.address, testAmount, alice.address, teConsts.HG)).to.be
          .reverted;
      }
    }
  }

  async function distributeTokensEvenly(): Promise<void> {
    const tokensToTest: Contract[] = [env.testToken, env.pendle, env.xyt, env.ot, env.market, env.yToken, rewardToken];

    await approveAll([env.yToken], [env.router]);
    // Prepare yeild token, marketToken
    for (let person of wallets) {
      if (mode == Mode.AAVE_V2) {
        await mintAaveV2Token(env, env.ptokens.USDT!, person, refAmount.mul(3));
      } else {
        await mintCompoundToken(env, env.ptokens.USDT!, person, refAmount.mul(3));
      }
      await tokenizeYield(env, person, refAmount.mul(2));
      await addMarketLiquidityDual(env, person, refAmount);
    }

    // redeem rewardToken
    await advanceTime(MiscConsts.ONE_MONTH);
    for (let person of wallets) {
      await redeemOtRewards(env, env.underlyingAsset.address, person);
    }

    // stake to init a lpHolder contract
    await stake(env, charlie, refAmount.div(2));

    for (let token of tokensToTest) {
      for (let person of [alice, bob, charlie, dave]) {
        const bal = await token.connect(person).balanceOf(person.address);
        await token.connect(person).transfer(eve.address, bal, teConsts.HG);
      }
    }

    // distribute tokens to alice and bob
    for (let token of tokensToTest) {
      for (let person of [alice, bob]) {
        await token.connect(eve).transfer(person.address, 1000, teConsts.HG);
      }
    }
  }

  it('should be able to withdraw allowed (and not for disallowed) tokens', async () => {
    await distributeTokensEvenly();

    const tokensToTest: Contract[] = [env.testToken, env.pendle, env.xyt, env.ot, env.market, env.yToken, rewardToken];

    let lpHolderAddress = await env.liq.lpHolderForExpiry(env.EXPIRY);
    let lpHolderContract = new Contract(lpHolderAddress, PendleLpHolder.abi, alice);
    let yieldTokenHolderAddress = await env.forge.yieldTokenHolders(env.underlyingAsset.address, env.EXPIRY);
    let yieldTokenHolderContract = new Contract(yieldTokenHolderAddress, PendleYieldTokenHolder.abi, alice);

    // market disallows (token, xyt, lpToken, yieldToken)
    await checkWithdraw(
      env.market,
      [env.ot, env.pendle, rewardToken],
      [env.testToken, env.xyt, env.market, env.yToken]
    );

    // liquidityMining disallows PENDLE
    await checkWithdraw(env.liq, [env.testToken, env.xyt, env.ot, env.market, env.yToken, rewardToken], [env.pendle]);

    // yieldTokenHolder disallows (rewardToken, yieldToken)
    await checkWithdraw(
      yieldTokenHolderContract,
      [env.testToken, env.pendle, env.xyt, env.ot, env.market],
      [rewardToken, env.yToken]
    );

    // lpHolder disallows (lpToken-market, yieldToken)
    await checkWithdraw(
      lpHolderContract,
      [env.testToken, env.pendle, env.xyt, env.ot, rewardToken],
      [env.market, env.yToken]
    );

    for (let contract of [env.forge, env.rewardManager, env.router]) {
      await checkWithdraw(contract, tokensToTest, []);
    }
  });
}
function getContract(arg0: string, arg1: any): Contract | PromiseLike<Contract> {
  throw new Error('Function not implemented.');
}
