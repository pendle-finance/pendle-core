import { Wallet, providers, BigNumber, Contract } from 'ethers'
import { pendleRouterFixture, PendleRouterFixture } from './pendleRouter.fixture';
import { pendleAaveForgeFixture, PendleAaveFixture } from './pendleAaveForge.fixture'
import { pendleGovernanceFixture, PendleGovernanceFixture } from './pendleGovernance.fixture'
import { aaveFixture, AaveFixture } from './aave.fixture';
import { constants, tokens, mintAproveTokenizeYield, amountToWei } from "../../helpers";
import TestToken from "../../../build/artifacts/contracts/mock/TestToken.sol/TestToken.json";
import PendleMarket from "../../../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json"
const { waffle } = require("hardhat");
const { deployContract } = waffle;

interface PendleMarketFixture {
  router: PendleRouterFixture,
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
  const router = await pendleRouterFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, router, governance);
  const aave = await aaveFixture(wallet);
  const { pendleRouter, pendleMarketFactory, pendleData } = router;
  const { pendleAaveForge, pendleFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, BigNumber.from(100));

  await mintAproveTokenizeYield(provider, token, wallet, amount, pendleRouter, pendleRouter);
  await mintAproveTokenizeYield(provider, token, wallet1, amount, pendleRouter, pendleRouter);

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(wallet1.address, totalSupply.div(2))

  await pendleRouter.addMarketFactory(constants.MARKET_FACTORY_AAVE, pendleMarketFactory.address);

  await pendleRouter.createMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address,
    constants.SIX_MONTH_FROM_NOW,
    constants.HIGH_GAS_OVERRIDE
  );

  const pendleMarketAddress = await pendleData.getMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  const pendleMarket = new Contract(pendleMarketAddress, PendleMarket.abi, wallet)
  await testToken.approve(pendleRouter.address, totalSupply);
  await testToken.connect(wallet1).approve(pendleRouter.address, totalSupply);

  await pendleFutureYieldToken.approve(pendleRouter.address, constants.MAX_ALLOWANCE);
  await pendleFutureYieldToken.connect(wallet1).approve(pendleRouter.address, constants.MAX_ALLOWANCE);

  await pendleMarket.approve(pendleRouter.address, constants.MAX_ALLOWANCE);
  await pendleMarket.connect(wallet1).approve(pendleRouter.address, constants.MAX_ALLOWANCE);

  return { router, aave, forge, testToken, pendleMarket }
}

export async function pendleMarketFixture2(
  wallets: Wallet[],
  provider: providers.Web3Provider
) {
  const [wallet, wallet1] = wallets
  const router = await pendleRouterFixture(wallets, provider);
  const governance = await pendleGovernanceFixture(wallets, provider);
  const forge = await pendleAaveForgeFixture(wallet, router, governance);
  const aave = await aaveFixture(wallet);
  const { pendleRouter, pendleMarketFactory, pendleData } = router;
  const { pendleAaveForge, pendleFutureYieldToken } = forge;
  const token = tokens.USDT

  const amount = amountToWei(token, BigNumber.from(100));

  await mintAproveTokenizeYield(provider, token, wallet, amount, pendleRouter, pendleRouter);
  await mintAproveTokenizeYield(provider, token, wallet1, amount, pendleRouter, pendleRouter);

  const testToken = await deployContract(wallet, TestToken, ['Test Token', 'TEST', 6]);
  const totalSupply = await testToken.totalSupply();
  await testToken.transfer(wallet1.address, totalSupply.div(2))

  await pendleRouter.addMarketFactory(constants.MARKET_FACTORY_AAVE, pendleMarketFactory.address);

  await pendleRouter.createMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address,
    constants.SIX_MONTH_FROM_NOW,
    constants.HIGH_GAS_OVERRIDE
  );

  const pendleMarketAddress = await pendleData.getMarket(
    constants.FORGE_AAVE,
    constants.MARKET_FACTORY_AAVE,
    pendleFutureYieldToken.address,
    testToken.address
  );

  // const pendleMarket = new Contract(pendleMarketAddress, PendleMarket.abi, wallet)
  // await testToken.approve(pendleMarketAddress, totalSupply);
  // await testToken.connect(wallet1).approve(pendleMarketAddress, totalSupply);

  // await pendleFutureYieldToken.approve(pendleMarketAddress, constants.MAX_ALLOWANCE);
  // await pendleFutureYieldToken.connect(wallet1).approve(pendleMarketAddress, constants.MAX_ALLOWANCE);

}


// const { provider } = waffle;
// import { createFixtureLoader } from "ethereum-waffle";
// import { Token, evm_snapshot, evm_revert, getAContract } from "../../helpers";

// const wallets = provider.getWallets();
// const loadFixture = createFixtureLoader(wallets, provider);
// const [wallet, wallet1] = wallets;
// let pendleRouter: Contract;
// let pendleTreasury: Contract;
// let pendleMarketFactory: Contract;
// let pendleData: Contract;
// let pendleOwnershipToken: Contract;
// let pendleXyt: Contract;
// let lendingPoolCore: Contract;
// let pendleAaveForge: Contract;
// let pendleMarket: Contract;
// let testToken: Contract;
// let aUSDT: Contract;
// let snapshotId: string;
// let globalSnapshotId: string;
// let tokenUSDT: Token;

// it("Should be", async () => {
//   const wallets = provider.getWallets();
//   const loadFixture = createFixtureLoader(wallets, provider);
//   const [wallet, wallet1] = wallets;

//   // globalSnapshotId = await evm_snapshot();

//   await loadFixture(pendleMarketFixture2);
//   // pendleRouter = fixture.router.pendleRouter;
//   // pendleTreasury = fixture.router.pendleTreasury;
//   // pendleMarketFactory = fixture.router.pendleMarketFactory;
//   // pendleData = fixture.router.pendleData;
//   // pendleOwnershipToken = fixture.forge.pendleOwnershipToken;
//   // pendleXyt = fixture.forge.pendleFutureYieldToken;
//   // pendleAaveForge = fixture.forge.pendleAaveForge;
//   // lendingPoolCore = fixture.aave.lendingPoolCore;
//   // testToken = fixture.testToken;
//   // pendleMarket = fixture.pendleMarket;
//   // tokenUSDT = tokens.USDT;
//   // aUSDT = await getAContract(wallet, lendingPoolCore, tokenUSDT);
//   // snapshotId = await evm_snapshot();
// });