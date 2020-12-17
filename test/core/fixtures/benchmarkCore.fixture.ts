import { Contract, Wallet, providers } from 'ethers'
import Benchmark from '../../../artifacts/contracts/core/Benchmark.sol/Benchmark.json'
import BenchmarkTreasury from '../../../artifacts/contracts/core/BenchmarkTreasury.sol/BenchmarkTreasury.json'
import BenchmarkMarketFactory from "../../../artifacts/contracts/core/BenchmarkMarketFactory.sol/BenchmarkMarketFactory.json"
import BenchmarkData from "../../../artifacts/contracts/core/BenchmarkData.sol/BenchmarkData.json"
import {tokens} from "../../helpers/Constants"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface BenchmarkCoreFixture {
  benchmark: Contract
  benchmarkTreasury: Contract
  benchmarkMarketFactory: Contract
  benchmarkData: Contract
}

  export async function benchmarkcoreFixture(
    [wallet]: Wallet[],
    provider: providers.Web3Provider
  ): Promise<BenchmarkCoreFixture> {
    const benchmark = await deployContract(wallet, Benchmark, [wallet.address, tokens.WETH.address]);
    const benchmarkTreasury = await deployContract(wallet, BenchmarkTreasury, [wallet.address]);
    const benchmarkMarketFactory = await deployContract(wallet, BenchmarkMarketFactory, [wallet.address]);
    const benchmarkData = await deployContract(wallet, BenchmarkData, [wallet.address]);
    
    await benchmarkMarketFactory.initialize(benchmark.address);
    await benchmarkData.initialize(benchmark.address);
    await benchmark.initialize(benchmarkData.address, benchmarkMarketFactory.address, benchmarkTreasury.address);

    return {benchmark, benchmarkTreasury, benchmarkMarketFactory, benchmarkData}
  }
