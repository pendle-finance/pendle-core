import { Contract, providers, Wallet } from 'ethers';
import { checkDisabled, Mode } from '.';
import IPendleYieldTokenHolderV2 from '../../build/artifacts/contracts/interfaces/IPendleYieldTokenHolderV2.sol/IPendleYieldTokenHolderV2.json';
import {
  consts,
  convertToAaveV2Token,
  convertToCompoundToken,
  emptyToken,
  getA2Contract,
  getCContract,
  getERC20Contract,
  mint,
  mintSushiswapLpFixed,
  tokens,
} from '../helpers';
import { aaveV2Fixture, AaveV2Fixture } from './aaveV2.fixture';
import { aaveV2ForgeFixture, AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture, compoundForgeFixture } from './compoundForge.fixture';
import { CompoundV2Fixture, compoundV2ForgeFixture } from './compoundV2Forge.fixture';
import { coreFixture, CoreFixture } from './core.fixture';
import { GovernanceFixture, governanceFixture } from './governance.fixture';
import { SushiswapComplexForgeFixture, sushiswapComplexForgeFixture } from './SushiswapComplexForge.fixture';
import { SushiswapSimpleForgeFixture, sushiswapSimpleForgeFixture } from './SushiswapSimpleForge.fixture';
const { waffle, network } = require('hardhat');
const { loadFixture } = waffle;

export interface RouterFixture {
  core: CoreFixture;
  governance: GovernanceFixture;
  aaveV2: AaveV2Fixture;
  a2Forge: AaveV2ForgeFixture;
  cForge: CompoundFixture;
  c2Forge: CompoundV2Fixture;
  scForge: SushiswapComplexForgeFixture;
  ssForge: SushiswapSimpleForgeFixture;
  minted: boolean;
}

let wallets = [];
let alice: Wallet;
let bob: Wallet;
let charlie: Wallet;
let dave: Wallet;
let eve: Wallet;

if (network.name == 'hardhat') {
  wallets = waffle.provider.getWallets();
  [alice, bob, charlie, dave, eve] = wallets;
}

export async function routerFixture(_: Wallet[], __: providers.Web3Provider): Promise<RouterFixture> {
  const noMintFixture: RouterFixture = await loadFixture(routerFixtureNoMint);

  if (!checkDisabled(Mode.AAVE_V2)) {
    await mint(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
    await convertToAaveV2Token(tokens.USDT, alice, consts.INITIAL_AAVE_TOKEN_AMOUNT);
  }
  if (!checkDisabled(Mode.COMPOUND) || !checkDisabled(Mode.COMPOUND_V2)) {
    await mint(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await convertToCompoundToken(tokens.USDT, alice, consts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  }
  if (!checkDisabled(Mode.SUSHISWAP_COMPLEX) || !checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
    await mintSushiswapLpFixed(alice);
    await bufferSushi(noMintFixture);
  }
  return {
    core: noMintFixture.core,
    governance: noMintFixture.governance,
    aaveV2: noMintFixture.aaveV2,
    a2Forge: noMintFixture.a2Forge,
    cForge: noMintFixture.cForge,
    c2Forge: noMintFixture.c2Forge,
    scForge: noMintFixture.scForge,
    ssForge: noMintFixture.ssForge,
    minted: true,
  };
}

async function bufferSushi(noMintFixture: RouterFixture) {
  await mintSushiswapLpFixed(eve);
  const sushiPool = await getERC20Contract(alice, tokens.SUSHI_USDT_WETH_LP);
  const scYieldTokenHolderAddr = await noMintFixture.scForge.sushiswapComplexForge.yieldTokenHolders(
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SC.add(consts.SIX_MONTH)
  );
  const ssYieldTokenHolderAddr = await noMintFixture.ssForge.sushiswapSimpleForge.yieldTokenHolders(
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SS.add(consts.SIX_MONTH)
  );
  const scYieldTokenHolder = new Contract(scYieldTokenHolderAddr, IPendleYieldTokenHolderV2.abi, alice);
  const ssYieldTokenHolder = new Contract(ssYieldTokenHolderAddr, IPendleYieldTokenHolderV2.abi, alice);
  await sushiPool.connect(eve).transfer(scYieldTokenHolderAddr, 10);
  await scYieldTokenHolder.afterReceiveTokens(10);
  await sushiPool.connect(eve).transfer(ssYieldTokenHolderAddr, 10);
  await ssYieldTokenHolder.afterReceiveTokens(10);
  await emptyToken(sushiPool, eve);
}

export async function routerFixtureNoMint(_: Wallet[], provider: providers.Web3Provider): Promise<RouterFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;
  const core = await loadFixture(coreFixture);
  const governance = await loadFixture(governanceFixture);

  let aaveV2: AaveV2Fixture = {} as AaveV2Fixture;
  let a2Forge: AaveV2ForgeFixture = {} as AaveV2ForgeFixture;
  let cForge: CompoundFixture = {} as CompoundFixture;
  let c2Forge: CompoundV2Fixture = {} as CompoundV2Fixture;
  let scForge: SushiswapComplexForgeFixture = {} as SushiswapComplexForgeFixture;
  let ssForge: SushiswapSimpleForgeFixture = {} as SushiswapSimpleForgeFixture;

  if (!checkDisabled(Mode.AAVE_V2)) {
    a2Forge = await aaveV2ForgeFixture(alice, provider, core, governance);
    aaveV2 = await aaveV2Fixture(alice);
    const a2Contract = await getA2Contract(alice, a2Forge.aaveV2Forge, tokens.USDT);
    await a2Contract.approve(core.router.address, consts.INF);
  }
  if (!checkDisabled(Mode.COMPOUND)) {
    cForge = await compoundForgeFixture(alice, provider, core, governance);
    const cContract = await getCContract(alice, tokens.USDT);
    await cContract.approve(core.router.address, consts.INF);
  }
  if (!checkDisabled(Mode.COMPOUND_V2)) {
    c2Forge = await compoundV2ForgeFixture(alice, provider, core, governance);
    const cContract = await getCContract(alice, tokens.USDT);
    await cContract.approve(core.router.address, consts.INF);
  }
  if (!checkDisabled(Mode.SUSHISWAP_COMPLEX)) {
    scForge = await sushiswapComplexForgeFixture(alice, provider, core, governance);
    const scContract = await getERC20Contract(alice, tokens.SUSHI_USDT_WETH_LP);
    await scContract.approve(core.router.address, consts.INF);
  }
  if (!checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
    ssForge = await sushiswapSimpleForgeFixture(alice, provider, core, governance);
  }
  return { core, governance, aaveV2, a2Forge, cForge, c2Forge, scForge, ssForge, minted: false };
}
