import { Contract, providers, Wallet } from 'ethers';
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import { amountToWei, consts, mintOtAndXyt, tokens } from "../../helpers";
import { aaveFixture, AaveFixture } from './aave.fixture';
import { PendleAaveFixture, pendleAaveForgeFixture } from './pendleAaveForge.fixture';
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface PendleMarketFixture {
  core: PendleCoreFixture,
  forge: PendleAaveFixture,
  aave: AaveFixture,
  testToken: Contract,
  pendleMarket: Contract
}

export async function pendleMarketFixture(
  wallets: Wallet[],
  provider: providers.Web3Provider,
): Promise<PendleMarketFixture> {
  const [alice, bob] = wallets
  const core = await pendleCoreFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(alice, provider, core);
  const aave = await aaveFixture(alice);
  const { pendle, pendleAaveMarketFactory, pendleData } = core;
  const { pendleAaveForge, pendleFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, consts.INITIAL_OT_XYT_AMOUNT);

  await mintOtAndXyt(provider, token, alice, amount, pendle, pendleAaveForge);
  await mintOtAndXyt(provider, token, bob, amount, pendle, pendleAaveForge);

  const testToken = await deployContract(alice, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(bob.address, totalSupply.div(2))

  await pendle.addMarketFactory(consts.FORGE_AAVE, consts.MARKET_FACTORY_AAVE, pendleAaveMarketFactory.address);

  await pendleAaveMarketFactory.createMarket(
    pendleFutureYieldToken.address,
    testToken.address,
    consts.T0.add(consts.SIX_MONTH),
    consts.HIGH_GAS_OVERRIDE
  );

  const pendleMarketAddress = await pendleData.getMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  const pendleMarket = new Contract(pendleMarketAddress, PendleMarket.abi, alice)
  await testToken.approve(pendleMarketAddress, totalSupply);
  await testToken.connect(bob).approve(pendleMarketAddress, totalSupply);

  await pendleFutureYieldToken.approve(pendleMarketAddress, consts.MAX_ALLOWANCE);
  await pendleFutureYieldToken.connect(bob).approve(pendleMarketAddress, consts.MAX_ALLOWANCE);

  return { core, aave, forge, testToken, pendleMarket }
}
