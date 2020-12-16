import chai, { expect } from 'chai'
import { Wallet, providers, BigNumber } from 'ethers'
import { benchmarkcoreFixture, BenchmarkCoreFixture } from './benchmarkCore.fixture';
import {benchmarkAaveForgeFixture, BenchmarkAaveFixture} from './benchmarkAaveForge.fixture'
import {aaveFixture, AaveFixture} from './aave.fixture';
import {constants, tokens} from "../../helpers/Constants"
import {mint, mintAaveToken, getAContract, amountToWei} from "../../helpers/Helpers";

import TestToken from '../../../artifacts/contracts/mock/TestToken.sol/TestToken.json'
import BenchmarkMarket from '../../../artifacts/contracts/core/BenchmarkMarket.sol/BenchmarkMarket.json'

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface BenchmarkFixture {
  core: BenchmarkCoreFixture,
  forge: BenchmarkAaveFixture,
  aave: AaveFixture,
  }

export async function benchmarkFixture(
[wallet]: Wallet[],
provider: providers.Web3Provider
): Promise<BenchmarkFixture> {
  const core = await benchmarkcoreFixture(wallet);
  const forge = await benchmarkAaveForgeFixture(wallet, core);
  const aave = await aaveFixture(wallet);
  const {benchmarkMarketFactory, benchmarkData} = core;
  const {benchmarkAaveForge, benchmarkFutureYieldToken} = forge;
  const {lendingPoolCore} = aave;

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  let overrides = {gasLimit: 40000000};

  await benchmarkMarketFactory.createMarket(
      constants.FORGE_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address,
      constants.TEST_EXPIRY,
      overrides
    );

    const benchmarkMarketAddress = await benchmarkData.getMarket(
      constants.FORGE_AAVE,
      benchmarkFutureYieldToken.address,
      testToken.address
    );

    expect(benchmarkMarketAddress).not.to.be.equal(constants.ZERO_ADDRESS);
    await testToken.approve(benchmarkMarketAddress, constants.MAX_ALLOWANCE);
    await benchmarkFutureYieldToken.approve(benchmarkMarketAddress, constants.MAX_ALLOWANCE);
    const token = tokens.USDT
    await mint(provider, token, wallet, BigNumber.from(1000));
    await mintAaveToken(token, wallet, BigNumber.from(1000));

    const aContract = await getAContract(wallet, lendingPoolCore, token);
    await aContract.approve(benchmarkAaveForge.address, constants.MAX_ALLOWANCE);
    return {core, aave, forge}
}

