import { BigNumber as BN, Contract, providers, Wallet } from "ethers";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import { amountToWei, consts, mintOtAndXyt, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from "./aave.fixture";
import {
  PendleAaveFixture, pendleAaveForgeFixture
} from "./pendleAaveForge.fixture";
import {
  PendleCompoundFixture, pendleCompoundForgeFixture
} from './pendleCompoundForge.fixture';
import { pendleCoreFixture, PendleCoreFixture } from "./pendleCore.fixture";
import {
  pendleGovernanceFixture
} from "./pendleGovernance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface PendleMarketFixture {
  core: PendleCoreFixture,
  aForge: PendleAaveFixture,
  cForge: PendleCompoundFixture,
  aave: AaveFixture,
  testToken: Contract,
  pendleAMarket: Contract,
  pendleCMarket: Contract,
  pendleEthMarket: Contract,
}

export async function pendleMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleMarketFixture> {
  const [alice, bob, charlie, dave, eve] = wallets
  const core = await pendleCoreFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const aForge = await pendleAaveForgeFixture(alice, provider, core, governance);
  const cForge = await pendleCompoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);
  const { pendleRouter, pendleAMarketFactory, pendleCMarketFactory, pendleData } = core;

  const {
    pendleAFutureYieldToken,
    pendleAFutureYieldToken2,
  } = aForge;
  const {
    pendleCFutureYieldToken,
  } = cForge;
  const token = tokens.USDT;

  const amount = amountToWei(token, consts.INITIAL_OT_XYT_AMOUNT);

  for (var person of [alice, bob, charlie]) {
    await mintOtAndXyt(provider, token, person, amount, pendleRouter);
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

  await pendleRouter.addMarketFactory(
    consts.MARKET_FACTORY_AAVE,
    pendleAMarketFactory.address
  );
  await pendleRouter.addMarketFactory(
    consts.MARKET_FACTORY_COMPOUND,
    pendleCMarketFactory.address
  );

  await pendleData.setForgeFactoryValidity(consts.FORGE_AAVE, consts.MARKET_FACTORY_AAVE, true);
  await pendleData.setForgeFactoryValidity(consts.FORGE_COMPOUND, consts.MARKET_FACTORY_COMPOUND, true);

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleAFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_COMPOUND,
    pendleCFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleAFutureYieldToken.address,
    tokens.WETH.address,
    consts.HIGH_GAS_OVERRIDE
  );

  const pendleAMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleAFutureYieldToken.address,
    testToken.address
  );

  const pendleCMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_COMPOUND,
    pendleCFutureYieldToken.address,
    testToken.address
  );

  const pendleEthMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleAFutureYieldToken.address,
    tokens.WETH.address,
  );

  const pendleAMarket = new Contract(
    pendleAMarketAddress,
    PendleMarket.abi,
    alice
  );
  const pendleCMarket = new Contract(
    pendleCMarketAddress,
    PendleMarket.abi,
    alice
  );
  const pendleEthMarket = new Contract(
    pendleEthMarketAddress,
    PendleMarket.abi,
    alice
  );

  await pendleData.setReentrancyWhitelist([pendleAMarketAddress, pendleCMarketAddress, pendleEthMarketAddress], [true, true, true]);
  await pendleData.setLockParams(BN.from(consts.LOCK_NUMERATOR), BN.from(consts.LOCK_DENOMINATOR)); // lock market

  for (var person of [alice, bob, charlie, dave]) {
    await testToken.connect(person).approve(pendleRouter.address, totalSupply);
    await pendleAFutureYieldToken
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleCFutureYieldToken
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleAMarket
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleCMarket
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleEthMarket.connect(person).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  }

  return { core, aForge, cForge, aave, testToken, pendleAMarket, pendleCMarket, pendleEthMarket }
}
