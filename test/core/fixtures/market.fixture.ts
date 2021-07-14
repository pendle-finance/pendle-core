import { Contract, providers, Wallet } from 'ethers';
import hre from 'hardhat';
import PendleCompoundMarket from '../../../build/artifacts/contracts/core/compound/PendleCompoundMarket.sol/PendleCompoundMarket.json';
import MockPendleAaveMarket from '../../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';
import TestToken from '../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json';
import MockMarketMath from '../../../build/artifacts/contracts/mock/MockMarketMath.sol/MockMarketMath.json';
import { consts, emptyToken, getA2Contract, getCContract, tokens, mintXytAave, mintXytCompound } from '../../helpers';
import { AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { RouterFixture, routerFixtureNoMint } from './router.fixture';
const { waffle } = hre;
const { deployContract, loadFixture } = waffle;

export interface MarketFixture {
  routerFix: RouterFixture;
  core: CoreFixture;
  a2Forge: AaveV2ForgeFixture;
  cForge: CompoundFixture;
  testToken: Contract;
  a2Market: Contract;
  a2Market18: Contract;
  cMarket: Contract;
  a2MarketEth: Contract;
  cMarketEth: Contract;
  cMarket8: Contract;
  mockMarketMath: Contract;
}

export async function marketFixture(_: Wallet[], provider: providers.Web3Provider): Promise<MarketFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  const routerFix = await loadFixture(routerFixtureNoMint);
  const { core, a2Forge, cForge } = routerFix;
  const { router, a2MarketFactory, cMarketFactory, data } = core;
  const { a2FutureYieldToken, a2FutureYieldToken18 } = a2Forge;
  const { cFutureYieldToken, cFutureYieldToken8 } = cForge;

  const testToken = await deployContract(alice, TestToken, ['Test Token', 'TEST', 6]);

  for (var person of [alice, bob, charlie, dave]) {
    await mintXytAave(tokens.USDT, person, consts.INITIAL_OT_XYT_AMOUNT, routerFix, consts.T0_A2.add(consts.SIX_MONTH));
    await mintXytAave(tokens.UNI, person, consts.INITIAL_OT_XYT_AMOUNT, routerFix, consts.T0_A2.add(consts.SIX_MONTH));
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

  const totalSupply = await testToken.totalSupply();
  for (var person of [bob, charlie, dave, eve]) {
    await testToken.transfer(person.address, totalSupply.div(5));
  }

  await data.addMarketFactory(consts.MARKET_FACTORY_AAVE_V2, a2MarketFactory.address);
  await data.addMarketFactory(consts.MARKET_FACTORY_COMPOUND, cMarketFactory.address);

  await data.setForgeFactoryValidity(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true);
  await data.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true);

  // a2XYT - testToken
  await router.createMarket(consts.MARKET_FACTORY_AAVE_V2, a2FutureYieldToken.address, testToken.address, consts.HG);

  // a2XYT18 - testToken
  await router.createMarket(consts.MARKET_FACTORY_AAVE_V2, a2FutureYieldToken18.address, testToken.address, consts.HG);

  // cXYT - testToken
  await router.createMarket(consts.MARKET_FACTORY_COMPOUND, cFutureYieldToken.address, testToken.address, consts.HG);

  // cXYT18 - testToken
  await router.createMarket(consts.MARKET_FACTORY_COMPOUND, cFutureYieldToken8.address, testToken.address, consts.HG);

  // a2XYT - WETH
  await router.createMarket(consts.MARKET_FACTORY_AAVE_V2, a2FutureYieldToken.address, tokens.WETH.address, consts.HG);

  // cXYT - WETH
  await router.createMarket(consts.MARKET_FACTORY_COMPOUND, cFutureYieldToken.address, tokens.WETH.address, consts.HG);

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

  const a2MarketEthAddress = await data.getMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2FutureYieldToken.address,
    tokens.WETH.address
  );

  const cMarketEthAddress = await data.getMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cFutureYieldToken.address,
    tokens.WETH.address
  );

  const a2Market = new Contract(a2MarketAddress, MockPendleAaveMarket.abi, alice);
  const a2Market18 = new Contract(a2Market18Address, MockPendleAaveMarket.abi, alice);
  const cMarket = new Contract(cMarketAddress, PendleCompoundMarket.abi, alice);
  const cMarket8 = new Contract(cMarket8Address, PendleCompoundMarket.abi, alice);
  const a2MarketEth = new Contract(a2MarketEthAddress, MockPendleAaveMarket.abi, alice);
  const cMarketEth = new Contract(cMarketEthAddress, MockPendleAaveMarket.abi, alice);
  const mockMarketMath: Contract = await deployContract(alice, MockMarketMath);

  for (var person of [alice, bob, charlie, dave, eve]) {
    await testToken.connect(person).approve(router.address, totalSupply);
  }

  return {
    routerFix,
    core,
    a2Forge,
    cForge,
    testToken,
    a2Market,
    a2Market18,
    cMarket,
    cMarket8,
    a2MarketEth,
    cMarketEth,
    mockMarketMath,
  };
}
