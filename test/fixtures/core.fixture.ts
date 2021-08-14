import { BigNumber as BN, Contract, providers, Wallet } from 'ethers';
import PendleAaveMarketFactory from '../../build/artifacts/contracts/core/aave/PendleAaveMarketFactory.sol/PendleAaveMarketFactory.json';
import PendleCompoundMarketFactory from '../../build/artifacts/contracts/core/compound/PendleCompoundMarketFactory.sol/PendleCompoundMarketFactory.json';
import PendleGenericMarketFactory from '../../build/artifacts/contracts/core/Generic/PendleGenericMarketFactory.sol/PendleGenericMarketFactory.json';
import PendleData from '../../build/artifacts/contracts/core/PendleData.sol/PendleData.json';
import PendleGovernanceManager from '../../build/artifacts/contracts/core/PendleGovernanceManager.sol/PendleGovernanceManager.json';
import PendlePausingManager from '../../build/artifacts/contracts/core/PendlePausingManager.sol/PendlePausingManager.json';
import PendleRouter from '../../build/artifacts/contracts/core/PendleRouter.sol/PendleRouter.json';
import PendleTreasury from '../../build/artifacts/contracts/governance/PendleTreasury.sol/PendleTreasury.json';
import PendleMarketReader from '../../build/artifacts/contracts/readers/PendleMarketReader.sol/PendleMarketReader.json';
import { consts, tokens } from '../helpers';
import { checkDisabled, Mode } from '.';

const hre = require('hardhat');

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface CoreFixture {
  router: Contract;
  treasury: Contract;
  a2MarketFactory: Contract;
  cMarketFactory: Contract;
  genMarketFactory: Contract;
  data: Contract;
  marketReader: Contract;
  pausingManager: Contract;
  govManager: Contract;
}

export async function coreFixture(_: Wallet[], provider: providers.Web3Provider): Promise<CoreFixture> {
  const wallets = waffle.provider.getWallets();
  const [alice] = wallets;

  const treasury = await deployContract(alice, PendleTreasury, [alice.address]);
  const govManager = await deployContract(alice, PendleGovernanceManager, [alice.address]);
  const pausingManager = await deployContract(alice, PendlePausingManager, [
    govManager.address,
    alice.address,
    alice.address,
    alice.address,
  ]);
  const data = await deployContract(alice, PendleData, [govManager.address, treasury.address, pausingManager.address]);
  const router = await deployContract(alice, PendleRouter, [govManager.address, tokens.WETH.address, data.address]);
  const marketReader = await deployContract(alice, PendleMarketReader, [data.address]);
  let a2MarketFactory: Contract = {} as Contract;
  let cMarketFactory: Contract = {} as Contract;
  let genMarketFactory: Contract = {} as Contract;

  if (!checkDisabled(Mode.AAVE_V2)) {
    a2MarketFactory = await deployContract(alice, PendleAaveMarketFactory, [
      router.address,
      consts.MARKET_FACTORY_AAVE_V2,
    ]);
  }
  if (!checkDisabled(Mode.COMPOUND)) {
    cMarketFactory = await deployContract(alice, PendleCompoundMarketFactory, [
      router.address,
      consts.MARKET_FACTORY_COMPOUND,
    ]);
  }
  if (
    !checkDisabled(Mode.SUSHISWAP_COMPLEX) ||
    !checkDisabled(Mode.SUSHISWAP_SIMPLE) ||
    !checkDisabled(Mode.COMPOUND_V2)
  ) {
    genMarketFactory = await deployContract(alice, PendleGenericMarketFactory, [
      router.address,
      consts.MARKET_FACTORY_GENERIC,
    ]);
  }
  await data.initialize(router.address);
  await data.setExpiryDivisor(BN.from(10)); // for ease of testing
  await data.setLockParams(BN.from(consts.LOCK_NUMERATOR), BN.from(consts.LOCK_DENOMINATOR)); // lock market
  await data.setInterestUpdateRateDeltaForMarket(consts.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET);

  return {
    router,
    treasury,
    a2MarketFactory,
    cMarketFactory,
    genMarketFactory,
    data,
    marketReader,
    pausingManager,
    govManager,
  };
}
