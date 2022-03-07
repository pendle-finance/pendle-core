import { loadFixture } from 'ethereum-waffle';
import { providers, Wallet } from 'ethers';
import { checkDisabled, Mode, TestEnv, wallets } from '.';
import { createNewYTMarket, getContract } from '../../pendle-deployment-scripts';
import {
  approveAll,
  deployContract,
  mintXytAave,
  mintXytBenQi,
  mintXytCompound,
  mintXytSushiswapFixed,
  mintXytTraderJoeFixed,
  mintXytUniswapFixed,
  mintXytWMEMOFixed,
  mintXytXJoeFixed,
  teConsts,
} from '../helpers';
import { routerFixtureNoMint } from './router.fixture';

export async function marketFixture(_: Wallet[], provider: providers.Web3Provider): Promise<TestEnv> {
  console.time('setupMarketFixture');
  let env = await loadFixture(routerFixtureNoMint);
  env.testToken = await deployContract('TestToken', ['Test Token', 'TEST', 6]);

  await deployA2Markets(env);
  await deployCMarkets(env);

  await deploySCMarkets(env);
  await deploySSMarkets(env);
  await deployUMarkets(env);
  await deployQiMarkets(env);
  await distributeTestTokens(env);
  await deployMockMarketMath(env);
  await deployJoeMarkets(env);
  await deployXJoeMarkets(env);
  await deployWonderlandMarkets(env);
  console.timeEnd('setupMarketFixture');
  return env;
}

async function deployA2Markets(env: TestEnv) {
  if (checkDisabled(Mode.AAVE_V2)) return;
  for (let person of wallets) {
    await mintXytAave(
      env,
      env.ptokens.USDT!,
      person,
      teConsts.INITIAL_OT_XYT_AMOUNT,
      teConsts.T0_A2.add(env.pconsts.misc.SIX_MONTH)
    );
    await mintXytAave(
      env,
      env.ptokens.DAI!,
      person,
      teConsts.INITIAL_OT_XYT_AMOUNT,
      teConsts.T0_A2.add(env.pconsts.misc.SIX_MONTH)
    );
  }
  // a2XYT - testToken
  await env.router.createMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  // a2XYT18 - testToken
  await env.router.createMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken18.address,
    env.testToken.address,
    teConsts.HG
  );
  // a2XYT - WETH
  await env.router.createMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken.address,
    env.ptokens.WNATIVE!.address,
    teConsts.HG
  );

  const a2MarketAddress = await env.data.getMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken.address,
    env.testToken.address
  );

  const a2Market18Address = await env.data.getMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken18.address,
    env.testToken.address
  );

  const a2MarketEthAddress = await env.data.getMarket(
    env.pconsts.aave!.MARKET_FACTORY_ID,
    env.a2FutureYieldToken.address,
    env.ptokens.WNATIVE!.address
  );
  env.a2Market = await getContract('MockPendleAaveMarket', a2MarketAddress);
  env.a2Market18 = await getContract('MockPendleAaveMarket', a2Market18Address);
  env.a2MarketEth = await getContract('MockPendleAaveMarket', a2MarketEthAddress);

  console.log('Done deploying AaveV2 Market');
}

async function deployCMarkets(env: TestEnv) {
  if (checkDisabled(Mode.COMPOUND)) return;
  for (let person of wallets) {
    await mintXytCompound(
      env,
      Mode.COMPOUND,
      env.ptokens.USDT!,
      person,
      teConsts.INITIAL_OT_XYT_AMOUNT,
      teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
    );
    await mintXytCompound(
      env,
      Mode.COMPOUND,
      env.ptokens.WNATIVE!,
      person,
      teConsts.INITIAL_OT_XYT_AMOUNT,
      teConsts.T0_C.add(env.pconsts.misc.SIX_MONTH)
    );
  }
  await env.data.addMarketFactory(env.pconsts.compound!.MARKET_FACTORY_ID, env.cMarketFactory.address, teConsts.HG);
  await env.data.setForgeFactoryValidity(
    env.pconsts.compound!.FORGE_ID_V1,
    env.pconsts.compound!.MARKET_FACTORY_ID,
    true,
    teConsts.HG
  );
  // cXYT - testToken
  await env.router.createMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  // cXYT18 - testToken
  await env.router.createMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken8.address,
    env.testToken.address,
    teConsts.HG
  );
  // cXYT - WETH
  await env.router.createMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken.address,
    env.ptokens.WNATIVE!.address,
    teConsts.HG
  );
  const cMarketAddress = await env.data.getMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken.address,
    env.testToken.address
  );

  const cMarket8Address = await env.data.getMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken8.address,
    env.testToken.address
  );

  const cMarketEthAddress = await env.data.getMarket(
    env.pconsts.compound!.MARKET_FACTORY_ID,
    env.cFutureYieldToken.address,
    env.ptokens.WNATIVE!.address
  );
  env.cMarket = await getContract('PendleCompoundMarket', cMarketAddress);
  env.cMarket8 = await getContract('PendleCompoundMarket', cMarket8Address);
  env.cMarketEth = await getContract('MockPendleAaveMarket', cMarketEthAddress);
  console.log('Done deploying Compound Market');
}

