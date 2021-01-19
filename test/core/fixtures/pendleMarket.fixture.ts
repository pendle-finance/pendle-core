import { Wallet, providers, BigNumber, Contract } from 'ethers'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { constants, tokens, mintAproveTokenizeYield, amountToWei } from "../../helpers";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json"
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
  provider: providers.Web3Provider
): Promise<PendleMarketFixture> {
  const [wallet, wallet1] = wallets
  const core = await pendleCoreFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, core);
  const aave = await aaveFixture(wallet);
  const { pendle, pendleAaveMarketFactory, pendleData } = core;
  const { pendleAaveForge, pendleFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, BigNumber.from(100));

  await mintAproveTokenizeYield(provider, token, wallet, amount, pendle, pendleAaveForge);
  await mintAproveTokenizeYield(provider, token, wallet1, amount, pendle, pendleAaveForge);

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(wallet1.address, totalSupply.div(2))

  await pendle.addMarketFactory(constants.FORGE_AAVE, constants.MARKET_FACTORY_AAVE, pendleAaveMarketFactory.address);

  await pendleAaveMarketFactory.createMarket(
    pendleFutureYieldToken.address,
    testToken.address,
    constants.SIX_MONTH_FROM_NOW,
    constants.HIGH_GAS_OVERRIDE
  );

  const pendleMarketAddress = await pendleData.getMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  const pendleMarket = new Contract(pendleMarketAddress, PendleMarket.abi, wallet)
  await testToken.approve(pendleMarketAddress, totalSupply);
  await testToken.connect(wallet1).approve(pendleMarketAddress, totalSupply);

  await pendleFutureYieldToken.approve(pendleMarketAddress, constants.MAX_ALLOWANCE);
  await pendleFutureYieldToken.connect(wallet1).approve(pendleMarketAddress, constants.MAX_ALLOWANCE);

  return { core, aave, forge, testToken, pendleMarket }
}
