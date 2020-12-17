import chai, { assert, expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";
import BenchmarkAaveForge from "../../artifacts/contracts/core/BenchmarkAaveForge.sol/BenchmarkAaveForge.json";

import { benchmarkcoreFixture } from "./fixtures";
import {
  constants,
  tokens,
  amountToWei,
  getAContract,
  advanceTime,
  getLiquidityRate,
  getGain,
  resetChain,
  evm_revert,
  evm_snapshot,
} from "../helpers";
import { toUtf8CodePoints } from "ethers/lib/utils";

const { waffle } = require("hardhat");
const provider = waffle.provider;
const { deployContract } = waffle;

describe("BenchmarkAave", async () => {
  const wallets = provider.getWallets();
  const loadFixture = createFixtureLoader(wallets, provider);
  const [wallet] = wallets;
  let benchmark: Contract;
  let benchmarkData: Contract;

  let snapshotId: string;
  before(async () => {
    await resetChain();

    const fixture = await loadFixture(benchmarkcoreFixture);
    benchmark = fixture.benchmark;
    benchmarkData = fixture.benchmarkData;
    snapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  it("should be able to create a yield contract", async () => {
    const benchmarkAaveForge = await deployContract(
      wallet,
      BenchmarkAaveForge,
      [
        benchmark.address,
        constants.AAVE_LENDING_POOL_CORE_ADDRESS,
        constants.FORGE_AAVE,
      ]
    );

    await benchmark.addForge(constants.FORGE_AAVE, benchmarkAaveForge.address);

    await benchmarkAaveForge.newYieldContracts(
      tokens.USDT.address,
      constants.TEST_EXPIRY
    );
    const otTokenAddress = await benchmarkData.otTokens(
      constants.FORGE_AAVE,
      tokens.USDT.address,
      constants.TEST_EXPIRY
    );
    let name = await otTokenAddress.name();
    expect(name).eq("USDT....");
  });
});
