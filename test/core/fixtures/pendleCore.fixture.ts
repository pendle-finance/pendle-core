import { Contract, providers, Wallet } from 'ethers'
import Pendle from '../../../build/artifacts/contracts/core/Pendle.sol/Pendle.json'
import PendleAaveMarketFactory from "../../../build/artifacts/contracts/core/PendleAaveMarketFactory.sol/PendleAaveMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import { consts, tokens } from "../../helpers"


const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCoreFixture {
  pendle: Contract
  pendleTreasury: Contract
  pendleAaveMarketFactory: Contract
  pendleData: Contract
}

export async function pendleCoreFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleCoreFixture> {
  const pendle = await deployContract(alice, Pendle, [alice.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const pendleAaveMarketFactory = await deployContract(alice, PendleAaveMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(alice, PendleData, [alice.address]);

  await pendleAaveMarketFactory.initialize(pendle.address);
  await pendleData.initialize(pendle.address);
  await pendle.initialize(pendleData.address, pendleTreasury.address);

  return { pendle, pendleTreasury, pendleAaveMarketFactory, pendleData }
}
