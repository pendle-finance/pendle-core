import { providers, Wallet } from 'ethers';
import { consts, convertToAaveToken, tokens } from "../../helpers";
import { getAContract, mint } from "../../helpers/Helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleGovernanceFixture } from './pendleGovernance.fixture';
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

  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(core.pendleRouter.address, consts.MAX_ALLOWANCE);

  return { core, aave, forge }
}
