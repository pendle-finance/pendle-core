import { Wallet, providers, BigNumber as BN, Contract } from "ethers";
import { pendleCoreFixture, PendleCoreFixture } from "./pendleCore.fixture";
import {
  pendleAaveForgeFixture,
  PendleAaveFixture,
} from "./pendleAaveForge.fixture";
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
  core: PendleCoreFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
  testToken: Contract,
  pendleStdMarket: Contract
  pendleEthMarket: Contract
}

export async function pendleMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleMarketFixture> {
  const [alice, bob, charlie, dave, eve] = wallets
  const core = await pendleCoreFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);
  const { pendleRouter, pendleMarketFactory, pendleData } = core;
  const { pendleFutureYieldToken } = forge;
  const token = tokens.USDT

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
    pendleMarketFactory.address
  );

  await pendleData.setForgeFactoryValidity(consts.FORGE_AAVE, consts.MARKET_FACTORY_AAVE, true);

  await pendleRouter.createMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  const pendleStdMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  const pendleEthMarketAddress = await pendleData.getMarket(
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    tokens.WETH.address,
  );

  await pendleData.setReentrancyWhitelist([pendleStdMarketAddress, pendleEthMarketAddress], [true, true]);

  const pendleStdMarket = new Contract(pendleStdMarketAddress, PendleMarket.abi, alice)
  const pendleEthMarket = new Contract(pendleEthMarketAddress, PendleMarket.abi, alice)

  for (var person of [alice, bob, charlie, dave]) {
    await testToken.connect(person).approve(pendleRouter.address, totalSupply);
    await pendleFutureYieldToken.connect(person).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleStdMarket.connect(person).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
    await pendleEthMarket.connect(person).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  }

  return { core, aave, forge, testToken, pendleStdMarket, pendleEthMarket }
}
