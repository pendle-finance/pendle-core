import { Contract, Wallet, providers } from 'ethers'
import PendleRouter from '../../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import PendleMarketFactory from "../../../build/artifacts/contracts/core/PendleMarketFactory.sol/PendleMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import { consts, tokens } from "../../helpers"
import { createFixtureLoader } from "ethereum-waffle";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

export interface PendleCoreFixture {
  pendleRouter: Contract
  pendleTreasury: Contract
  pendleMarketFactory: Contract
  pendleData: Contract
}

export async function pendleCoreFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleCoreFixture> {
  const pendleRouter = await deployContract(wallet, PendleRouter, [wallet.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(wallet, PendleTreasury, [wallet.address]);
  const pendleMarketFactory = await deployContract(wallet, PendleMarketFactory, [wallet.address, consts.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(wallet, PendleData, [wallet.address, pendleTreasury.address]);

  await pendleMarketFactory.initialize(pendleRouter.address);
  await pendleData.initialize(pendleRouter.address);
  await pendleRouter.initialize(pendleData.address);

  return { pendleRouter, pendleTreasury, pendleMarketFactory, pendleData }
}
