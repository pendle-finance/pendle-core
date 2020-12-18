
import { Contract, Wallet } from 'ethers'
import BenchmarkAaveForge from '../../../artifacts/contracts/core/BenchmarkAaveForge.sol/BenchmarkAaveForge.json'
import BenchmarkOwnershipToken from '../../../artifacts/contracts/tokens/BenchmarkOwnershipToken.sol/BenchmarkOwnershipToken.json'
import BenchmarkFutureYieldToken from "../../../artifacts/contracts/tokens/BenchmarkFutureYieldToken.sol/BenchmarkFutureYieldToken.json"
import {constants, tokens} from "../../helpers/Constants"
import {BenchmarkCoreFixture} from "./benchmarkCore.fixture"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface BenchmarkAaveFixture {
    benchmarkAaveForge: Contract
    benchmarkOwnershipToken: Contract
    benchmarkFutureYieldToken: Contract
}

export async function benchmarkAaveForgeFixture(
    wallet: Wallet,
    {benchmark, benchmarkData}: BenchmarkCoreFixture
  ): Promise<BenchmarkAaveFixture> {
    const benchmarkAaveForge = await deployContract(wallet, BenchmarkAaveForge, [benchmark.address, constants.AAVE_LENDING_POOL_CORE_ADDRESS, constants.FORGE_AAVE]);

    await benchmark.addForge(constants.FORGE_AAVE, benchmarkAaveForge.address)

    await benchmarkAaveForge.newYieldContracts(tokens.USDT.address, constants.TEST_EXPIRY);
    const otTokenAddress = await benchmarkData.otTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.TEST_EXPIRY
    );

    const xytTokenAddress = await benchmarkData.xytTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.TEST_EXPIRY
    );

    const benchmarkOwnershipToken = new Contract(otTokenAddress, BenchmarkOwnershipToken.abi, wallet);
    const benchmarkFutureYieldToken = new Contract(xytTokenAddress, BenchmarkFutureYieldToken.abi, wallet);

    return {benchmarkAaveForge, benchmarkOwnershipToken, benchmarkFutureYieldToken, };
  }
