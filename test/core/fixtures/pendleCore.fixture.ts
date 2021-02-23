import { Contract, providers, Wallet } from 'ethers'
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import PendleMarketFactory from "../../../build/artifacts/contracts/core/PendleMarketFactory.sol/PendleMarketFactory.json"
import PendleRouter from '../../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import { consts, tokens } from "../../helpers"

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

export interface PendleCoreFixture {
  pendleRouter: Contract
  pendleTreasury: Contract
  pendleMarketFactory: Contract
  pendleData: Contract
}

export async function pendleCoreFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleCoreFixture> {
  const pendleRouter = await deployContract(alice, PendleRouter, [alice.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const pendleMarketFactory = await deployContract(alice, PendleMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(alice, PendleData, [alice.address, pendleTreasury.address]);

  await pendleMarketFactory.initialize(pendleRouter.address);

  await pendleData.initialize(pendleRouter.address);
  await pendleRouter.initialize(pendleData.address);

  return { pendleRouter, pendleTreasury, pendleMarketFactory, pendleData }
}