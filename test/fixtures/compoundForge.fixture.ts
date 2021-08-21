import { Contract, providers, Wallet } from 'ethers';
import PendleCompoundForge from '../../build/artifacts/contracts/core/compound/PendleCompoundForge.sol/PendleCompoundForge.json';
import PendleCompoundYieldContractDeployer from '../../build/artifacts/contracts/core/compound/PendleCompoundYieldContractDeployer.sol/PendleCompoundYieldContractDeployer.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import MockPendleRewardManager from '../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { consts, setTimeNextBlock, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { GovernanceFixture } from './governance.fixture';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface CompoundFixture {
  compoundForge: Contract;
  cOwnershipToken: Contract;
  cFutureYieldToken: Contract;
  cOwnershipToken8: Contract;
  cFutureYieldToken8: Contract;
  cRewardManager: Contract;
}

export async function compoundForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data, govManager }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<CompoundFixture> {
  const cRewardManager = await deployContract(alice, MockPendleRewardManager, [
    govManager.address, //governance
    consts.FORGE_COMPOUND,
  ]);

  const cYieldContractDeployer = await deployContract(alice, PendleCompoundYieldContractDeployer, [
    govManager.address, //governance
    consts.FORGE_COMPOUND,
  ]);

  const compoundForge = await deployContract(alice, PendleCompoundForge, [
    govManager.address,
    router.address,
    consts.COMPOUND_COMPTROLLER_ADDRESS,
    consts.FORGE_COMPOUND,
    consts.COMP_ADDRESS,
    cRewardManager.address,
    cYieldContractDeployer.address,
    consts.COMP_ETH,
  ]);
  await cRewardManager.initialize(compoundForge.address);

  await cYieldContractDeployer.initialize(compoundForge.address);

  await data.addForge(consts.FORGE_COMPOUND, compoundForge.address);

  await compoundForge.registerCTokens([tokens.USDT.address], [tokens.USDT.compound]);

  await setTimeNextBlock(consts.T0_C); // set the minting time for the first OT and XYT
  await router.newYieldContracts(consts.FORGE_COMPOUND, tokens.USDT.address, consts.T0_C.add(consts.SIX_MONTH));

  const otTokenAddress = await data.otTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0_C.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0_C.add(consts.SIX_MONTH)
  );

  const cOwnershipToken = new Contract(otTokenAddress, MockPendleOwnershipToken.abi, alice);
  const cFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  // ETH
  await router.newYieldContracts(consts.FORGE_COMPOUND, tokens.WETH.address, consts.T0_C.add(consts.SIX_MONTH));
  const otTokenAddress8 = await data.otTokens(
    consts.FORGE_COMPOUND,
    tokens.WETH.address,
    consts.T0_C.add(consts.SIX_MONTH)
  );

  const xytTokenAddress8 = await data.xytTokens(
    consts.FORGE_COMPOUND,
    tokens.WETH.address,
    consts.T0_C.add(consts.SIX_MONTH)
  );

  const cOwnershipToken8 = new Contract(otTokenAddress8, MockPendleOwnershipToken.abi, alice);
  const cFutureYieldToken8 = new Contract(xytTokenAddress8, PendleFutureYieldToken.abi, alice);

  return {
    compoundForge,
    cOwnershipToken,
    cFutureYieldToken,
    cOwnershipToken8,
    cFutureYieldToken8,
    cRewardManager,
  };
}
