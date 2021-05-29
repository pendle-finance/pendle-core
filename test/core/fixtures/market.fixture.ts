import { Contract, providers, Wallet } from "ethers";
import PendleCompoundMarket from "../../../build/artifacts/contracts/core/compound/PendleCompoundMarket.sol/PendleCompoundMarket.json";
import MockPendleAaveMarket from "../../../build/artifacts/contracts/mock/MockPendleAaveMarket.sol/MockPendleAaveMarket.json";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import { consts, emptyToken, getA2Contract, getCContract, mintOtAndXyt, tokens } from "../../helpers";
import { AaveV2ForgeFixture } from "./aaveV2Forge.fixture";
import {
  CompoundFixture
} from './compoundForge.fixture';
import { CoreFixture } from "./core.fixture";
import { RouterFixture, routerFixtureNoMint } from "./router.fixture";
import hre from 'hardhat';
const { waffle } = hre;
const { deployContract, loadFixture } = waffle;

export interface MarketFixture {
  routerFix: RouterFixture
  core: CoreFixture,
  a2Forge: AaveV2ForgeFixture,
  cForge: CompoundFixture,
  testToken: Contract,
  a2Market: Contract,
  cMarket: Contract,
  marketEth: Contract,
}

export async function marketFixture(
  _: Wallet[],
  provider: providers.Web3Provider
): Promise<MarketFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice, bob, charlie, dave, eve] = wallets
  const routerFix = await loadFixture(routerFixtureNoMint);
  const { core, a2Forge, cForge } = routerFix;
  const { router, a2MarketFactory, cMarketFactory, data } = core;
  const {
    a2FutureYieldToken,
    aaveV2Forge
  } = a2Forge;
  const {
    cFutureYieldToken,
  } = cForge;
  const token = tokens.USDT;

  const testToken = await deployContract(alice, TestToken, [
    "Test Token",
    "TEST",
    6,
  ]);

  const a2Contract = await getA2Contract(alice, a2Forge.aaveV2Forge, tokens.USDT);
  await emptyToken(a2Contract, alice);
  const cContract = await getCContract(alice, tokens.USDT);
  await emptyToken(cContract, alice);

  for (var person of [alice, bob, charlie, dave]) {
    await mintOtAndXyt(token, person, consts.INITIAL_OT_XYT_AMOUNT, routerFix);
  }

  const totalSupply = await testToken.totalSupply();
  for (var person of [bob, charlie, dave, eve]) {
    await testToken.transfer(person.address, totalSupply.div(5));
  }

  await data.addMarketFactory(
    consts.MARKET_FACTORY_AAVE_V2,
    a2MarketFactory.address
  );
  await data.addMarketFactory(
    consts.MARKET_FACTORY_COMPOUND,
    cMarketFactory.address
  );

  await data.setForgeFactoryValidity(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true);
  await data.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true);

  // a2XYT - testToken
  await router.createMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2FutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  // cXYT - testToken
  await router.createMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  // a2XYT - WETH
  await router.createMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2FutureYieldToken.address,
    tokens.WETH.address,
    consts.HIGH_GAS_OVERRIDE
  );

  const a2MarketAddress = await data.getMarket(
    consts.MARKET_FACTORY_AAVE_V2,
    a2FutureYieldToken.address,
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
    tokens.WETH.address,
  );

  const a2Market = new Contract(
    a2MarketAddress,
    MockPendleAaveMarket.abi,
    alice
  );
  const cMarket = new Contract(
    cMarketAddress,
    PendleCompoundMarket.abi,
    alice
  );
  const marketEth = new Contract(
    marketEthAddress,
    MockPendleAaveMarket.abi,
    alice
  );

  for (var person of [alice, bob, charlie, dave, eve]) {
    await testToken.connect(person).approve(router.address, totalSupply);
  }

  return { routerFix, core, a2Forge, cForge, testToken, a2Market, cMarket, marketEth }
}
