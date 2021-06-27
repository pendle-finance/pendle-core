import { providers, Wallet } from 'ethers';
import {
  consts,
  convertToAaveV2Token,
  convertToCompoundToken,
  getA2Contract,
  getCContract,
  getERC20Contract,
  mint,
  mintSushiswapLpFixed,
  tokens,
} from '../../helpers';
import { aaveV2Fixture, AaveV2Fixture } from './aaveV2.fixture';
import { aaveV2ForgeFixture, AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture, compoundForgeFixture } from './compoundForge.fixture';
import { coreFixture, CoreFixture } from './core.fixture';
import { GovernanceFixture, governanceFixture } from './governance.fixture';
import { SushiswapComplexForgeFixture, sushiswapComplexForgeFixture } from './SushiswapComplexForge.fixture';
import { SushiswapSimpleForgeFixture, sushiswapSimpleForgeFixture } from './SushiswapSimpleForge.fixture';
const { waffle } = require('hardhat');
const { loadFixture } = waffle;

export interface RouterFixture {
  core: CoreFixture;
  governance: GovernanceFixture;
  aaveV2: AaveV2Fixture;
  a2Forge: AaveV2ForgeFixture;
  cForge: CompoundFixture;
  scForge: SushiswapComplexForgeFixture;
  ssForge: SushiswapSimpleForgeFixture;
  minted: boolean;
}

export async function routerFixture(_: Wallet[], __: providers.Web3Provider): Promise<RouterFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;

  const noMintFixture: RouterFixture = await loadFixture(routerFixtureNoMint);

  await mint(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await convertToAaveV2Token(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  await mint(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  await mintSushiswapLpFixed(alice);

  return {
    core: noMintFixture.core,
    governance: noMintFixture.governance,
    aaveV2: noMintFixture.aaveV2,
    a2Forge: noMintFixture.a2Forge,
    cForge: noMintFixture.cForge,
    scForge: noMintFixture.scForge,
    ssForge: noMintFixture.ssForge,
    minted: true,
  };
}

export async function routerFixtureNoMint(_: Wallet[], provider: providers.Web3Provider): Promise<RouterFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;
  const core = await loadFixture(coreFixture);
  const governance = await loadFixture(governanceFixture);

  const a2Forge = await aaveV2ForgeFixture(alice, provider, core, governance);
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const scForge = await sushiswapComplexForgeFixture(alice, provider, core, governance);
  const ssForge = await sushiswapSimpleForgeFixture(alice, provider, core, governance);
  const aaveV2 = await aaveV2Fixture(alice);

  const a2Contract = await getA2Contract(alice, a2Forge.aaveV2Forge, tokens.USDT);
  await a2Contract.approve(core.router.address, consts.INF);
  const cContract = await getCContract(alice, tokens.USDT);
  await cContract.approve(core.router.address, consts.INF);
  const scContract = await getERC20Contract(alice, tokens.SUSHI_USDT_WETH_LP);
  await scContract.approve(core.router.address, consts.INF);

  return { core, governance, aaveV2, a2Forge, cForge, scForge, ssForge, minted: false };
}
