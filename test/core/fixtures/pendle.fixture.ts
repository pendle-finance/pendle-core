import { providers, Wallet } from 'ethers';
import { consts, convertToAaveToken, convertToCompoundToken, tokens } from "../../helpers";
import { getAContract, getCContract, mint } from "../../helpers/Helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { aaveForgeFixture, AaveForgeFixture } from './aaveForge.fixture';
import { CompoundFixture, compoundForgeFixture } from './compoundForge.fixture';
import { coreFixture, CoreFixture } from './core.fixture';
import { governanceFixture } from './governance.fixture';
interface PendleFixture {
  core: CoreFixture,
  aave: AaveFixture,
  aForge: AaveForgeFixture,
  cForge: CompoundFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [alice] = wallets;
  const core = await coreFixture(wallets, provider);
  const governance = await governanceFixture(wallets, provider);
  const aForge = await aaveForgeFixture(alice, provider, core, governance);
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);

  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_AAVE_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(provider, tokens.USDT, alice, consts.INITIAL_COMPOUND_USDT_AMOUNT);
  await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(core.router.address, consts.MAX_ALLOWANCE);
  const cContract = await getCContract(alice, tokens.USDT);
  await cContract.approve(core.router.address, consts.MAX_ALLOWANCE);

  return { core, aave, aForge, cForge }
}
