import { Wallet, providers, BigNumber, Contract } from 'ethers'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { pendleCompoundForgeFixture, PendleCompoundFixture } from './pendleCompoundForge.fixture'
import { pendleGovernanceFixture, PendleGovernanceFixture } from './pendleGovernance.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { consts, tokens, mintOtAndXyt, amountToWei } from "../../helpers";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json"

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
}

export async function pendleMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleMarketFixture> {
  const [alice, bob] = wallets
  const core = await pendleCoreFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const aForge = await pendleAaveForgeFixture(alice, provider, core, governance);
  const cForge = await pendleCompoundForgeFixture(alice, provider, core, governance);
  const aave = await aaveFixture(alice);
  const { pendleRouter, pendleMarketFactory, pendleData } = core;
  const { pendleAaveForge, pendleFutureYieldAToken } = aForge;
  const { pendleCompoundForge, pendleFutureYieldCToken } = cForge;
  const token = tokens.USDT

  const amount = amountToWei(token, consts.INITIAL_OT_XYT_AMOUNT);

  await mintOtAndXyt(provider, token, alice, amount, pendleRouter);
  await mintOtAndXyt(provider, token, bob, amount, pendleRouter);

  const testToken = await deployContract(alice, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(bob.address, totalSupply.div(2))

  await pendleRouter.addMarketFactory(consts.MARKET_FACTORY, pendleMarketFactory.address);

  await pendleRouter.createMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY,
    pendleFutureYieldAToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  await pendleRouter.createMarket(
    consts.FORGE_COMPOUND,
    consts.MARKET_FACTORY,
    pendleFutureYieldCToken.address,
    testToken.address,
    consts.HIGH_GAS_OVERRIDE
  );

  const pendleAMarketAddress = await pendleData.getMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY,
    pendleFutureYieldAToken.address,
    testToken.address
  );

  const pendleCMarketAddress = await pendleData.getMarket(
    consts.FORGE_COMPOUND,
    consts.MARKET_FACTORY,
    pendleFutureYieldCToken.address,
    testToken.address
  );

  const pendleAMarket = new Contract(pendleAMarketAddress, PendleMarket.abi, alice);
  const pendleCMarket = new Contract(pendleCMarketAddress, PendleMarket.abi, alice);
  await testToken.approve(pendleRouter.address, totalSupply);
  await testToken.connect(bob).approve(pendleRouter.address, totalSupply);

  await pendleFutureYieldAToken.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleFutureYieldAToken.connect(bob).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleFutureYieldCToken.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleFutureYieldCToken.connect(bob).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleAMarket.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleAMarket.connect(bob).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleCMarket.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleCMarket.connect(bob).approve(pendleRouter.address, consts.MAX_ALLOWANCE);

  return { core, aave, aForge, cForge, testToken, pendleAMarket, pendleCMarket }
}
