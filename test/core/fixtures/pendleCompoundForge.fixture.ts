import { Contract, providers, Wallet } from "ethers";
import PendleCompoundForge from "../../../build/artifacts/contracts/core/PendleCompoundForge.sol/PendleCompoundForge.json";
import PendleOwnershipToken from "../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json";
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { PendleCoreFixture } from "./pendleCore.fixture";
import { PendleGovernanceFixture } from "./pendleGovernance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCompoundFixture {
  pendleCompoundForge: Contract;
  pendleOwnershipToken: Contract;
  pendleFutureYieldCToken: Contract;
  pendleFutureYieldCToken2: Contract;
  pendleOwnershipToken2: Contract;
}

export async function pendleCompoundForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { pendleRouter, pendleData }: PendleCoreFixture,
  { pendle }: PendleGovernanceFixture
): Promise<PendleCompoundFixture> {
  const pendleCompoundForge = await deployContract(alice, PendleCompoundForge, [
    alice.address,
    pendleRouter.address,
    consts.FORGE_COMPOUND,
  ]);
  await pendleRouter.addForge(
    consts.FORGE_COMPOUND,
    pendleCompoundForge.address
  );
  await pendleCompoundForge.registerToken(
    tokens.USDT.address,
    tokens.USDT.compound
  );

  await pendleCompoundForge.registerToken(
    tokens.USDC.address,
    tokens.USDC.compound
  );

  await pendleRouter.newYieldContracts(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.ONE_MONTH)
  );
  const otTokenAddress = await pendleData.otTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.ONE_MONTH)
  );

  const xytTokenAddress = await pendleData.xytTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.ONE_MONTH)
  );

  const pendleOwnershipToken = new Contract(
    otTokenAddress,
    PendleOwnershipToken.abi,
    alice
  );
  const pendleFutureYieldCToken = new Contract(
    xytTokenAddress,
    PendleFutureYieldToken.abi,
    alice
  );

  // SECOND XYT/OT Contract
  await pendleRouter.newYieldContracts(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );
  const otTokenAddress2 = await pendleData.otTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const xytTokenAddress2 = await pendleData.xytTokens(
    consts.FORGE_COMPOUND,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const pendleOwnershipToken2 = new Contract(
    otTokenAddress,
    PendleOwnershipToken.abi,
    alice
  );
  const pendleFutureYieldCToken2 = new Contract(
    xytTokenAddress,
    PendleFutureYieldToken.abi,
    alice
  );

  return {
    pendleCompoundForge,
    pendleOwnershipToken,
    pendleFutureYieldCToken,
    pendleFutureYieldCToken2,
    pendleOwnershipToken2,
  };
}
