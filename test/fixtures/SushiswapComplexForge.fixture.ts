import { Contract, providers, Wallet } from 'ethers';
import PendleSushiswapComplexForge from '../../build/artifacts/contracts/core/SushiswapComplex/PendleSushiswapComplexForge.sol/PendleSushiswapComplexForge.json';
import PendleSushiswapComplexYieldContractDeployer from '../../build/artifacts/contracts/core/SushiswapComplex/PendleSushiswapComplexYieldContractDeployer.sol/PendleSushiswapComplexYieldContractDeployer.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import MockPendleRewardManager from '../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import { consts, setTimeNextBlock, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { GovernanceFixture } from './governance.fixture';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface SushiswapComplexForgeFixture {
  sushiswapComplexForge: Contract;
  scOwnershipToken: Contract;
  scFutureYieldToken: Contract;
  scRewardManager: Contract;
}

export async function sushiswapComplexForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data, govManager }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<SushiswapComplexForgeFixture> {
  const scRewardManager = await deployContract(alice, MockPendleRewardManager, [
    govManager.address, //governance
    consts.FORGE_SUSHISWAP_COMPLEX,
  ]);

  const scYieldContractDeployer = await deployContract(alice, PendleSushiswapComplexYieldContractDeployer, [
    govManager.address, //governance
    consts.FORGE_SUSHISWAP_COMPLEX,
    consts.MASTERCHEF_V1_ADDRESS,
  ]);

  const sushiswapComplexForge = await deployContract(alice, PendleSushiswapComplexForge, [
    govManager.address, // alice will be the governance address
    router.address,
    consts.FORGE_SUSHISWAP_COMPLEX,
    consts.SUSHI_ADDRESS,
    scRewardManager.address,
    scYieldContractDeployer.address,
    consts.CODE_HASH_SUSHISWAP,
    consts.FACTORY_SUSHISWAP,
    consts.MASTERCHEF_V1_ADDRESS,
  ]);

  await scRewardManager.initialize(sushiswapComplexForge.address);

  await scYieldContractDeployer.initialize(sushiswapComplexForge.address);

  await data.addForge(consts.FORGE_SUSHISWAP_COMPLEX, sushiswapComplexForge.address);

  const SUSHI_USDT_WETH_PID = 0;
  await sushiswapComplexForge.registerTokens([tokens.SUSHI_USDT_WETH_LP.address], [[SUSHI_USDT_WETH_PID]], consts.HG);

  await setTimeNextBlock(consts.T0_SC); // set the minting time for the first OT and XYT

  await router.newYieldContracts(
    consts.FORGE_SUSHISWAP_COMPLEX,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SC.add(consts.SIX_MONTH)
  );
  const otTokenAddress = await data.otTokens(
    consts.FORGE_SUSHISWAP_COMPLEX,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SC.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_SUSHISWAP_COMPLEX,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SC.add(consts.SIX_MONTH)
  );

  const scOwnershipToken = new Contract(otTokenAddress, MockPendleOwnershipToken.abi, alice);
  const scFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  return {
    sushiswapComplexForge,
    scOwnershipToken,
    scFutureYieldToken,
    scRewardManager,
  };
}
