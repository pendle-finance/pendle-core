import { Wallet, providers, BigNumber, Contract } from "ethers";
import { pendleCoreFixture, PendleCoreFixture } from "./pendleCore.fixture";
import {
  pendleAaveForgeFixture,
  PendleAaveFixture,
} from "./pendleAaveForge.fixture";
import {
  pendleCompoundForgeFixture,
  PendleCompoundFixture,
} from "./pendleCompoundForge.fixture";
import {
  pendleGovernanceFixture,
  PendleGovernanceFixture,
} from "./pendleGovernance.fixture";
import { aaveFixture, AaveFixture } from "./aave.fixture";
import { consts, tokens, mintOtAndXyt, amountToWei } from "../../helpers";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface PendleMarketFixture {
  core: PendleCoreFixture;
  aForge: PendleAaveFixture;
  cForge: PendleCompoundFixture;
  aave: AaveFixture;
  testToken: Contract;
  pendleAMarket: Contract;
  pendleCMarket: Contract;
}

export async function pendleMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleMarketFixture> {
  const [alice, bob, charlie] = wallets;
  const core = await pendleCoreFixture(wallets, provider);

  const governance = await pendleGovernanceFixture(wallets, provider);

  const aForge = await pendleAaveForgeFixture(
    alice,
    provider,
    core,
    governance
  );
  const cForge = await pendleCompoundForgeFixture(
    alice,
    provider,
    core,
    governance
  );
  const aave = await aaveFixture(alice);
  const { pendleRouter, pendleAMarketFactory, pendleCMarketFactory, pendleData } = core;

  const {
    pendleAaveForge,
    pendleFutureYieldAToken,
    // pendleFutureYieldAToken2,
  } = aForge;
  const { pendleCompoundForge, pendleFutureYieldCToken } = cForge;
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

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldAToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_COMPOUND,
    pendleFutureYieldCToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );
  const pendleAMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldAToken.address,
    testToken.address
  );

  const pendleCMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_COMPOUND,
    pendleFutureYieldCToken.address,
    testToken.address
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

  for (var person of [alice, bob, charlie]) {
    await testToken.connect(person).approve(pendleRouter.address, totalSupply);
    await pendleFutureYieldAToken
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleFutureYieldCToken
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleAMarket
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleCMarket
      .connect(person)
      .approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  }

  return {
    core,
    aave,
    aForge,
    cForge,
    testToken,
    pendleAMarket,
    pendleCMarket,
  };
}
