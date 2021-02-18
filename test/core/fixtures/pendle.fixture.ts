import { providers, Wallet } from 'ethers';
import { consts, convertToAaveToken, getAContract, mint, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { compoundFixture, CompoundFixture } from './compound.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { PendleCompoundFixture, pendleCompoundForgeFixture } from './pendleCompoundForge.fixture';
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';

interface PendleFixture {
  core: PendleCoreFixture,
  aForge: PendleAaveFixture,
  cForge: PendleCompoundForge,
  aave: AaveFixture,
  compound: CompoundFixture,
}

export async function pendleFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleFixture> {
  const [alice] = wallets;
  const core = await pendleCoreFixture(wallets, provider);
  const aForge = await pendleAaveForgeFixture(alice, provider, core);
  const cForge = await pendleCompoundForgeFixture(alice, provider, core);
  const aave = await aaveFixture(alice);
  const compound = await compoundFixture(alice);

  const { pendleAaveForge } = aForge;
  const { lendingPoolCore } = aave;

  const { pendleCompoundForge } = cForge;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await convertToCToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT)

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(pendleAaveForge.address, consts.MAX_ALLOWANCE);

  const cContract = await getCContract(alice, lendingPoolCore, tokens.USDT);
  await cContract.approve(pendleCompoundForge.address, consts.MAX_ALLOWANCE);

  return { core, aave, forge }
}
