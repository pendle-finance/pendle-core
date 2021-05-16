import { BigNumber as BN, Contract, providers, Wallet } from 'ethers'
import PendleAaveMarketFactory from "../../../build/artifacts/contracts/core/PendleAaveMarketFactory.sol/PendleAaveMarketFactory.json"
import PendleCompoundMarketFactory from "../../../build/artifacts/contracts/core/PendleCompoundMarketFactory.sol/PendleCompoundMarketFactory.json"
import PendleData from "../../../build/artifacts/contracts/core/PendleData.sol/PendleData.json"
import PendleMarketReader from '../../../build/artifacts/contracts/core/PendleMarketReader.sol/PendleMarketReader.json'
import PendlePausingManager from '../../../build/artifacts/contracts/core/PendlePausingManager.sol/PendlePausingManager.json'
import PendleRouter from '../../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json'
import PendleTreasury from '../../../build/artifacts/contracts/core/PendleTreasury.sol/PendleTreasury.json'
import { consts, tokens } from "../../helpers"
const hre = require("hardhat");

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface CoreFixture {
  router: Contract
  treasury: Contract
  aMarketFactory: Contract
  a2MarketFactory: Contract
  cMarketFactory: Contract
  data: Contract,
  marketReader: Contract,
  pausingManager: Contract
}

export async function coreFixture(
  _: Wallet[],
  provider: providers.Web3Provider
): Promise<CoreFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;

  const treasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const aMarketFactory = await deployContract(alice, PendleAaveMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE]);
  const a2MarketFactory = await deployContract(alice, PendleAaveMarketFactory, [alice.address, consts.MARKET_FACTORY_AAVE_V2]);
  const cMarketFactory = await deployContract(alice, PendleCompoundMarketFactory, [alice.address, consts.MARKET_FACTORY_COMPOUND]);
  const pausingManager = await deployContract(alice, PendlePausingManager, [alice.address, alice.address, alice.address]);
  const data = await deployContract(alice, PendleData, [alice.address, treasury.address, pausingManager.address]);
  const router = await deployContract(alice, PendleRouter, [alice.address, tokens.WETH.address, data.address]);
  const marketReader = await deployContract(alice, PendleMarketReader, [data.address]);

  await aMarketFactory.initialize(router.address);
  await a2MarketFactory.initialize(router.address);
  await cMarketFactory.initialize(router.address);
  await data.initialize(router.address);

  await data.setExpiryDivisor(BN.from(10)); // for ease of testing
  await data.setLockParams(BN.from(consts.LOCK_NUMERATOR), BN.from(consts.LOCK_DENOMINATOR)); // lock market
  await data.setInterestUpdateRateDeltaForMarket(consts.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET);

  return { router, treasury, aMarketFactory, a2MarketFactory, cMarketFactory, data, marketReader, pausingManager }
}
