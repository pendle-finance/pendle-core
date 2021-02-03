import { providers, Wallet } from 'ethers';
import { consts, convertToAaveToken, getAContract, mint, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { pendleRouterFixture, PendleRouterFixture } from './pendleRouter.fixture';

interface PendleFixture {
  router: PendleRouterFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [alice] = wallets;
  const router = await pendleRouterFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(alice, provider, router);
  const aave = await aaveFixture(alice);

  const { pendleAaveForge } = forge;
  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);

  await aContract.approve(router.pendleRouter.address, consts.MAX_ALLOWANCE);

  return { router, aave, forge }
}
