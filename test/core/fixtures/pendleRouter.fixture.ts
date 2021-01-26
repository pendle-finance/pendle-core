import { Contract, Wallet, providers } from 'ethers'
import PendleRouter from '../../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import PendleAaveMarketFactory from "../../../build/artifacts/contracts/core/PendleAaveMarketFactory.sol/PendleAaveMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import { constants, tokens } from "../../helpers/Constants"
import { createFixtureLoader } from "ethereum-waffle";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

export interface PendleRouterFixture {
  pendleRouter: Contract
  pendleTreasury: Contract
  pendleAaveMarketFactory: Contract
  pendleData: Contract
}

export async function pendleRouterFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleRouterFixture> {
  const pendleRouter = await deployContract(wallet, PendleRouter, [wallet.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(wallet, PendleTreasury, [wallet.address]);
  const pendleAaveMarketFactory = await deployContract(wallet, PendleAaveMarketFactory, [wallet.address, constants.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(wallet, PendleData, [wallet.address, pendleTreasury.address]);

  await pendleAaveMarketFactory.initialize(pendleRouter.address);
  await pendleData.initialize(pendleRouter.address);
  await pendleRouter.initialize(pendleData.address);

  return { pendleRouter, pendleTreasury, pendleAaveMarketFactory, pendleData }
}
