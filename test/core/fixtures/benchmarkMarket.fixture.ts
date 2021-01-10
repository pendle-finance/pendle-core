import { Wallet, providers, BigNumber, Contract } from 'ethers'
import { benchmarkCoreFixture, BenchmarkCoreFixture } from './benchmarkCore.fixture';
import { benchmarkAaveForgeFixture, BenchmarkAaveFixture } from './benchmarkAaveForge.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { constants, tokens, mintAproveTokenizeYield, amountToWei } from "../../helpers";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import BenchmarkMarket from "../../../build/artifacts/contracts/core/BenchmarkMarket.sol/BenchmarkMarket.json"
const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface BenchmarkMarketFixture {
  core: BenchmarkCoreFixture,
  forge: BenchmarkAaveFixture,
  aave: AaveFixture,
  testToken: Contract,
  benchmarkMarket: Contract
}

export async function benchmarkMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<BenchmarkMarketFixture> {
  const [wallet, wallet1] = wallets
  const core = await benchmarkCoreFixture(wallets, provider);
  const forge = await benchmarkAaveForgeFixture(wallet, core);
  const aave = await aaveFixture(wallet);
  const { benchmark, benchmarkAaveMarketFactory, benchmarkData } = core;
  const { benchmarkAaveForge, benchmarkFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, BigNumber.from(100));

  await mintAproveTokenizeYield(provider, token, wallet, amount, benchmark, benchmarkAaveForge);
  await mintAproveTokenizeYield(provider, token, wallet1, amount, benchmark, benchmarkAaveForge);

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(wallet1.address, totalSupply.div(2))

  await benchmark.addMarketFactory(constants.FORGE_AAVE, constants.MARKET_FACTORY_AAVE, benchmarkAaveMarketFactory.address);

  await benchmarkAaveMarketFactory.createMarket(
    constants.FORGE_AAVE,
    benchmarkFutureYieldToken.address,
    testToken.address,
    constants.TEST_EXPIRY,
    constants.HIGH_GAS_OVERRIDE
  );

  const benchmarkMarketAddress = await benchmarkData.getMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    benchmarkFutureYieldToken.address,
    testToken.address
  );

  const benchmarkMarket = new Contract(benchmarkMarketAddress, BenchmarkMarket.abi, wallet)
  await testToken.approve(benchmarkMarketAddress, totalSupply);
  await testToken.connect(wallet1).approve(benchmarkMarketAddress, totalSupply);

  await benchmarkFutureYieldToken.approve(benchmarkMarketAddress, constants.MAX_ALLOWANCE);
  await benchmarkFutureYieldToken.connect(wallet1).approve(benchmarkMarketAddress, constants.MAX_ALLOWANCE);

  return { core, aave, forge, testToken, benchmarkMarket }
}
