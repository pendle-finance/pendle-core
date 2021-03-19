import { BigNumber as BN, Contract, providers, Wallet } from "ethers";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import { amountToWei, consts, mintOtAndXyt, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from "./aave.fixture";
import { aaveForgeFixture, AaveForgeFixture } from "./aaveForge.fixture";
import {
  CompoundFixture, compoundForgeFixture
} from './compoundForge.fixture';
import { CoreFixture, coreFixture } from "./core.fixture";
import {
  governanceFixture
} from "./governance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface MarketFixture {
  core: CoreFixture,
  aForge: AaveForgeFixture,
  cForge: CompoundFixture,
  aave: AaveFixture,
  testToken: Contract,
  aMarket: Contract,
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
  const cForge = await compoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);
  const { router, aMarketFactory, cMarketFactory, data } = core;

  const {
    aFutureYieldToken,
    aFutureYieldToken2,
  } = aForge;
  const {
    cFutureYieldToken,
  } = cForge;
  const token = tokens.USDT;

  for (var person of [alice, bob, charlie]) {
    await mintOtAndXyt(provider, token, person, consts.INITIAL_OT_XYT_AMOUNT, router);
  }

  const testToken = await deployContract(alice, TestToken, [
    "Test Token",
    "TEST",
    6,
  ]);
  const totalSupply = await testToken.totalSupply();

  for (var person of [bob, charlie]) {
    // no alice since alice is holding all tokens
    await testToken.transfer(person.address, totalSupply.div(4));
  }

  await router.addMarketFactory(
    consts.MARKET_FACTORY_AAVE,
    aMarketFactory.address
  );
  await router.addMarketFactory(
    consts.MARKET_FACTORY_COMPOUND,
    cMarketFactory.address
  );

  await data.setForgeFactoryValidity(consts.FORGE_AAVE, consts.MARKET_FACTORY_AAVE, true);
  await data.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true);

  await router.createMarket(
    consts.MARKET_FACTORY_AAVE,
    aFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  await router.createMarket(
    consts.MARKET_FACTORY_COMPOUND,
    cFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

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
    PendleMarket.abi,
    alice
  );
  const cMarket = new Contract(
    cMarketAddress,
    PendleMarket.abi,
    alice
  );
  const ethMarket = new Contract(
    ethMarketAddress,
    PendleMarket.abi,
    alice
  );

  await data.setReentrancyWhitelist([aMarketAddress, cMarketAddress, ethMarketAddress], [true, true, true]);
  await data.setLockParams(BN.from(consts.LOCK_NUMERATOR), BN.from(consts.LOCK_DENOMINATOR)); // lock market

  for (var person of [alice, bob, charlie, dave]) {
    await testToken.connect(person).approve(router.address, totalSupply);
    await aFutureYieldToken
      .connect(person)
      .approve(router.address, consts.MAX_ALLOWANCE);
    await cFutureYieldToken
      .connect(person)
      .approve(router.address, consts.MAX_ALLOWANCE);
    await aMarket
      .connect(person)
      .approve(router.address, consts.MAX_ALLOWANCE);
    await cMarket
      .connect(person)
      .approve(router.address, consts.MAX_ALLOWANCE);
    await ethMarket.connect(person).approve(router.address, consts.MAX_ALLOWANCE);
  }

  return { core, aForge, cForge, aave, testToken, aMarket, cMarket, ethMarket }
}
