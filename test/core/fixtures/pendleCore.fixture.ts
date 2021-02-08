import { Contract, providers, Wallet } from 'ethers'
import Pendle from '../../../build/artifacts/contracts/core/Pendle.sol/Pendle.json'
import PendleMarketFactory from "../../../build/artifacts/contracts/core/PendleMarketFactory.sol/PendleMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import { consts, tokens } from "../../helpers"


const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCoreFixture {
  pendle: Contract
  pendleTreasury: Contract
  pendleMarketFactory: Contract
  pendleData: Contract
}

export async function pendleCoreFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleCoreFixture> {
  const pendle = await deployContract(alice, Pendle, [alice.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const pendleMarketFactory = await deployContract(alice, PendleMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(alice, PendleData, [alice.address]);

  await pendleMarketFactory.initialize(pendle.address);
  await pendleData.initialize(pendle.address);
  await pendle.initialize(pendleData.address, pendleTreasury.address);

  return { pendle, pendleTreasury, pendleMarketFactory, pendleData }
}
