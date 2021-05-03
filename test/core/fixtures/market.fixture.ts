import { BigNumber as BN, Contract, providers, Wallet } from "ethers";
import PendleAaveMarket from "../../../build/artifacts/contracts/core/PendleAaveMarket.sol/PendleAaveMarket.json";
import PendleCompoundMarket from "../../../build/artifacts/contracts/core/PendleCompoundMarket.sol/PendleCompoundMarket.json";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import { consts, mintOtAndXyt, tokens } from "../../helpers";
import { aaveForgeFixture, AaveForgeFixture } from "./aaveForge.fixture";
import { aaveV2ForgeFixture, AaveV2ForgeFixture } from "./aaveV2Forge.fixture";
import {
  CompoundFixture, compoundForgeFixture
} from './compoundForge.fixture';
import { CoreFixture, coreFixture } from "./core.fixture";
import {
  governanceFixture
} from "./governance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface MarketFixture {
  core: CoreFixture,
  aForge: AaveForgeFixture,
  a2Forge: AaveV2ForgeFixture,
  cForge: CompoundFixture,
  testToken: Contract,
  aMarket: Contract,
  a2Market: Contract,
  cMarket: Contract,
  ethMarket: Contract,
}

export async function marketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<MarketFixture> {
  const [alice, bob, charlie, dave, eve] = wallets
  const core = await coreFixture(wallets, provider);
  const governance = await governanceFixture(wallets, provider);
  const aForge = await aaveForgeFixture(alice, provider, core, governance);
  const a2Forge = await aaveV2ForgeFixture(alice, provider, core, governance);
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const { router, aMarketFactory, a2MarketFactory, cMarketFactory, data } = core;

  const {
    aFutureYieldToken,
    aaveForge
  } = aForge;
  const {
    a2FutureYieldToken,
    aaveV2Forge
  } = a2Forge;
  const {
    cFutureYieldToken,
  } = cForge;
  const token = tokens.USDT;

  for (var person of [alice, bob, charlie]) {
    await mintOtAndXyt(provider, token, person, consts.INITIAL_OT_XYT_AMOUNT, router, aaveForge, aaveV2Forge);
  }

  const testToken = await deployContract(alice, TestToken, [
    "Test Token",
    "TEST",
    6,
  ]);
  const totalSupply = await testToken.totalSupply();

  for (var person of [bob, charlie, dave, eve]) {
    // no alice since alice is holding all tokens
    await testToken.transfer(person.address, totalSupply.div(5));
  }

  await router.addMarketFactory(
    consts.MARKET_FACTORY_AAVE,
    aMarketFactory.address
  );
  await router.addMarketFactory(
    consts.MARKET_FACTORY_AAVE_V2,
    a2MarketFactory.address
  );
  await router.addMarketFactory(
    consts.MARKET_FACTORY_COMPOUND,
    cMarketFactory.address
  );

  await data.setForgeFactoryValidity(consts.FORGE_AAVE, consts.MARKET_FACTORY_AAVE, true);
  await data.setForgeFactoryValidity(consts.FORGE_AAVE_V2, consts.MARKET_FACTORY_AAVE_V2, true);
  await data.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true);

  // aXYT - testToken
  await router.createMarket(
    consts.MARKET_FACTORY_AAVE,
    aFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

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

  // aXYT - WETH
  await router.createMarket(
    consts.MARKET_FACTORY_AAVE,
    aFutureYieldToken.address,
    tokens.WETH.address,
    consts.HIGH_GAS_OVERRIDE
  );

  const aMarketAddress = await data.getMarket(
    consts.MARKET_FACTORY_AAVE,
    aFutureYieldToken.address,
    testToken.address
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

  const ethMarketAddress = await data.getMarket(
    consts.MARKET_FACTORY_AAVE,
    aFutureYieldToken.address,
    tokens.WETH.address,
  );

  const aMarket = new Contract(
    aMarketAddress,
    PendleAaveMarket.abi,
    alice
  );
  const a2Market = new Contract(
    a2MarketAddress,
    PendleAaveMarket.abi,
    alice
  );
  const cMarket = new Contract(
    cMarketAddress,
    PendleCompoundMarket.abi,
    alice
  );
  const ethMarket = new Contract(
    ethMarketAddress,
    PendleAaveMarket.abi,
    alice
  );

  for (var person of [alice, bob, charlie, dave, eve]) {
    await testToken.connect(person).approve(router.address, totalSupply);
    await aFutureYieldToken
      .connect(person)
      .approve(router.address, consts.INF);
    await a2FutureYieldToken
      .connect(person)
      .approve(router.address, consts.INF);
    await cFutureYieldToken
      .connect(person)
      .approve(router.address, consts.INF);
    await aMarket
      .connect(person)
      .approve(router.address, consts.INF);
    await a2Market
      .connect(person)
      .approve(router.address, consts.INF);
    await cMarket
      .connect(person)
      .approve(router.address, consts.INF);
    await ethMarket.connect(person).approve(router.address, consts.INF);
  }

  return { core, aForge, a2Forge, cForge, testToken, aMarket, a2Market, cMarket, ethMarket }
}
