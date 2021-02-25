import { providers, Wallet } from 'ethers';
import { consts, convertToAaveToken, convertToCompoundToken, tokens } from "../../helpers";
import { getAContract, getCContract, mint } from "../../helpers/Helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { pendleCompoundForgeFixture, PendleCompoundFixture } from './pendleCompoundForge.fixture'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleGovernanceFixture } from './pendleGovernance.fixture';
interface PendleFixture {
  core: PendleCoreFixture,
  aave: AaveFixture,
  aForge: PendleAaveFixture,
  cForge: PendleCompoundFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [alice] = wallets;
  const core = await pendleCoreFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const aForge = await pendleAaveForgeFixture(alice, provider, core, governance);
  const cForge = await pendleCompoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);

  const { pendleAaveForge } = aForge;
  const { pendleCompoundForge } = cForge;
  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(core.pendleRouter.address, consts.MAX_ALLOWANCE);
  const cContract = await getCContract(alice, tokens.USDT);
  await cContract.approve(core.pendleRouter.address, consts.MAX_ALLOWANCE);

  return { core, aave, aForge, cForge }
}
