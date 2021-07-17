import { assert, expect } from 'chai';
import { BigNumber as BN, Contract, Wallet } from 'ethers';
import hre from 'hardhat';
import {
  approxBigNumber,
  approxByPercent,
  calcExpectedRewards,
  consts,
  errMsg,
  evm_revert,
  evm_snapshot,
  logTokenBalance,
  mineBlock,
  mintSushiswapLpFixed,
  randomBN,
  randomNumber,
  redeemRewards,
  setTime,
  setTimeNextBlock,
  stake,
  stakeWithPermit,
  startOfEpoch,
  withdraw,
} from '../helpers';
import {
  liquidityMiningFixture,
  LiquidityMiningFixture,
  Mode,
  parseTestEnvLiquidityMiningFixture,
  TestEnv,
  UserStakeAction,
} from './fixtures';
import * as scenario from './fixtures/liquidityMiningScenario.fixture';
const { waffle } = require('hardhat');

const { loadFixture, provider } = waffle;

describe('base-liquidity-mining-V2-rewards', async () => {
  const wallets = provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: TestEnv = {} as TestEnv;
  let masterchef: Contract;
  let sushiToken: Contract;
  const REF_AMOUNT = BN.from("1000000");

  async function buildTestEnv() {
    let fixture: LiquidityMiningFixture = await loadFixture(liquidityMiningFixture);
    await parseTestEnvLiquidityMiningFixture(alice, Mode.SUSHISWAP_LIQ_V2, env, fixture);
  }

  before(async () => {
    await buildTestEnv();
    sushiToken = await hre.ethers.getContractAt('IERC20', consts.SUSHI_ADDRESS);
    masterchef = await hre.ethers.getContractAt('IMasterChef', consts.MASTERCHEF_V1_ADDRESS);
    globalSnapshotId = await evm_snapshot();
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
    for(let person of wallets) {
      await mintSushiswapLpFixed(person);
      await env.yToken.connect(person).approve(masterchef.address, consts.INF, consts.HG);
      await env.yToken.connect(person).approve(env.liq.address, consts.INF, consts.HG);
    }
    await setTimeNextBlock(env.liqParams.START_TIME);
  });

  it("Simple test", async() => {

    let balanceBefore: BN[] = [];

    for(let i = 0; i < wallets.length; ++i) {
      await masterchef.connect(wallets[i]).deposit(consts.SUSHI_USDT_WETH_PID, REF_AMOUNT.mul(i + 1), consts.HG);
    }
    await mineBlock();
    await mineBlock();
    await mineBlock();
    await mineBlock();

    for(let i = 0; i < wallets.length; ++i) {
      await masterchef.connect(wallets[i]).withdraw(consts.SUSHI_USDT_WETH_PID, REF_AMOUNT.mul(i + 1), consts.HG);
      balanceBefore.push((await sushiToken.balanceOf(wallets[i].address)));
    }

    let balanceAfter: BN[] = [];
    for(let i = 0; i < wallets.length; ++i) {
      await stake(env, wallets[i], REF_AMOUNT.mul(i + 1));
    }

    await mineBlock();
    await mineBlock();
    await mineBlock();
    await mineBlock();


    for(let person of wallets) {
      await env.liq.redeemDueInterests(person.address, consts.HG);
      balanceAfter.push((await sushiToken.balanceOf(person.address)));
    }

    for(let i = 0; i < wallets.length; ++i) {
      approxBigNumber(
        balanceAfter[i].div(2),
        balanceBefore[i],
        10,
        true
      );
    }
  });

  it("Stress test", async() => {
    async function _stake(isToMasterChef: boolean, person: Wallet, amount: BN): Promise<void> {
      if (isToMasterChef) {
        await masterchef.connect(person).deposit(consts.SUSHI_USDT_WETH_PID, amount, consts.HG);
      }
      else {
        await stake(env, person, amount);
      }
    }

    async function _redeemDueInterests(isToMasterChef: boolean, person: Wallet): Promise<void> {
      if (isToMasterChef) {
        await masterchef.connect(person).withdraw(consts.SUSHI_USDT_WETH_PID, 0, consts.HG);
      }
      else {
        await env.liq.redeemDueInterests(person.address, consts.HG);
      }
    }

    async function _withdraw(isToMasterChef: boolean, person: Wallet, amount: BN): Promise<void> {
      if (isToMasterChef) {
        await masterchef.connect(person).withdraw(consts.SUSHI_USDT_WETH_PID, amount, consts.HG);
      }
      else {
        await withdraw(env, person, amount);
      }
    }

    let liqBalance: BN[] = [BN.from(0), BN.from(0), BN.from(0), BN.from(0)];
    let lpBalance: BN[] = [];
    for (let i = 0; i < 4; i++) lpBalance.push((await env.yToken.balanceOf(wallets[i].address)).div(10000));

    for (let i = 1; i <= 50; i++) {
      let userID = randomNumber(2);
      let smltID = userID + 2;
      let actionType: number = randomNumber(3);
      if (liqBalance[userID].eq(0)) {
        actionType = 0;
      }
      if (actionType == 0) {
        let amount = randomBN(lpBalance[userID]);
        await _stake(true, wallets[smltID], amount);
        await _stake(false, wallets[userID], amount);
        liqBalance[userID] = liqBalance[userID].add(amount);
        lpBalance[userID] = lpBalance[userID].sub(amount);
      } else if (actionType == 1) {
        let amount = randomBN(liqBalance[userID]);
        await _withdraw(true, wallets[smltID], amount);
        await _withdraw(false, wallets[userID], amount);
        liqBalance[userID] = liqBalance[userID].sub(amount);
        lpBalance[userID] = lpBalance[userID].add(amount);
      } else {
        await mineBlock();
      }
    }


    for (let i = 0; i < 2; i++) {
      await _redeemDueInterests(true, wallets[i + 2]);
      await _redeemDueInterests(false, wallets[i]);

      approxByPercent(
        await sushiToken.balanceOf(wallets[i].address),
        await sushiToken.balanceOf(wallets[i + 2].address),
        BN.from(10000)
      );
    }
  })
});
