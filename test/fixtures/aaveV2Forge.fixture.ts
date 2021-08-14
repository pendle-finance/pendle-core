import { Contract, providers, Wallet } from 'ethers';
import PendleAaveV2Forge from '../../build/artifacts/contracts/core/aave/v2/PendleAaveV2Forge.sol/PendleAaveV2Forge.json';
import PendleAaveV2YieldContractDeployer from '../../build/artifacts/contracts/core/aave/v2/PendleAaveV2YieldContractDeployer.sol/PendleAaveV2YieldContractDeployer.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import MockPendleRewardManager from '../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { consts, setTimeNextBlock, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { GovernanceFixture } from './governance.fixture';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface AaveV2ForgeFixture {
  aaveV2Forge: Contract;
  a2OwnershipToken: Contract;
  a2FutureYieldToken: Contract;
  a2OwnershipToken18: Contract;
  a2FutureYieldToken18: Contract;
  a2RewardManager: Contract;
}

export async function aaveV2ForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data, govManager }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<AaveV2ForgeFixture> {
  const a2RewardManager = await deployContract(alice, MockPendleRewardManager, [
    govManager.address, //governance
    consts.FORGE_AAVE_V2,
  ]);

  const a2YieldContractDeployer = await deployContract(alice, PendleAaveV2YieldContractDeployer, [
    govManager.address, //governance
    consts.FORGE_AAVE_V2,
  ]);

  const aaveV2Forge = await deployContract(alice, PendleAaveV2Forge, [
    govManager.address, // alice will be the governance address
    router.address,
    consts.AAVE_V2_LENDING_POOL_ADDRESS,
    consts.FORGE_AAVE_V2,
    consts.STKAAVE_ADDRESS,
    a2RewardManager.address,
    a2YieldContractDeployer.address,
    consts.AAVE_INCENTIVES_CONTROLLER,
  ]);

  await a2RewardManager.initialize(aaveV2Forge.address);

  await a2YieldContractDeployer.initialize(aaveV2Forge.address);

  await data.addForge(consts.FORGE_AAVE_V2, aaveV2Forge.address);

  await setTimeNextBlock(consts.T0_A2); // set the minting time for the first OT and XYT

  // USDT
  await router.newYieldContracts(consts.FORGE_AAVE_V2, tokens.USDT.address, consts.T0_A2.add(consts.SIX_MONTH));
  const otTokenAddress = await data.otTokens(
    consts.FORGE_AAVE_V2,
    tokens.USDT.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_AAVE_V2,
    tokens.USDT.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const a2OwnershipToken = new Contract(otTokenAddress, MockPendleOwnershipToken.abi, alice);
  const a2FutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  // UNI

  await router.newYieldContracts(consts.FORGE_AAVE_V2, tokens.UNI.address, consts.T0_A2.add(consts.SIX_MONTH));
  const otTokenAddress18 = await data.otTokens(
    consts.FORGE_AAVE_V2,
    tokens.UNI.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const xytTokenAddress18 = await data.xytTokens(
    consts.FORGE_AAVE_V2,
    tokens.UNI.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const a2OwnershipToken18 = new Contract(otTokenAddress18, MockPendleOwnershipToken.abi, alice);
  const a2FutureYieldToken18 = new Contract(xytTokenAddress18, PendleFutureYieldToken.abi, alice);

  return {
    aaveV2Forge,
    a2OwnershipToken,
    a2FutureYieldToken,
    a2OwnershipToken18,
    a2FutureYieldToken18,
    a2RewardManager,
  };
}
