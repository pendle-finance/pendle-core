import chai, { expect } from 'chai'
import { Wallet, providers, BigNumber } from 'ethers'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { pendleGovernanceFixture, PendleGovernanceFixture } from './pendleGovernance.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { consts, tokens, convertToAaveToken } from "../../helpers"
import { mint, mintAaveToken, getAContract, amountToWei } from "../../helpers/Helpers";
const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;
import { createFixtureLoader } from "ethereum-waffle";
interface PendleFixture {
  core: PendleCoreFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [alice] = wallets;
  const core = await pendleCoreFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);

  const { pendleAaveForge } = forge;
  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(core.pendleRouter.address, consts.MAX_ALLOWANCE);

  return { core, aave, forge }
}
