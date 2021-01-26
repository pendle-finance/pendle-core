import { providers, Wallet } from 'ethers';
import { consts, getAContract, mint, mintAaveToken, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';

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

  await mint(provider, tokens.USDT, wallet, consts.INITIAL_USDT_AMOUNT);
  await mintAaveToken(tokens.USDT, wallet, consts.INITIAL_AAVE_TOKEN_AMOUNT);

  const aContract = await getAContract(wallet, lendingPoolCore, tokens.USDT);
  await aContract.approve(pendleAaveForge.address, consts.MAX_ALLOWANCE);

  return { core, aave, forge }
}
