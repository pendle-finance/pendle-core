import { Contract, Wallet, providers } from 'ethers'
import Pendle from '../../../build/artifacts/contracts/core/Pendle.sol/Pendle.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import PendleAaveMarketFactory from "../../../build/artifacts/contracts/core/PendleAaveMarketFactory.sol/PendleAaveMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import { constants, tokens } from "../../helpers/Constants"


const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCoreFixture {
  pendle: Contract
  pendleTreasury: Contract
  pendleAaveMarketFactory: Contract
  pendleData: Contract
}

export async function pendleCoreFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<PendleCoreFixture> {
  const pendle = await deployContract(wallet, Pendle, [wallet.address, tokens.WETH.address]);
  const pendleTreasury = await deployContract(wallet, PendleTreasury, [wallet.address]);
  const pendleAaveMarketFactory = await deployContract(wallet, PendleAaveMarketFactory, [wallet.address, constants.MARKET_FACTORY_AAVE]);
  const pendleData = await deployContract(wallet, PendleData, [wallet.address]);

  await pendleAaveMarketFactory.initialize(pendle.address);
  await pendleData.initialize(pendle.address);
  await pendle.initialize(pendleData.address, pendleTreasury.address);

  return { pendle, pendleTreasury, pendleAaveMarketFactory, pendleData }
}
