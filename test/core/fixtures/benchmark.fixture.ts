import chai, { expect } from 'chai'
import { Wallet, providers, BigNumber } from 'ethers'
import { benchmarkcoreFixture, BenchmarkCoreFixture } from './benchmarkCore.fixture';
import {benchmarkAaveForgeFixture, BenchmarkAaveFixture} from './benchmarkAaveForge.fixture'
import {aaveFixture, AaveFixture} from './aave.fixture';
import {constants, tokens} from "../../helpers/Constants"
import {mint, mintAaveToken, getAContract, amountToWei} from "../../helpers/Helpers";

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

  const {benchmarkAaveForge} = forge;
  const {lendingPoolCore} = aave;
  const token = tokens.USDT

  await mint(provider, token, wallet, BigNumber.from(100));
  await mintAaveToken(token, wallet, BigNumber.from(100));

  const aContract = await getAContract(wallet, lendingPoolCore, token);
  await aContract.approve(benchmarkAaveForge.address, constants.MAX_ALLOWANCE);

  return {core, aave, forge}
}
