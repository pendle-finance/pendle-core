import { Contract, providers, Wallet } from 'ethers'
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import PendleMarketFactory from "../../../build/artifacts/contracts/core/PendleMarketFactory.sol/PendleMarketFactory.json"
import PendleRouter from '../../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import { consts, tokens } from "../../helpers"

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

export interface CoreFixture {
  router: Contract
  treasury: Contract
  aMarketFactory: Contract
  cMarketFactory: Contract
  data: Contract
}

export async function coreFixture(
  [alice]: Wallet[],
  provider: providers.Web3Provider
): Promise<CoreFixture> {
  const router = await deployContract(alice, PendleRouter, [alice.address, tokens.WETH.address]);
  const treasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const aMarketFactory = await deployContract(alice, PendleMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE]);
  const cMarketFactory = await deployContract(alice, PendleMarketFactory, [alice.address, consts.MARKET_FACTORY_COMPOUND]);
  const data = await deployContract(alice, PendleData, [alice.address, treasury.address]);

  await aMarketFactory.initialize(router.address);
  await cMarketFactory.initialize(router.address);
  await data.initialize(router.address);
  await router.initialize(data.address);

  return { router, treasury, aMarketFactory, cMarketFactory, data }
}
