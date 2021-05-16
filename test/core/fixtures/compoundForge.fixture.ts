import { Contract, providers, Wallet } from 'ethers';
import PendleCompoundForge from '../../../build/artifacts/contracts/core/PendleCompoundForge.sol/PendleCompoundForge.json';
import PendleCompoundYieldContractDeployer from "../../../build/artifacts/contracts/core/PendleCompoundYieldContractDeployer.sol/PendleCompoundYieldContractDeployer.json";
import MockPendleRewardManager from "../../../build/artifacts/contracts/mock/MockPendleRewardManager.sol/MockPendleRewardManager.json";
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json';
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { CoreFixture } from "./core.fixture";
import { GovernanceFixture } from "./governance.fixture";
const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface CompoundFixture {
  compoundForge: Contract;
  cOwnershipToken: Contract;
  cFutureYieldToken: Contract;
  cRewardManager: Contract;
}

export async function compoundForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<CompoundFixture> {
  const cRewardManager = await deployContract(alice, MockPendleRewardManager, [
    alice.address, //governance
    consts.FORGE_COMPOUND
  ]);

  const cYieldContractDeployer = await deployContract(alice, PendleCompoundYieldContractDeployer, [
    alice.address, //governance
    consts.FORGE_COMPOUND
  ]);

  const compoundForge = await deployContract(alice, PendleCompoundForge, [
    alice.address,
    router.address,
    consts.COMPOUND_COMPTROLLER_ADDRESS,
    consts.FORGE_COMPOUND,
    consts.COMP_ADDRESS,
    cRewardManager.address,
    cYieldContractDeployer.address
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

  const cOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, alice);
  const cFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

  return {
    compoundForge,
    cOwnershipToken,
    cFutureYieldToken,
    cRewardManager
  };
}
