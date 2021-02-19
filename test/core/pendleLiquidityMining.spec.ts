import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import PendleLiquidityMining from "../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import {
  advanceTime,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  tokens,
} from "../helpers";
import { liqParams, pendleLiquidityMiningFixture } from "./fixtures";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleLiquidityMining", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob] = wallets;
  let lendingPoolCore: Contract;
  let pendleLiquidityMining: Contract;
  let pdl: Contract;
  let aUSDT: Contract;
  let params: liqParams;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleLiquidityMiningFixture);
    lendingPoolCore = fixture.aave.lendingPoolCore;
    pendleLiquidityMining = fixture.pendleLiquidityMining;
    params = fixture.params;
    aUSDT = await getAContract(alice, lendingPoolCore, tokens.USDT);
    pdl = fixture.pdl;
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("can stake and withdraw", async () => {
    const FIFTEEN_DAYS = consts.ONE_DAY.mul(15);

    const amountToStake = params.INITIAL_LP_AMOUNT; //1e17 LP = 0.1 LP

    const pdlBalanceOfContract = await pdl.balanceOf(
      pendleLiquidityMining.address
    );
    const pdlBalanceOfUser = await pdl.balanceOf(bob.address);

    console.log(
      `\tPDL balance of PendleLiquidityMining contract before: ${pdlBalanceOfContract}`
    );
    console.log(`\tPDL balance of user before: ${pdlBalanceOfUser}`);
    console.log(`\tLP balance of user before: ${pdlBalanceOfUser}`);

    await advanceTime(provider, params.START_TIME.sub(consts.T0));
    await pendleLiquidityMining
      .connect(bob)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );
    console.log("\tStaked");
    const lpHolderContract = await pendleLiquidityMining.lpHolderForExpiry(
      consts.T0.add(consts.SIX_MONTH)
    );
    const aTokenBalanceOfLpHolderContract = await aUSDT.balanceOf(
      lpHolderContract
    );
    const aTokenBalanceOfUser = await aUSDT.balanceOf(bob.address);
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after first staking = ${aTokenBalanceOfLpHolderContract}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of User after first staking = ${aTokenBalanceOfUser}`
    );

    await advanceTime(provider, FIFTEEN_DAYS);
    await pendleLiquidityMining
      .connect(bob)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );

    const pdlBalanceOfContractAfter = await pdl.balanceOf(
      pendleLiquidityMining.address
    );
    const pdlBalanceOfUserAfter = await pdl.balanceOf(bob.address);
    const expectedPdlBalanceOfUserAfter = params.REWARDS_PER_EPOCH.div(4);
    console.log(
      `\tPDL balance of PendleLiquidityMining contract after: ${pdlBalanceOfContractAfter}`
    );
    console.log(`\tPDL balance of user after: ${pdlBalanceOfUserAfter}`);
    console.log(
      `\tExpected PDL balance of user after: ${expectedPdlBalanceOfUserAfter}`
    );

    // we need to do this properly
    expect(pdlBalanceOfUserAfter.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUserAfter.toNumber(),
      expectedPdlBalanceOfUserAfter.toNumber() / 1000
    );

    //stake using another user - alice, for the same amount as bob's stake now (amountToStake/2)
    await pendleLiquidityMining.stake(
      consts.T0.add(consts.SIX_MONTH),
      amountToStake.div(2),
      consts.HIGH_GAS_OVERRIDE
    );

    // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for bob should be:
    // From epoch 1: rewardsPerEpoch * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
    // From epoch 2: (rewardsPerEpoch/2 + rewardsPerEpoch/2/2) * 2/4  ( first half: get all the rewards = rewardsPerEpoch/2, 2nd half: get half)
    // From epoch 3: rewardsPerEpoch/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsPerEpoch/2)
    //  Total: rewardsPerEpoch * (1/2 + 3/8 + 1/8) = rewardsPerEpoch
    await advanceTime(provider, FIFTEEN_DAYS);

    // console.log(`abi = ${PendleLiquidityMining.abi}`);
    // console.log(pendleLiquidityMining);

    const pendleLiquidityMiningWeb3 = new hre.web3.eth.Contract(
      PendleLiquidityMining.abi,
      pendleLiquidityMining.address
    );
    const rewardsData = await pendleLiquidityMiningWeb3.methods
      .claimRewards()
      .call({ from: alice.address });
    const interestsData = await pendleLiquidityMiningWeb3.methods
      .claimLpInterests()
      .call({ from: alice.address });
    console.log(`\tInterests for alice = ${interestsData}`);
    console.log(`\tRewards available for epochs from now: ${rewardsData}`);

    await pendleLiquidityMining
      .connect(bob)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );
    const pdlBalanceOfUserAfter2ndTnx = await pdl.balanceOf(bob.address);
    const expectedPdlBalanceOfUsersAfter2ndTnx = expectedPdlBalanceOfUserAfter.add(
      params.REWARDS_PER_EPOCH
    );
    console.log(
      `\tPDL balance of user after 2nd withdraw: ${pdlBalanceOfUserAfter2ndTnx}`
    );
    console.log(
      `\tExpected PDL balance of user after 2nd withdraw: ${expectedPdlBalanceOfUsersAfter2ndTnx}`
    );

    expect(pdlBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber(),
      expectedPdlBalanceOfUsersAfter2ndTnx.toNumber() / 1000
    );

    await pendleLiquidityMining.withdraw(
      consts.T0.add(consts.SIX_MONTH),
      amountToStake.div(2),
      consts.HIGH_GAS_OVERRIDE
    );
    const aTokenBalanceOfLpHolderContractAfter = await aUSDT.balanceOf(
      lpHolderContract
    );
    const aTokenBalanceOfUserAfter = await aUSDT.balanceOf(bob.address);

    //now, the LP holding contract should hold almost 0 aUSDT. This means that we have calculated and gave the Lp interests back to the users properly
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after withdrawing all = ${aTokenBalanceOfLpHolderContractAfter}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of user after withdrawing all = ${aTokenBalanceOfUserAfter}`
    );
  });
});
