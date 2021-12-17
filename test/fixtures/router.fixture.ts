import { loadFixture } from 'ethereum-waffle';
import { providers, Wallet, BigNumber as BN } from 'ethers';
import { checkDisabled, Mode, TestEnv, wallets } from '.';
import { DeployOrFetch, deployRedeemProxy, deployRetroactiveDist, getContract } from '../../pendle-deployment-scripts';
import {
  approveAll,
  bufferJoe,
  bufferKyber,
  bufferSushi,
  bufferUni,
  bufferXJoe,
  convertToAaveV2Token,
  convertToCompoundToken,
  getA2Token,
  getCContract,
  getQiContract,
  mint,
  mintKyberDMMFixed,
  mintQiToken,
  mintSushiswapLpFixed,
  mintTraderJoeLpFixed,
  mintUniswapLpFixed,
  mintXJoe,
  teConsts,
} from '../helpers';
import { deployAaveV2Forge } from './aaveV2Forge.fixture';
import { deployBenQiForgeFixture } from './benqiForge.fixture';
import { compoundForgeFixture as deployCompoundForge } from './compoundForge.fixture';
import { compoundV2ForgeFixture as deployCompoundV2Forge } from './compoundV2Forge.fixture';
import { coreFixture } from './core.fixture';
import { deployKyberDMMForge } from './KyberDMMForge.fixture';
import { deploySushiswapComplexForge } from './SushiswapComplexForge.fixture';
import { deploySushiswapSimpleForge } from './SushiswapSimpleForge.fixture';
import { deployTraderJoeForge } from './TraderJoeForge.fixture';
import { uniswapV2ForgeFixture as deployUniswapV2Forge } from './UniswapV2Forge.fixture';
import { deployWonderlandFixture } from './WonderlandForge.fixture';
import { deployxJoeForge } from './XJoeForge.fixture';

export async function routerFixture(_: Wallet[], __: providers.Web3Provider): Promise<TestEnv> {
  console.time('setupRouterFixture');
  let env = await loadFixture(routerFixtureNoMint);
  let tokens = env.ptokens;
  let [alice] = wallets;
  if (!checkDisabled(Mode.AAVE_V2)) {
    await mint(env, tokens.USDT!, alice, teConsts.INITIAL_AAVE_TOKEN_AMOUNT);
    await convertToAaveV2Token(env, tokens.USDT!, alice, teConsts.INITIAL_AAVE_TOKEN_AMOUNT);
  }
  if (!checkDisabled(Mode.COMPOUND) || !checkDisabled(Mode.COMPOUND_V2)) {
    await mint(env, tokens.USDT!, alice, teConsts.INITIAL_COMPOUND_TOKEN_AMOUNT);
    await convertToCompoundToken(env, tokens.USDT!, alice, teConsts.INITIAL_COMPOUND_TOKEN_AMOUNT);
  }
  if (!checkDisabled(Mode.SUSHISWAP_COMPLEX) || !checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
    await mintSushiswapLpFixed(env, alice);
    await mintSushiswapLpFixed(env, env.eve);
    if (!checkDisabled(Mode.SUSHISWAP_COMPLEX)) {
      await bufferSushi(env, env.scForge, tokens.SUSHI_USDT_WETH_LP!.address, teConsts.T0_SS, false);
    }
    if (!checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
      await bufferSushi(env, env.ssForge, tokens.SUSHI_USDT_WETH_LP!.address, teConsts.T0_SC);
    }
  }
  if (!checkDisabled(Mode.UNISWAPV2)) {
    await mintUniswapLpFixed(env, alice);
    await bufferUni(env);
  }

  if (!checkDisabled(Mode.BENQI)) {
    await mintQiToken(env, tokens.DAI!, alice, teConsts.INITIAL_BENQI_DAI_AMOUNT);
  }
  if (!checkDisabled(Mode.TRADER_JOE)) {
    await mintTraderJoeLpFixed(env, alice);
    await bufferJoe(env);
  }
  if (!checkDisabled(Mode.XJOE)) {
    await mintXJoe(env, env.xJoe, alice, teConsts.INITIAL_xJOE_AMOUNT);
    await bufferXJoe(env);
  }
  if (!checkDisabled(Mode.KYBER_DMM)) {
    await mintKyberDMMFixed(env, alice);
    await bufferKyber(env);
  }
  if (!checkDisabled(Mode.WONDERLAND)) {
    await mint(env, env.ptokens.wMEMO!, alice, BN.from(0));
  }
  console.timeEnd('setupRouterFixture');
  return env;
}

export async function routerFixtureNoMint(_: Wallet[], __: providers.Web3Provider): Promise<TestEnv> {
  console.time('setupRouterFixtureNoMint');
  let env = await coreFixture();

  if (!checkDisabled(Mode.AAVE_V2)) {
    await deployAaveV2Forge(env);
    await approveAll([await getA2Token(env, env.ptokens.USDT!)], [env.router]);
  }
  console.log('Done deploying AaveV2 Forge');
  if (!checkDisabled(Mode.COMPOUND)) {
    await deployCompoundForge(env);
    await approveAll([await getCContract(env, env.ptokens.USDT!)], [env.router]);
  }
  console.log('Done deploying Compound Forge');
  if (!checkDisabled(Mode.COMPOUND_V2)) {
    await deployCompoundV2Forge(env);
    await approveAll([await getCContract(env, env.ptokens.USDT!)], [env.router]);
  }
  console.log('Done deploying CompoundV2 Forge');
  if (!checkDisabled(Mode.SUSHISWAP_COMPLEX)) {
    await deploySushiswapComplexForge(env);
    await approveAll([env.sushiPool], [env.router]);
  }
  console.log('Done deploying SushiswapComplex Forge');
  if (!checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
    await deploySushiswapSimpleForge(env);
    await approveAll([env.sushiPool], [env.router]);
  }
  console.log('Done deploying SushiswapSimple Forge');
  if (!checkDisabled(Mode.UNISWAPV2)) {
    await deployUniswapV2Forge(env);
    await approveAll([env.uniPool], [env.router]);
  }
  console.log('Done deploying UniswapV2 Forge');
  if (!checkDisabled(Mode.BENQI)) {
    await deployBenQiForgeFixture(env);
    await approveAll([await getQiContract(env.ptokens.DAI!)], [env.router]);
  }
  console.log('Done deploying BenQi Forge');
  if (!checkDisabled(Mode.TRADER_JOE)) {
    await deployTraderJoeForge(env);
    await approveAll([await getContract('ERC20', env.ptokens.JOE_WAVAX_DAI_LP!)], [env.router]);
  }
  console.log('Done deploying Trader Joe Forge');
  if (!checkDisabled(Mode.KYBER_DMM)) {
    await deployKyberDMMForge(env);
    await approveAll([env.kyberPool], [env.router]);
  }
  console.log('Done deploying KyberDMM Forge');
  if (!checkDisabled(Mode.XJOE)) {
    await deployxJoeForge(env);
    await approveAll([env.xJoe], [env.router]);
  }
  if (!checkDisabled(Mode.WONDERLAND)) {
    await deployWonderlandFixture(env);
    await approveAll([await getContract('ERC20', env.ptokens.wMEMO!)], [env.router]);
  }
  console.log('Done deploying xJoe Forge');

  await deployRetroactiveDist(env.penv, DeployOrFetch.DEPLOY);
  await deployRedeemProxy(env.penv, DeployOrFetch.DEPLOY);
  env.redeemProxy = env.penv.redeemProxy;

  console.timeEnd('setupRouterFixtureNoMint');
  return env;
}
