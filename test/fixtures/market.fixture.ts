import { Contract, providers, Wallet } from 'ethers';
import hre from 'hardhat';
import PendleCompoundMarket from '../../build/artifacts/contracts/core/compound/PendleCompoundMarket.sol/PendleCompoundMarket.json';
import PendleGenericMarket from '../../build/artifacts/contracts/core/Generic/PendleGenericMarket.sol/PendleGenericMarket.json';
import MockMarketMath from '../../build/artifacts/contracts/mock/MockMarketMath.sol/MockMarketMath.json';
import MockPendleAaveMarket from '../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';
import TestToken from '../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json';
import {
  consts,
  mintXytAave,
  mintXytCompound,
  mintXytCompoundV2,
  mintXytSushiswapComplexFixed,
  mintXytSushiswapSimpleFixed,
  tokens,
} from '../helpers';
import { AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { RouterFixture, routerFixtureNoMint } from './router.fixture';
import { SushiswapComplexForgeFixture } from './SushiswapComplexForge.fixture';
import { SushiswapSimpleForgeFixture } from './SushiswapSimpleForge.fixture';
import { Mode, checkDisabled } from '.';
import { CompoundV2Fixture } from './compoundV2Forge.fixture';
const { waffle } = hre;
const { deployContract, loadFixture } = waffle;

export interface MarketFixture {
  routerFix: RouterFixture;
  core: CoreFixture;
  a2Forge: AaveV2ForgeFixture;
  cForge: CompoundFixture;
  c2Forge: CompoundV2Fixture;
  scForge: SushiswapComplexForgeFixture;
  ssForge: SushiswapSimpleForgeFixture;
  testToken: Contract;
  a2Market: Contract;
  a2Market18: Contract;
  cMarket: Contract;
  c2Market: Contract;
  a2MarketEth: Contract;
  cMarketEth: Contract;
  cMarket8: Contract;
  c2Market8: Contract;
  scMarket: Contract;
  ssMarket: Contract;
  mockMarketMath: Contract;
}

export async function marketFixture(_: Wallet[], provider: providers.Web3Provider): Promise<MarketFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  const routerFix = await loadFixture(routerFixtureNoMint);
  const { core, a2Forge, cForge, c2Forge, scForge, ssForge } = routerFix;
  const { router, a2MarketFactory, cMarketFactory, data, genMarketFactory } = core;
  const { a2FutureYieldToken, a2FutureYieldToken18 } = a2Forge;
  const { cFutureYieldToken, cFutureYieldToken8 } = cForge;
  const { c2FutureYieldToken, c2FutureYieldToken8 } = c2Forge;
  const { scFutureYieldToken } = scForge;
  const { ssFutureYieldToken } = ssForge;

  const testToken = await deployContract(alice, TestToken, ['Test Token', 'TEST', 6]);
  let a2Market: Contract = {} as Contract;
  let a2Market18: Contract = {} as Contract;
  let cMarket: Contract = {} as Contract;
  let c2Market: Contract = {} as Contract;
  let a2MarketEth: Contract = {} as Contract;
  let cMarketEth: Contract = {} as Contract;
  let cMarket8: Contract = {} as Contract;
  let c2Market8: Contract = {} as Contract;
  let scMarket: Contract = {} as Contract;
  let ssMarket: Contract = {} as Contract;

  if (!checkDisabled(Mode.AAVE_V2)) {
    for (var person of [alice, bob, charlie, dave]) {
      await mintXytAave(
        tokens.USDT,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_A2.add(consts.SIX_MONTH)
      );
      await mintXytAave(
        tokens.UNI,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_A2.add(consts.SIX_MONTH)
      );
    }
    await data.addMarketFactory(consts.MARKET_FACTORY_AAVE_V2, a2MarketFactory.address, consts.HG);
    await data.setForgeFactoryValidity(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true, consts.HG);
    // a2XYT - testToken
    await router.createMarket(consts.MARKET_FACTORY_AAVE_V2, a2FutureYieldToken.address, testToken.address, consts.HG);
    // a2XYT18 - testToken
    await router.createMarket(
      consts.MARKET_FACTORY_AAVE_V2,
      a2FutureYieldToken18.address,
      testToken.address,
      consts.HG
    );
    // a2XYT - WETH
    await router.createMarket(
      consts.MARKET_FACTORY_AAVE_V2,
      a2FutureYieldToken.address,
      tokens.WETH.address,
      consts.HG
    );

    const a2MarketAddress = await data.getMarket(
      consts.MARKET_FACTORY_AAVE_V2,
      a2FutureYieldToken.address,
      testToken.address
    );

    const a2Market18Address = await data.getMarket(
      consts.MARKET_FACTORY_AAVE_V2,
      a2FutureYieldToken18.address,
      testToken.address
    );

    const a2MarketEthAddress = await data.getMarket(
      consts.MARKET_FACTORY_AAVE_V2,
      a2FutureYieldToken.address,
      tokens.WETH.address
    );
    a2Market = new Contract(a2MarketAddress, MockPendleAaveMarket.abi, alice);
    a2Market18 = new Contract(a2Market18Address, MockPendleAaveMarket.abi, alice);
    a2MarketEth = new Contract(a2MarketEthAddress, MockPendleAaveMarket.abi, alice);
  }

  if (!checkDisabled(Mode.COMPOUND)) {
    for (var person of [alice, bob, charlie, dave]) {
      await mintXytCompound(
        tokens.USDT,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_C.add(consts.SIX_MONTH)
      );
      await mintXytCompound(
        tokens.WETH,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_C.add(consts.SIX_MONTH)
      );
    }
    await data.addMarketFactory(consts.MARKET_FACTORY_COMPOUND, cMarketFactory.address, consts.HG);
    await data.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true, consts.HG);
    // cXYT - testToken
    await router.createMarket(consts.MARKET_FACTORY_COMPOUND, cFutureYieldToken.address, testToken.address, consts.HG);
    // cXYT18 - testToken
    await router.createMarket(consts.MARKET_FACTORY_COMPOUND, cFutureYieldToken8.address, testToken.address, consts.HG);
    // cXYT - WETH
    await router.createMarket(
      consts.MARKET_FACTORY_COMPOUND,
      cFutureYieldToken.address,
      tokens.WETH.address,
      consts.HG
    );
    const cMarketAddress = await data.getMarket(
      consts.MARKET_FACTORY_COMPOUND,
      cFutureYieldToken.address,
      testToken.address
    );

    const cMarket8Address = await data.getMarket(
      consts.MARKET_FACTORY_COMPOUND,
      cFutureYieldToken8.address,
      testToken.address
    );

    const cMarketEthAddress = await data.getMarket(
      consts.MARKET_FACTORY_COMPOUND,
      cFutureYieldToken.address,
      tokens.WETH.address
    );
    cMarket = new Contract(cMarketAddress, PendleCompoundMarket.abi, alice);
    cMarket8 = new Contract(cMarket8Address, PendleCompoundMarket.abi, alice);
    cMarketEth = new Contract(cMarketEthAddress, MockPendleAaveMarket.abi, alice);
  }

  if (
    !checkDisabled(Mode.COMPOUND_V2) ||
    !checkDisabled(Mode.SUSHISWAP_SIMPLE) ||
    !checkDisabled(Mode.SUSHISWAP_COMPLEX)
  ) {
    await data.addMarketFactory(consts.MARKET_FACTORY_GENERIC, genMarketFactory.address, consts.HG);
  }

  if (!checkDisabled(Mode.COMPOUND_V2)) {
    for (var person of [alice, bob, charlie, dave]) {
      await mintXytCompoundV2(
        tokens.USDT,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_C2.add(consts.SIX_MONTH)
      );
      await mintXytCompoundV2(
        tokens.WETH,
        person,
        consts.INITIAL_OT_XYT_AMOUNT,
        routerFix,
        consts.T0_C2.add(consts.SIX_MONTH)
      );
    }
    await data.setForgeFactoryValidity(consts.FORGE_COMPOUND_V2, consts.MARKET_FACTORY_GENERIC, true, consts.HG);
    // c2XYT - testToken
    await router.createMarket(consts.MARKET_FACTORY_GENERIC, c2FutureYieldToken.address, testToken.address, consts.HG);
    // c2XYT18 - testToken
    await router.createMarket(consts.MARKET_FACTORY_GENERIC, c2FutureYieldToken8.address, testToken.address, consts.HG);
    // cXYT - WETH
    await router.createMarket(
      consts.MARKET_FACTORY_GENERIC,
      c2FutureYieldToken.address,
      tokens.WETH.address,
      consts.HG
    );
    const c2MarketAddress = await data.getMarket(
      consts.MARKET_FACTORY_GENERIC,
      c2FutureYieldToken.address,
      testToken.address
    );

    const c2Market8Address = await data.getMarket(
      consts.MARKET_FACTORY_GENERIC,
      c2FutureYieldToken8.address,
      testToken.address
    );

    c2Market = new Contract(c2MarketAddress, PendleCompoundMarket.abi, alice);
    c2Market8 = new Contract(c2Market8Address, PendleCompoundMarket.abi, alice);
  }

  if (!checkDisabled(Mode.SUSHISWAP_COMPLEX)) {
    for (var person of [alice, bob, charlie, dave]) {
      await mintXytSushiswapComplexFixed(person, routerFix, consts.T0_SC.add(consts.SIX_MONTH));
    }
    await data.setForgeFactoryValidity(consts.FORGE_SUSHISWAP_COMPLEX, consts.MARKET_FACTORY_GENERIC, true, consts.HG);
    // scXYT - testToken
    await router.createMarket(consts.MARKET_FACTORY_GENERIC, scFutureYieldToken.address, testToken.address, consts.HG);
    const scMarketAddress = await data.getMarket(
      consts.MARKET_FACTORY_GENERIC,
      scFutureYieldToken.address,
      testToken.address
    );
    scMarket = new Contract(scMarketAddress, PendleGenericMarket.abi, alice);
  }

  if (!checkDisabled(Mode.SUSHISWAP_SIMPLE)) {
    for (var person of [alice, bob, charlie, dave]) {
      await mintXytSushiswapSimpleFixed(person, routerFix, consts.T0_SS.add(consts.SIX_MONTH));
    }
    await data.setForgeFactoryValidity(consts.FORGE_SUSHISWAP_SIMPLE, consts.MARKET_FACTORY_GENERIC, true, consts.HG);
    // ssXYT - testToken
    await router.createMarket(consts.MARKET_FACTORY_GENERIC, ssFutureYieldToken.address, testToken.address, consts.HG);
    const ssMarketAddress = await data.getMarket(
      consts.MARKET_FACTORY_GENERIC,
      ssFutureYieldToken.address,
      testToken.address
    );
    ssMarket = new Contract(ssMarketAddress, PendleGenericMarket.abi, alice);
  }

  const totalSupply = await testToken.totalSupply();
  for (var person of [bob, charlie, dave, eve]) {
    await testToken.transfer(person.address, totalSupply.div(5), consts.HG);
  }
  for (var person of [alice, bob, charlie, dave, eve]) {
    await testToken.connect(person).approve(router.address, totalSupply, consts.HG);
  }
  const mockMarketMath: Contract = await deployContract(alice, MockMarketMath);

  return {
    routerFix,
    core,
    a2Forge,
    cForge,
    c2Forge,
    scForge,
    testToken,
    a2Market,
    a2Market18,
    cMarket,
    c2Market,
    cMarket8,
    c2Market8,
    a2MarketEth,
    cMarketEth,
    scMarket,
    mockMarketMath,
    ssForge,
    ssMarket,
  };
}
