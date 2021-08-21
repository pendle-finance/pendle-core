import { Contract, providers, Wallet } from 'ethers';
import PendleSushiswapSimpleForge from '../../build/artifacts/contracts/core/SushiswapSimple/PendleSushiswapSimpleForge.sol/PendleSushiswapSimpleForge.json';
import PendleYieldContractDeployerBaseV2 from '../../build/artifacts/contracts/core/abstractV2/PendleYieldContractDeployerBaseV2.sol/PendleYieldContractDeployerBaseV2.json';
import MockPendleOwnershipToken from '../../build/artifacts/contracts/mock/MockPendleOwnershipToken.sol/MockPendleOwnershipToken.json';
import PendleFutureYieldToken from '../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json';
import MockPendleRewardManager from '../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json';
import { consts, setTimeNextBlock, tokens } from '../helpers';
import { CoreFixture } from './core.fixture';
import { GovernanceFixture } from './governance.fixture';

const { waffle } = require('hardhat');
const { deployContract } = waffle;

export interface SushiswapSimpleForgeFixture {
  sushiswapSimpleForge: Contract;
  ssOwnershipToken: Contract;
  ssFutureYieldToken: Contract;
  ssRewardManager: Contract;
}

export async function sushiswapSimpleForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data, govManager }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<SushiswapSimpleForgeFixture> {
  const ssRewardManager = await deployContract(alice, MockPendleRewardManager, [
    govManager.address,
    consts.FORGE_SUSHISWAP_SIMPLE,
  ]);

  const ssYieldContractDeployer = await deployContract(alice, PendleYieldContractDeployerBaseV2, [
    govManager.address,
    consts.FORGE_SUSHISWAP_SIMPLE,
  ]);

  const sushiswapSimpleForge = await deployContract(alice, PendleSushiswapSimpleForge, [
    govManager.address,
    router.address,
    consts.FORGE_SUSHISWAP_SIMPLE,
    tokens.USDT.address,
    ssRewardManager.address,
    ssYieldContractDeployer.address,
    consts.CODE_HASH_SUSHISWAP,
    consts.FACTORY_SUSHISWAP,
  ]);

  await ssRewardManager.setSkippingRewards(true, consts.HG);

  await ssRewardManager.initialize(sushiswapSimpleForge.address);
  await ssYieldContractDeployer.initialize(sushiswapSimpleForge.address);
  await data.addForge(consts.FORGE_SUSHISWAP_SIMPLE, sushiswapSimpleForge.address, consts.HG);

  await sushiswapSimpleForge.registerTokens(
    [tokens.SUSHI_USDT_WETH_LP.address],
    [[tokens.SUSHI_USDT_WETH_LP.address]],
    consts.HG
  );
  await setTimeNextBlock(consts.T0_SS);

  await router.newYieldContracts(
    consts.FORGE_SUSHISWAP_SIMPLE,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SS.add(consts.SIX_MONTH),
    consts.HG
  );

  const otTokenAddress = await data.otTokens(
    consts.FORGE_SUSHISWAP_SIMPLE,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SS.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_SUSHISWAP_SIMPLE,
    tokens.SUSHI_USDT_WETH_LP.address,
    consts.T0_SS.add(consts.SIX_MONTH)
  );

  const ssOwnershipToken = new Contract(otTokenAddress, MockPendleOwnershipToken.abi, alice);
  const ssFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  return {
    sushiswapSimpleForge,
    ssOwnershipToken,
    ssFutureYieldToken,
    ssRewardManager,
  };
}
