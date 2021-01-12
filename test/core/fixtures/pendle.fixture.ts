import chai, { expect } from 'chai'
import { Wallet, providers, BigNumber } from 'ethers'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { constants, tokens } from "../../helpers/Constants"
import { mint, mintAaveToken, getAContract, amountToWei } from "../../helpers/Helpers";

interface PendleFixture {
  core: PendleCoreFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [wallet] = wallets;
  const core = await pendleCoreFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, core);
  const aave = await aaveFixture(wallet);

  const { pendleAaveForge } = forge;
  const { lendingPoolCore } = aave;
  const token = tokens.USDT

  await mint(provider, token, wallet, BigNumber.from(100));
  await mintAaveToken(token, wallet, BigNumber.from(100));

  const aContract = await getAContract(wallet, lendingPoolCore, token);
  await aContract.approve(pendleAaveForge.address, constants.MAX_ALLOWANCE);

  return { core, aave, forge }
}