async function deploySCMarkets(env: TestEnv) {
  if (checkDisabled(Mode.SUSHISWAP_COMPLEX)) return;
  for (let i = 0; i < 4; i++) {
    let person = wallets[i];
    await mintXytSushiswapFixed(env, Mode.SUSHISWAP_COMPLEX, person, teConsts.T0_SC.add(env.pconsts.misc.SIX_MONTH));
  }
  await env.data.setForgeFactoryValidity(
    env.pconsts.sushi!.FORGE_ID_COMPLEX,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    true,
    teConsts.HG
  );
  // scXYT - testToken
  await env.router.createMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.scFutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  const scMarketAddress = await env.data.getMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.scFutureYieldToken.address,
    env.testToken.address
  );
  env.scMarket = await getContract('PendleGenericMarket', scMarketAddress);
}

async function deployUMarkets(env: TestEnv) {
  if (checkDisabled(Mode.UNISWAPV2)) return;
  for (let i = 0; i < 4; i++) {
    let person = wallets[i];
    await mintXytUniswapFixed(env, person, teConsts.T0_UNI.add(env.pconsts.misc.SIX_MONTH));
  }

  await env.data.setForgeFactoryValidity(
    env.pconsts.uni!.FORGE_ID,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    true,
    teConsts.HG
  );
  // uniXYT - testToken
  await env.router.createMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.uniFutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  const uniMarketAddress = await env.data.getMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.uniFutureYieldToken.address,
    env.testToken.address
  );
  env.uniMarket = await getContract('PendleGenericMarket', uniMarketAddress);
  console.log('Done deploying UniswapV2 Market');
}

async function deploySSMarkets(env: TestEnv) {
  if (checkDisabled(Mode.SUSHISWAP_SIMPLE)) return;
  for (let i = 0; i < 4; i++) {
    let person = wallets[i];
    await mintXytSushiswapFixed(env, Mode.SUSHISWAP_SIMPLE, person, teConsts.T0_SS.add(env.pconsts.misc.SIX_MONTH));
  }
  await env.data.setForgeFactoryValidity(
    env.pconsts.sushi!.FORGE_ID_SIMPLE,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    true,
    teConsts.HG
  );
  // ssXYT - testToken
  await env.router.createMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.ssFutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  const ssMarketAddress = await env.data.getMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.ssFutureYieldToken.address,
    env.testToken.address
  );
  env.ssMarket = await getContract('PendleGenericMarket', ssMarketAddress);
  console.log('Done deploying SushiswapComplexV2 Market');
}

async function deployQiMarkets(env: TestEnv) {
  if (checkDisabled(Mode.BENQI)) return;
  for (let i = 0; i < 4; ++i) {
    let person = wallets[i];
    await mintXytBenQi(
      env,
      env.ptokens.DAI!,
      person,
      teConsts.INITIAL_OT_XYT_AMOUNT,
      teConsts.T0_B.add(env.pconsts.misc.SIX_MONTH)
    );
  }
  const marketDAI = await createNewYTMarket(
    env.penv,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.benQiYtDAI.address,
    env.testToken.address
  );
  env.benQiMarket = await getContract('PendleGenericMarket', marketDAI);
  console.log('Done deploying BenQi Market');
}

async function deployJoeMarkets(env: TestEnv) {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  for (let i = 0; i < 4; ++i) {
    let person = wallets[i];
    await mintXytTraderJoeFixed(env, person, teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH));
  }

  let joeMarketAddr = await createNewYTMarket(
    env.penv,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.joeFutureYieldToken.address,
    env.testToken.address
  );

  env.joeMarket = await getContract('PendleGenericMarket', joeMarketAddr);
  console.log('Done deploying Trader Joe Market');
}

async function deployXJoeMarkets(env: TestEnv) {
  if (checkDisabled(Mode.XJOE)) return;
  for (let i = 0; i < 4; ++i) {
    let person = wallets[i];
    await mintXytXJoeFixed(env, person, teConsts.T0_XJ.add(env.pconsts.misc.SIX_MONTH));
  }

  let xJoeMarketAddr = await createNewYTMarket(
    env.penv,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.xJoeFutureYieldToken.address,
    env.testToken.address
  );
  env.xJoeMarket = await getContract('PendleGenericMarket', xJoeMarketAddr);
  console.log('Done deploying XJoe Market');
}

async function deployWonderlandMarkets(env: TestEnv) {
  if (checkDisabled(Mode.WONDERLAND)) return;
  for (let i = 0; i < 4; ++i) {
    let person = wallets[i];
    await mintXytWMEMOFixed(env, person, teConsts.T0_WM.add(env.pconsts.misc.SIX_MONTH));
  }
  await env.data.setForgeFactoryValidity(
    env.pconsts.wonderland!.FORGE_ID,
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    true,
    teConsts.HG
  );
  await env.router.createMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.wonderlandFutureYieldToken.address,
    env.testToken.address,
    teConsts.HG
  );
  const wonderlandMarket = await env.data.getMarket(
    env.pconsts.common.GENERIC_MARKET_FACTORY_ID,
    env.wonderlandFutureYieldToken.address,
    env.testToken.address
  );
  env.wonderlandMarket = await getContract('PendleGenericMarket', wonderlandMarket);
  console.log('Done deploying Wonderland Market');
}

async function distributeTestTokens(env: TestEnv) {
  const totalSupply = await env.testToken.totalSupply();
  for (let i = 1; i < 5; i++) {
    let person = wallets[i];
    await env.testToken.transfer(person.address, totalSupply.div(5), teConsts.HG);
  }
  await approveAll([env.testToken], [env.router]);
}

async function deployMockMarketMath(env: TestEnv) {
  env.mockMarketMath = await deployContract('MockMarketMath', []);
}
