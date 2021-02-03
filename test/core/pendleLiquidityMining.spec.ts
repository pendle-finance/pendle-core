import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import PendleLiquidityMining from "../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import PENDLE from "../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";

import { pendleMarketFixture } from "./fixtures";
import {
  advanceTime,
  amountToWei,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  tokens,
} from "../helpers";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleLiquidityMining", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet, wallet1] = wallets;
  let pendleRouter: Contract;
  let pendleTreasury: Contract;
  let pendleMarketFactory: Contract;
  let pendleData: Contract;
  let pendleOt: Contract;
  let pendleXyt: Contract;
  let lendingPoolCore: Contract;
  let pendleAaveForge: Contract;
  let pendleMarket: Contract;
  let pendleLiquidityMining: Contract;
  let pendle: Contract;
  let testToken: Contract;
  let aUSDT: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;
  let liquidityMiningParameters = {
    startTime: consts.T0.add(1000), // starts in 1000s
    epochDuration: BN.from(3600 * 24 * 10), //10 days
    rewardsPerEpoch: BN.from("10000000000"), // 1e10
    numberOfEpochs: BN.from(20),
    vestingEpochs: BN.from(4),
  };

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    const fixture = await loadFixture(pendleMarketFixture);
    pendleRouter = fixture.router.pendleRouter;
    pendleTreasury = fixture.router.pendleTreasury;
    pendleMarketFactory = fixture.router.pendleMarketFactory;
    pendleData = fixture.router.pendleData;
    pendleOt = fixture.forge.pendleOwnershipToken;
    pendleXyt = fixture.forge.pendleFutureYieldToken;
    pendleAaveForge = fixture.forge.pendleAaveForge;
    lendingPoolCore = fixture.aave.lendingPoolCore;
    testToken = fixture.testToken;
    aUSDT = await getAContract(wallet, lendingPoolCore, tokens.USDT);

    const amountToTokenize = amountToWei(tokens.USDT, BN.from(100));

    // TODO: make a fixture for PendleLiquidityMining, and set up a few (maybe 2) markets with different expiries
    // to participate in liquidity mining.
    await pendle.bootStrapMarket(
      consts.FORGE_AAVE,
      consts.MARKET_FACTORY_AAVE,
      pendleXyt.address,
      testToken.address,
      amountToTokenize,
      amountToTokenize,
      consts.HIGH_GAS_OVERRIDE
    );

    pendle = await deployContract(wallet, PENDLE, [wallet.address]);
    
    console.log("deploying");
    pendleLiquidityMining = await deployContract(
      wallet,
      PendleLiquidityMining,
      [
        wallet.address,
        pendle.address,
        pendleData.address,
        pendleMarketFactory.address,
        pendleAaveForge.address,
        tokens.USDT.address,
        testToken.address,
        liquidityMiningParameters.startTime,
        liquidityMiningParameters.epochDuration,
        liquidityMiningParameters.rewardsPerEpoch,
        liquidityMiningParameters.numberOfEpochs,
        liquidityMiningParameters.vestingEpochs,
      ]
    );
    console.log("deployed");
    console.log("deployed liquidity mining contract");

    await pendle.approve(
      pendleLiquidityMining.address,
      consts.MAX_ALLOWANCE
    );
    await pendleMarket.approve(
      pendleLiquidityMining.address,
      consts.MAX_ALLOWANCE
    );
    await pendleMarket
      .connect(wallet1)
      .approve(pendleLiquidityMining.address, consts.MAX_ALLOWANCE);
    // wallet has some LP now
    await pendleLiquidityMining.fund();

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
    const TEN_DAYS = BN.from(3600 * 24 * 10);
    const FIFTEEN_DAYS = BN.from(3600 * 24 * 15);
    const THIRTY_DAYS = BN.from(3600 * 24 * 30);

    const amountToStake = BN.from("100000000000000000"); //1e17 LP = 0.1 LP

    await pendleMarket.transfer(wallet1.address, amountToStake);
    const pendleBalanceOfContract = await pendle.balanceOf(
      pendleLiquidityMining.address
    );
    const pendleBalanceOfUser = await pendle.balanceOf(wallet1.address);
    const lpBalanceOfUser = await pendleMarket.balanceOf(wallet1.address);

    console.log(
      `\tPENDLE balance of PendleLiquidityMining contract before: ${pendleBalanceOfContract}`
    );
    console.log(`\tPENDLE balance of user before: ${pendleBalanceOfUser}`);
    console.log(`\tLP balance of user before: ${pendleBalanceOfUser}`);

    await advanceTime(
      provider,
      liquidityMiningParameters.startTime.sub(consts.T0)
    );
    await pendleLiquidityMining
      .connect(wallet1)
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
    const aTokenBalanceOfUser = await aUSDT.balanceOf(wallet1.address);
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after first staking = ${aTokenBalanceOfLpHolderContract}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of User after first staking = ${aTokenBalanceOfUser}`
    );

    await advanceTime(provider, FIFTEEN_DAYS);
    await pendleLiquidityMining
      .connect(wallet1)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );

    const pendleBalanceOfContractAfter = await pendle.balanceOf(
      pendleLiquidityMining.address
    );
    const pendleBalanceOfUserAfter = await pendle.balanceOf(wallet1.address);
    const expectedPdlBalanceOfUserAfter = liquidityMiningParameters.rewardsPerEpoch.div(
      BN.from(4)
    );
    console.log(
      `\tPENDLE balance of PendleLiquidityMining contract after: ${pendleBalanceOfContractAfter}`
    );
    console.log(`\tPENDLE balance of user after: ${pendleBalanceOfUserAfter}`);
    console.log(
      `\tExpected PENDLE balance of user after: ${expectedPdlBalanceOfUserAfter}`
    );

    // we need to do this properly
    expect(pendleBalanceOfUserAfter.toNumber()).to.be.approximately(
      expectedPdlBalanceOfUserAfter.toNumber(),
      expectedPdlBalanceOfUserAfter.toNumber() / 1000
    );

    //stake using another user - wallet, for the same amount as wallet1's stake now (amountToStake/2)
    await pendleLiquidityMining.stake(
      consts.T0.add(consts.SIX_MONTH),
      amountToStake.div(2),
      consts.HIGH_GAS_OVERRIDE
    );

    // Now we wait for another 15 days to withdraw (at the very start of epoch 4), then the rewards to be withdrawn for wallet1 should be:
    // From epoch 1: rewardsPerEpoch * 2/4    ( 1/4 is released at start of epoch 3, 1/4 is released at start of epoch 4)
    // From epoch 2: (rewardsPerEpoch/2 + rewardsPerEpoch/2/2) * 2/4  ( first half: get all the rewards = rewardsPerEpoch/2, 2nd half: get half)
    // From epoch 3: rewardsPerEpoch/2 * 1/4  ( two stakers with the same stake & duration => each gets rewardsPerEpoch/2)
    //  Total: rewardsPerEpoch * (1/2 + 3/8 + 1/8) = rewardsPerEpoch
    await advanceTime(provider, FIFTEEN_DAYS);

    // console.log(`abi = ${PendleLiquidityMining.abi}`);
    // console.log(pendleLiquidityMining);
    await pendleLiquidityMining.calculateEpochData(BN.from(2)); // Although its already epoch 4, we still need to call this transaction

    const pendleLiquidityMiningWeb3 = new hre.web3.eth.Contract(
      PendleLiquidityMining.abi,
      pendleLiquidityMining.address
    );
    const rewardsData = await pendleLiquidityMiningWeb3.methods
      .claimRewards()
      .call({ from: wallet.address });
    const interestsData = await pendleLiquidityMiningWeb3.methods
      .claimLpInterests()
      .call({ from: wallet.address });
    console.log(`\tInterests for wallet = ${interestsData}`);
    console.log(`\tRewards available for epoches from now: ${rewardsData}`);

    await pendleLiquidityMining
      .connect(wallet1)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake.div(BN.from(2)),
        consts.HIGH_GAS_OVERRIDE
      );
    const pendleBalanceOfUserAfter2ndTnx = await pendle.balanceOf(
      wallet1.address
    );
    const expectedPdlBalanceOfUsersAfter2ndTnx = expectedPdlBalanceOfUserAfter.add(
      liquidityMiningParameters.rewardsPerEpoch
    );
    console.log(
      `\tPENDLE balance of user after 2nd withdraw: ${pendleBalanceOfUserAfter2ndTnx}`
    );
    console.log(
      `\tExpected PENDLE balance of user after 2nd withdraw: ${expectedPdlBalanceOfUsersAfter2ndTnx}`
    );

    expect(pendleBalanceOfUserAfter2ndTnx.toNumber()).to.be.approximately(
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
    const aTokenBalanceOfUserAfter = await aUSDT.balanceOf(wallet1.address);

    //now, the LP holding contract should hold almost 0 aUSDT. This means that we have calculated and gave the Lp interests back to the users properly
    console.log(
      `\t[LP interests] aUSDT balance of LpHolder after withdrawing all = ${aTokenBalanceOfLpHolderContractAfter}`
    );
    console.log(
      `\t[LP interests] aUSDT balance of user after withdrawing all = ${aTokenBalanceOfUserAfter}`
    );
  });
});
