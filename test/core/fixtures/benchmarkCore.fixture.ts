import { Contract, Wallet, providers } from 'ethers'
import Benchmark from '../../../build/artifacts/contracts/core/Benchmark.sol/Benchmark.json'
import BenchmarkTreasury from '../../../build/artifacts/contracts/core/BenchmarkTreasury.sol/BenchmarkTreasury.json'
import BenchmarkAaveMarketFactory from "../../../build/artifacts/contracts/core/BenchmarkAaveMarketFactory.sol/BenchmarkAaveMarketFactory.json"
import BenchmarkData from "../../../build/artifacts/contracts/core/BenchmarkData.sol/BenchmarkData.json"
import { constants, tokens } from "../../helpers/Constants"


const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface BenchmarkCoreFixture {
  benchmark: Contract
  benchmarkTreasury: Contract
  benchmarkAaveMarketFactory: Contract
  benchmarkData: Contract
}

export async function benchmarkCoreFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<BenchmarkCoreFixture> {
  const benchmark = await deployContract(wallet, Benchmark, [wallet.address, tokens.WETH.address]);
  const benchmarkTreasury = await deployContract(wallet, BenchmarkTreasury, [wallet.address]);
  const benchmarkAaveMarketFactory = await deployContract(wallet, BenchmarkAaveMarketFactory, [wallet.address, constants.MARKET_FACTORY_AAVE]);
  const benchmarkData = await deployContract(wallet, BenchmarkData, [wallet.address]);

  await benchmarkAaveMarketFactory.initialize(benchmark.address);
  await benchmarkData.initialize(benchmark.address);
  await benchmark.initialize(benchmarkData.address, benchmarkTreasury.address);

  return { benchmark, benchmarkTreasury, benchmarkAaveMarketFactory, benchmarkData }
}
