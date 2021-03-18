import { providers, Wallet, Contract } from 'ethers';
import { consts, convertToAaveToken, convertToCompoundToken, tokens, convertToAaveV2Token, getA2Contract } from "../../helpers";
import { getAContract, getCContract, mint } from "../../helpers/Helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { aaveV2Fixture, AaveV2Fixture } from './aaveV2.fixture';
import { aaveForgeFixture, AaveForgeFixture } from './aaveForge.fixture';
import { aaveV2ForgeFixture, AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture, compoundForgeFixture } from './compoundForge.fixture';
import { coreFixture, CoreFixture } from './core.fixture';
import { governanceFixture } from './governance.fixture';
import ERC20 from "../../../build/artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
interface PendleFixture {
  core: CoreFixture,
  aave: AaveFixture,
  aaveV2: AaveV2Fixture,
  aForge: AaveForgeFixture,
  a2Forge: AaveV2ForgeFixture,
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
  const a2Forge = await aaveV2ForgeFixture(alice, provider, core, governance);
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);
  const aaveV2 = await aaveV2Fixture(alice);

  const { lendingPoolCore } = aave;

  await mint(provider, tokens.USDT, alice, consts.INITIAL_AAVE_USDT_AMOUNT);
  await convertToAaveToken(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(provider, tokens.USDT, alice, consts.INITIAL_AAVE_USDT_AMOUNT);
  await convertToAaveV2Token(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(provider, tokens.USDT, alice, consts.INITIAL_COMPOUND_USDT_AMOUNT);
  await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);

  const aContract = await getAContract(alice, lendingPoolCore, tokens.USDT);
  await aContract.approve(core.router.address, consts.MAX_ALLOWANCE);
  const a2Contract = await getA2Contract(alice, a2Forge.aaveV2Forge, tokens.USDT);
  await a2Contract.approve(core.router.address, consts.MAX_ALLOWANCE);
  const cContract = await getCContract(alice, tokens.USDT);
  await cContract.approve(core.router.address, consts.MAX_ALLOWANCE);

  return { core, aave, aaveV2, aForge, a2Forge, cForge }
}