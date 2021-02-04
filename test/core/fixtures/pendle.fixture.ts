import chai, { expect } from 'chai'
import { Wallet, providers, BigNumber } from 'ethers'
import { pendleRouterFixture, PendleRouterFixture } from './pendleRouter.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { pendleGovernanceFixture, PendleGovernanceFixture } from './pendleGovernance.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { constants, tokens } from "../../helpers/Constants"
import { mint, mintAaveToken, getAContract, amountToWei } from "../../helpers/Helpers";
const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;
import { createFixtureLoader } from "ethereum-waffle";
interface PendleFixture {
  router: PendleRouterFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [wallet] = wallets;
  const router = await pendleRouterFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, router, governance);
  const aave = await aaveFixture(wallet);

  const { pendleAaveForge } = forge;
  const { lendingPoolCore } = aave;
  const token = tokens.USDT

  await mint(provider, token, wallet, BigNumber.from(100));
  await mintAaveToken(token, wallet, BigNumber.from(100));

  const aContract = await getAContract(wallet, lendingPoolCore, token);

  await aContract.approve(router.pendleRouter.address, constants.MAX_ALLOWANCE);

  return { router, aave, forge }
}
