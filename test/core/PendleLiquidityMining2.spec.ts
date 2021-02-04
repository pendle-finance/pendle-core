import { createFixtureLoader } from "ethereum-waffle";
import { BigNumber as BN, Contract } from "ethers";
import {
  advanceTime,
  consts,
  evm_revert,
  evm_snapshot,
  getAContract,
  setTimeNextBlock,
  tokens,
} from "../helpers";
import PendleLiquidityMining from "../../build/artifacts/contracts/core/PendleLiquidityMining.sol/PendleLiquidityMining.json";
import { liqParams, pendleLiquidityMiningFixture } from "./fixtures";

const { waffle } = require("hardhat");
const hre = require("hardhat");
const { deployContract, provider } = waffle;

describe("PendleLiquidityMining", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [alice, bob, charlie, dave] = wallets;
  let lendingPoolCore: Contract;
  let pendleLiq: Contract;
  let pdl: Contract;
  let aUSDT: Contract;
  let params: liqParams;
  let snapshotId: string;
  let globalSnapshotId: string;
  let pendleLiqWeb3: any; // TODO: move this to fixture
  before(async () => {
    globalSnapshotId = await evm_snapshot();
    const fixture = await loadFixture(pendleLiquidityMiningFixture);
    lendingPoolCore = fixture.aave.lendingPoolCore;
    pendleLiq = fixture.pendleLiquidityMining;
    params = fixture.params;
    aUSDT = await getAContract(alice, lendingPoolCore, tokens.USDT);
    pdl = fixture.pdl;
    pendleLiqWeb3 = new hre.web3.eth.Contract(
      PendleLiquidityMining.abi,
      pendleLiq.address
    );
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it.only("this test is failing and it shouldn't fail", async () => {
    const amountToStake = params.INITIAL_LP_AMOUNT;

    await setTimeNextBlock(provider, params.START_TIME);
    console.log("\t\t\t\t\t--------------------------[start of e 1] Staking ");
    await pendleLiq
      .connect(bob)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );

    await setTimeNextBlock(
      provider,
      params.START_TIME.add(params.EPOCH_DURATION)
    );
    // await advanceTime(provider, params.EPOCH_DURATION);
    console.log(
      "\t\t\t\t\t--------------------------[start of e 2] Withdrawing "
    );
    await pendleLiq
      .connect(bob)
      .withdraw(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );
    console.log("Before claimedRewards");
    console.log(
      "pdl balance = ",
      (await pdl.balanceOf(bob.address)).toString()
    );
    console.log(
      "\t\t\t\t\t-------------------------- still start of e2: ClaimingRewards "
    );
    await pendleLiq.connect(bob).claimRewards();
    console.log("claimedRewards");
    console.log(
      "pdl balance = ",
      (await pdl.balanceOf(bob.address)).toString()
    );

    await setTimeNextBlock(
      provider,
      params.START_TIME.add(params.EPOCH_DURATION).add(params.EPOCH_DURATION)
    );
    // await advanceTime(provider, params.EPOCH_DURATION);
    console.log(
      "\t\t\t\t\t--------------------------[start of e 3] ClaimingRewards "
    );
    console.log((await pdl.balanceOf(bob.address)).toString());

    console.log("Before claimedRewards 2");
    await pendleLiq.connect(bob).claimRewards();
    console.log("claimedRewards 2");

    console.log((await pdl.balanceOf(bob.address)).toString());
  });

  it("test 1", async () => {
    const amountToStake = params.INITIAL_LP_AMOUNT;

    await setTimeNextBlock(provider, params.START_TIME);
    await pendleLiq
      .connect(bob)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );
    await pendleLiq
      .connect(charlie)
      .stake(
        consts.T0.add(consts.SIX_MONTH),
        amountToStake,
        consts.HIGH_GAS_OVERRIDE
      );

    await advanceTime(provider, params.EPOCH_DURATION);
    await pendleLiq.connect(bob).claimRewards();
    await pendleLiq.connect(charlie).claimRewards();
    console.log(
      "bob's balance after 1 epoch",
      (await pdl.balanceOf(bob.address)).toString()
    );
    console.log(
      "charlie's balance after 1 epoch",
      (await pdl.balanceOf(charlie.address)).toString()
    );

    await advanceTime(provider, params.EPOCH_DURATION);

    await pendleLiq.connect(bob).claimRewards();
    await pendleLiq.connect(charlie).claimRewards();
    console.log(
      "bob's balance after 2 epoch",
      (await pdl.balanceOf(bob.address)).toString()
    );
    console.log(
      "charlie's balance after 2 epoch",
      (await pdl.balanceOf(charlie.address)).toString()
    );
  });
});
