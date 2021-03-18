import { expect } from "chai";
import { BigNumber as BN, Contract } from "ethers";
import { consts, evm_revert, evm_snapshot, setTimeNextBlock } from "../helpers";
import PENDLE from "../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import PendleTokenDistribution from "../../build/artifacts/contracts/core/PendleTokenDistribution.sol/PendleTokenDistribution.json";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

describe("PENDLE", async () => {
  const wallets = provider.getWallets();
  const [
    governance,
    bob,
    charlie,
    salesMultisig,
    liqIncentivesRecipient,
  ] = wallets;
  const newEmissionRateMultiplierNumerator = BN.from(123456);
  const newTerminalInflationRateNumerator = BN.from(123123);
  const newLiquidityIncentivesRecipient = consts.DUMMY_ADDRESS;
  const initiateConfigChangesTimestamp = consts.PENDLE_START_TIME.add(20000);

  let pendle: Contract;
  let teamTokensContract: Contract;
  let ecosystemFundContract: Contract;
  let snapshotId: string;
  let globalSnapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    teamTokensContract = await deployContract(
      governance,
      PendleTokenDistribution,
      [
        governance.address,
        [
          consts.ONE_QUARTER,
          consts.ONE_QUARTER.mul(2),
          consts.ONE_QUARTER.mul(3),
          consts.ONE_QUARTER.mul(4),
          consts.ONE_QUARTER.mul(5),
          consts.ONE_QUARTER.mul(6),
          consts.ONE_QUARTER.mul(7),
          consts.ONE_QUARTER.mul(8),
        ],
        [
          consts.INVESTOR_AMOUNT.add(consts.ADVISOR_AMOUNT).div(4),
          consts.INVESTOR_AMOUNT.add(consts.ADVISOR_AMOUNT).div(4),
          consts.INVESTOR_AMOUNT.add(consts.ADVISOR_AMOUNT).div(4),
          consts.INVESTOR_AMOUNT.add(consts.ADVISOR_AMOUNT)
            .div(4)
            .add(consts.TEAM_AMOUNT.div(2)),
          consts.TEAM_AMOUNT.div(8),
          consts.TEAM_AMOUNT.div(8),
          consts.TEAM_AMOUNT.div(8),
          consts.TEAM_AMOUNT.div(8),
        ],
      ]
    );
    ecosystemFundContract = await deployContract(
      governance,
      PendleTokenDistribution,
      [
        governance.address,
        [BN.from(0), consts.ONE_QUARTER.mul(4)],
        [
          consts.ECOSYSTEM_FUND_TOKEN_AMOUNT.div(2),
          consts.ECOSYSTEM_FUND_TOKEN_AMOUNT.div(2),
        ],
      ]
    );

    await setTimeNextBlock(provider, consts.PENDLE_START_TIME);
    pendle = await deployContract(governance, PENDLE, [
      governance.address,
      teamTokensContract.address,
      ecosystemFundContract.address,
      salesMultisig.address,
      liqIncentivesRecipient.address,
    ]);
    await teamTokensContract.initialize(pendle.address);
    await ecosystemFundContract.initialize(pendle.address);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should mint correct amounts after deployment", async () => {
    const totalSupply = await pendle.totalSupply();
    const teamTokensBalance = await pendle.balanceOf(
      teamTokensContract.address
    );
    const ecosystemFundBalance = await pendle.balanceOf(
      ecosystemFundContract.address
    );
    const salesMultisigBalance = await pendle.balanceOf(salesMultisig.address);
    const liqIncentivesRecipientBalance = await pendle.balanceOf(
      liqIncentivesRecipient.address
    );

    expect(teamTokensBalance).to.be.eq(consts.TEAM_INVESTOR_ADVISOR_AMOUNT);
    expect(ecosystemFundBalance).to.be.eq(consts.ECOSYSTEM_FUND_TOKEN_AMOUNT);
    expect(salesMultisigBalance).to.be.eq(consts.PUBLIC_SALES_TOKEN_AMOUNT);
    expect(liqIncentivesRecipientBalance).to.be.eq(
      consts.INITIAL_LIQUIDITY_EMISSION.mul(26)
    );
    expect(totalSupply).to.be.eq(
      consts.INITIAL_LIQUIDITY_EMISSION.mul(26)
        .add(consts.TEAM_INVESTOR_ADVISOR_AMOUNT)
        .add(consts.ECOSYSTEM_FUND_TOKEN_AMOUNT)
        .add(consts.PUBLIC_SALES_TOKEN_AMOUNT)
    );
    expect(await pendle.startTime()).to.be.eq(consts.PENDLE_START_TIME);
    expect(await pendle.lastWeekEmissionSent()).to.be.eq(BN.from(26));
  });
  it("should be able to initiateConfigChanges", async () => {
    await setTimeNextBlock(provider, initiateConfigChangesTimestamp);
    await pendle.initiateConfigChanges(
      newEmissionRateMultiplierNumerator,
      newTerminalInflationRateNumerator,
      newLiquidityIncentivesRecipient
    );

    expect(await pendle.pendingEmissionRateMultiplierNumerator()).to.be.eq(
      newEmissionRateMultiplierNumerator
    );
    expect(await pendle.pendingTerminalInflationRateNumerator()).to.be.eq(
      newTerminalInflationRateNumerator
    );
    expect(await pendle.pendingLiquidityIncentivesRecipient()).to.be.eq(
      newLiquidityIncentivesRecipient
    );
    expect(await pendle.configChangesInitiated()).to.be.eq(
      initiateConfigChangesTimestamp
    );
  });
  it("should not be able to initiateConfigChanges from non-governance", async () => {
    await expect(
      pendle
        .connect(salesMultisig)
        .initiateConfigChanges(
          newEmissionRateMultiplierNumerator,
          newTerminalInflationRateNumerator,
          newLiquidityIncentivesRecipient
        )
    ).to.be.revertedWith(
      "VM Exception while processing transaction: revert ONLY_GOVERNANCE"
    );
  });
  it("should be able to applyConfigChanges", async () => {
    await setTimeNextBlock(provider, initiateConfigChangesTimestamp);
    await pendle.initiateConfigChanges(
      newEmissionRateMultiplierNumerator,
      newTerminalInflationRateNumerator,
      newLiquidityIncentivesRecipient
    );
    await setTimeNextBlock(
      provider,
      initiateConfigChangesTimestamp.add(consts.CONFIG_CHANGES_TIME_LOCK).add(1)
    );
    await pendle.connect(salesMultisig).applyConfigChanges(); // Anyone can call this
    expect(await pendle.emissionRateMultiplierNumerator()).to.be.eq(
      newEmissionRateMultiplierNumerator
    );
    expect(await pendle.terminalInflationRateNumerator()).to.be.eq(
      newTerminalInflationRateNumerator
    );
    expect(await pendle.liquidityIncentivesRecipient()).to.be.eq(
      newLiquidityIncentivesRecipient
    );
    expect(await pendle.configChangesInitiated()).to.be.eq(BN.from(0));
  });
  it("should not be able to applyConfigChanges within timelock", async () => {
    await setTimeNextBlock(provider, initiateConfigChangesTimestamp);
    await pendle.initiateConfigChanges(
      newEmissionRateMultiplierNumerator,
      newTerminalInflationRateNumerator,
      newLiquidityIncentivesRecipient
    );
    await setTimeNextBlock(
      provider,
      initiateConfigChangesTimestamp.add(consts.CONFIG_CHANGES_TIME_LOCK)
    );
    await expect(
      pendle.connect(salesMultisig).applyConfigChanges()
    ).to.be.revertedWith(
      "VM Exception while processing transaction: revert TIMELOCK_IS_NOT_OVER"
    );
  });
  it("should be able to claimLiquidityEmissions until current week", async () => {
    let weeklyEmission = await pendle.lastWeeklyEmission();
    expect(weeklyEmission).to.be.eq(consts.INITIAL_WEEKLY_EMISSION);
    let totalSupply = await pendle.totalSupply();

    const week316start = consts.ONE_WEEK.mul(315).add(consts.PENDLE_START_TIME);
    await setTimeNextBlock(provider, week316start);
    const balanceBefore = await pendle.balanceOf(
      liqIncentivesRecipient.address
    );
    await pendle.connect(liqIncentivesRecipient).claimLiquidityEmissions();
    const balanceAfter = await pendle.balanceOf(liqIncentivesRecipient.address);

    let expectedGain = BN.from(0);

    for (let i = 27; i <= 259; i++) {
      weeklyEmission = weeklyEmission.mul(989).div(1000); // -1.1% weekly
      expectedGain = expectedGain.add(weeklyEmission);
      // console.log(`\t week = ${i}, weeklyEmission = ${weeklyEmission}`);
    }
    totalSupply = totalSupply.add(expectedGain); // add the emissions until now

    for (let i = 260; i <= 316; i++) {
      weeklyEmission = totalSupply.mul(379848538).div(BN.from(1000000000000)); // 0.03798485380917%
      totalSupply = totalSupply.add(weeklyEmission);
      expectedGain = expectedGain.add(weeklyEmission);
      // console.log(`\t week = ${i}, weeklyEmission = ${weeklyEmission}`);
    }

    expect(balanceAfter).to.be.eq(balanceBefore.add(expectedGain));
    expect(await pendle.totalSupply()).to.be.eq(totalSupply);
    expect(await pendle.lastWeekEmissionSent()).to.be.eq(BN.from(316));
  });
  it("should be able to delegate and transfer PENDLE", async () => {
    const testAmount = BN.from(13).mul(consts.ONE_E_18);
    await pendle
      .connect(salesMultisig)
      .transfer(consts.DUMMY_ADDRESS, testAmount, consts.HIGH_GAS_OVERRIDE);

    await pendle.delegate(governance.address, consts.HIGH_GAS_OVERRIDE);
    const balanceBefore = await pendle.balanceOf(salesMultisig.address);

    await pendle
      .connect(salesMultisig)
      .transfer(consts.DUMMY_ADDRESS, testAmount, consts.HIGH_GAS_OVERRIDE);
    const balanceAfter = await pendle.balanceOf(salesMultisig.address);
    expect(balanceAfter).to.be.eq(balanceBefore.sub(testAmount));
  });
  it("should be able to claim half ecosystem fund after launch, only once", async () => {
    const balanceBefore = await pendle.balanceOf(governance.address);
    await ecosystemFundContract.claimTokens(BN.from(0));
    const balanceAfter = await pendle.balanceOf(governance.address);
    expect(balanceAfter).to.be.eq(
      balanceBefore.add(consts.ECOSYSTEM_FUND_TOKEN_AMOUNT.div(2))
    );
    await expect(
      ecosystemFundContract.claimTokens(BN.from(0))
    ).to.be.revertedWith(
      "VM Exception while processing transaction: revert ALREADY_CLAIMED"
    );
  });
  it("shouldn't be able to claim second half of ecosystem fund after launch", async () => {
    await expect(
      ecosystemFundContract.claimTokens(BN.from(1))
    ).to.be.revertedWith(
      "VM Exception while processing transaction: revert NOT_CLAIMABLE_YET"
    );
  });
  it("should be able to claim team tokens after one quarter", async () => {
    const balanceBefore = await pendle.balanceOf(governance.address);
    await setTimeNextBlock(
      provider,
      consts.PENDLE_START_TIME.add(consts.ONE_QUARTER)
    );
    await teamTokensContract.claimTokens(BN.from(0));
    const balanceAfter = await pendle.balanceOf(governance.address);
    expect(balanceAfter).to.be.eq(
      balanceBefore.add(
        consts.INVESTOR_AMOUNT.add(consts.ADVISOR_AMOUNT).div(4)
      )
    );
  });
});
