import { Contract, providers, Wallet } from 'ethers';
import PendleCompoundV2Forge from '../../build/artifacts/contracts/core/compoundV2/PendleCompoundV2Forge.sol/PendleCompoundV2Forge.json';
import PendleCompoundV2YieldContractDeployer from '../../build/artifacts/contracts/core/compoundV2/PendleCompoundV2YieldContractDeployer.sol/PendleCompoundV2YieldContractDeployer.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import MockPendleRewardManager from '../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { consts, setTimeNextBlock, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { GovernanceFixture } from './governance.fixture';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface CompoundV2Fixture {
  compoundV2Forge: Contract;
  c2OwnershipToken: Contract;
  c2FutureYieldToken: Contract;
  c2OwnershipToken8: Contract;
  c2FutureYieldToken8: Contract;
  c2RewardManager: Contract;
}

export async function compoundV2ForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data, govManager }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<CompoundV2Fixture> {
  const c2RewardManager = await deployContract(alice, MockPendleRewardManager, [
    govManager.address, //governance
    consts.FORGE_COMPOUND_V2,
  ]);

  const c2YieldContractDeployer = await deployContract(alice, PendleCompoundV2YieldContractDeployer, [
    govManager.address, //governance
    consts.FORGE_COMPOUND_V2,
  ]);

  const compoundV2Forge = await deployContract(alice, PendleCompoundV2Forge, [
    govManager.address,
    router.address,
    consts.COMPOUND_COMPTROLLER_ADDRESS,
    consts.FORGE_COMPOUND_V2,
    consts.COMP_ADDRESS,
    c2RewardManager.address,
    c2YieldContractDeployer.address,
    consts.COMP_ETH,
  ]);
  await c2RewardManager.initialize(compoundV2Forge.address);

  await c2YieldContractDeployer.initialize(compoundV2Forge.address);

  await data.addForge(consts.FORGE_COMPOUND_V2, compoundV2Forge.address, consts.HG);

  await compoundV2Forge.registerTokens([tokens.USDT.address], [[tokens.USDT.compound]]);

  await setTimeNextBlock(consts.T0_C2); // set the minting time for the first OT and XYT
  await router.newYieldContracts(consts.FORGE_COMPOUND_V2, tokens.USDT.address, consts.T0_C2.add(consts.SIX_MONTH));

  const otTokenAddress = await data.otTokens(
    consts.FORGE_COMPOUND_V2,
    tokens.USDT.address,
    consts.T0_C2.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_COMPOUND_V2,
    tokens.USDT.address,
    consts.T0_C2.add(consts.SIX_MONTH)
  );

  const c2OwnershipToken = new Contract(otTokenAddress, MockPendleOwnershipToken.abi, alice);
  const c2FutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  // ETH
  await router.newYieldContracts(consts.FORGE_COMPOUND_V2, tokens.WETH.address, consts.T0_C2.add(consts.SIX_MONTH));
  const otTokenAddress8 = await data.otTokens(
    consts.FORGE_COMPOUND_V2,
    tokens.WETH.address,
    consts.T0_C2.add(consts.SIX_MONTH)
  );

  const xytTokenAddress8 = await data.xytTokens(
    consts.FORGE_COMPOUND_V2,
    tokens.WETH.address,
    consts.T0_C2.add(consts.SIX_MONTH)
  );

  const c2OwnershipToken8 = new Contract(otTokenAddress8, MockPendleOwnershipToken.abi, alice);
  const c2FutureYieldToken8 = new Contract(xytTokenAddress8, PendleFutureYieldToken.abi, alice);

  return {
    compoundV2Forge,
    c2OwnershipToken,
    c2FutureYieldToken,
    c2OwnershipToken8,
    c2FutureYieldToken8,
    c2RewardManager,
  };
}
