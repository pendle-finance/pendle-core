import { Wallet, providers, BigNumber, Contract } from 'ethers'
import { pendleCoreFixture, PendleCoreFixture } from './pendleCore.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { pendleGovernanceFixture, PendleGovernanceFixture } from './pendleGovernance.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { consts, tokens, mintOtAndXyt, amountToWei } from "../../helpers";
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
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, provider, core, governance);
  const aave = await aaveFixture(wallet);
  const { pendleRouter, pendleMarketFactory, pendleData } = core;
  const { pendleAaveForge, pendleFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, consts.INITIAL_OT_XYT_AMOUNT);

  await mintOtAndXyt(provider, token, wallet, amount, pendleRouter, pendleRouter); // TODO: fix this function
  await mintOtAndXyt(provider, token, wallet1, amount, pendleRouter, pendleRouter);

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(wallet1.address, totalSupply.div(2))

  await pendleRouter.addMarketFactory(consts.MARKET_FACTORY_AAVE, pendleMarketFactory.address);

  await pendleRouter.createMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address,
    consts.T0.add(consts.SIX_MONTH),
    consts.HIGH_GAS_OVERRIDE
  );

  const pendleMarketAddress = await pendleData.getMarket(
    consts.FORGE_AAVE,
    consts.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  const pendleMarket = new Contract(pendleMarketAddress, PendleMarket.abi, wallet)
  await testToken.approve(pendleRouter.address, totalSupply);
  await testToken.connect(wallet1).approve(pendleRouter.address, totalSupply);

  await pendleFutureYieldToken.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleFutureYieldToken.connect(wallet1).approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleMarket.approve(pendleRouter.address, consts.MAX_ALLOWANCE);
  await pendleMarket.connect(wallet1).approve(pendleRouter.address, consts.MAX_ALLOWANCE);

  return { core, aave, forge, testToken, pendleMarket }
}
