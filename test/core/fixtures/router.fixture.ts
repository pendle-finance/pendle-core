import { providers, Wallet } from 'ethers';
import { waffle } from 'hardhat';
import {
  consts,
  convertToAaveV2Token,
  convertToCompoundToken,
  getA2Contract,
  getCContract,
  mint,
  tokens,
} from '../../helpers';
import { aaveV2Fixture, AaveV2Fixture } from './aaveV2.fixture';
import { aaveV2ForgeFixture, AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture, compoundForgeFixture } from './compoundForge.fixture';
import { coreFixture, CoreFixture } from './core.fixture';
import { GovernanceFixture, governanceFixture } from './governance.fixture';
const { loadFixture } = waffle;

export interface RouterFixture {
  core: CoreFixture;
  governance: GovernanceFixture;
  aaveV2: AaveV2Fixture;
  a2Forge: AaveV2ForgeFixture;
  cForge: CompoundFixture;
  minted: boolean;
}

export async function routerFixture(_: Wallet[], __: providers.Web3Provider): Promise<RouterFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;

  const noMintFixture = await loadFixture(routerFixtureNoMint);

  await mint(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await convertToAaveV2Token(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);

  return {
    core: noMintFixture.core,
    governance: noMintFixture.governance,
    aaveV2: noMintFixture.aaveV2,
    a2Forge: noMintFixture.a2Forge,
    cForge: noMintFixture.cForge,
    minted: true,
  };
}

export async function routerFixtureNoMint(_: Wallet[], provider: providers.Web3Provider): Promise<RouterFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;
  const core = await loadFixture(coreFixture);
  const governance = await loadFixture(governanceFixture);
  // TODO: the 5 following fixtures are not exactly Waffle fixtures. Should rename or refactor into fixtures
  const a2Forge = await aaveV2ForgeFixture(alice, provider, core, governance);
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const aaveV2 = await aaveV2Fixture(alice);

  const a2Contract = await getA2Contract(alice, a2Forge.aaveV2Forge, tokens.USDT);
  await a2Contract.approve(core.router.address, consts.INF);
  const cContract = await getCContract(alice, tokens.USDT);
  await cContract.approve(core.router.address, consts.INF);

  return { core, governance, aaveV2, a2Forge, cForge, minted: false };
}
