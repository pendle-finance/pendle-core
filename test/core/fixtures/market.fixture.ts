import { Contract, providers, Wallet } from 'ethers';
import PendleCompoundMarket from '../../../build/artifacts/contracts/core/compound/PendleCompoundMarket.sol/PendleCompoundMarket.json';
import MockPendleAaveMarket from '../../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json';
import TestToken from '../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json';
import { consts, mintXytAave, mintXytCompound, tokens } from '../../helpers';
import { AaveV2ForgeFixture } from './aaveV2Forge.fixture';
import { CompoundFixture } from './compoundForge.fixture';
import { CoreFixture } from './core.fixture';
import { RouterFixture, routerFixtureNoMint } from './router.fixture';
const { waffle } = require('hardhat');
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
  marketEth: Contract;
}

export async function marketFixture(_: Wallet[], provider: providers.Web3Provider): Promise<MarketFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets;
  const routerFix = await loadFixture(routerFixtureNoMint);
  const { core, a2Forge, cForge } = routerFix;
  const { router, a2MarketFactory, cMarketFactory, data } = core;
  const { a2FutureYieldToken, aaveV2Forge, a2FutureYieldToken18 } = a2Forge;
  const { cFutureYieldToken } = cForge;

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

  // a2XYT - WETH
  await router.createMarket(consts.MARKET_FACTORY_AAVE_V2, a2FutureYieldToken.address, tokens.WETH.address, consts.HG);

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

  const marketEthAddress = await data.getMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2FutureYieldToken.address,
    tokens.WETH.address
  );

  const a2Market = new Contract(a2MarketAddress, MockPendleAaveMarket.abi, alice);
  const a2Market18 = new Contract(a2Market18Address, MockPendleAaveMarket.abi, alice);
  const cMarket = new Contract(cMarketAddress, PendleCompoundMarket.abi, alice);
  const marketEth = new Contract(marketEthAddress, MockPendleAaveMarket.abi, alice);

  for (var person of [alice, bob, charlie, dave, eve]) {
    await testToken.connect(person).approve(router.address, totalSupply);
  }

  return { routerFix, core, a2Forge, cForge, testToken, a2Market, a2Market18, cMarket, marketEth };
}
