import { Contract, providers, Wallet } from "ethers";
import PendleAaveForge from "../../../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json";
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from "../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json";
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { PendleCoreFixture } from "./pendleCore.fixture";
import { PendleGovernanceFixture } from "./pendleGovernance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleAaveFixture {
  pendleAaveForge: Contract;
  pendleOwnershipToken: Contract;
  pendleFutureYieldToken: Contract;
  pendleOwnershipToken2: Contract;
  pendleFutureYieldToken2: Contract;
}

export async function pendleAaveForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { pendleRouter, pendleData }: PendleCoreFixture,
  { pendle }: PendleGovernanceFixture
): Promise<PendleAaveFixture> {
  const pendleAaveForge = await deployContract(alice, PendleAaveForge, [
    pendle.address,
    pendleRouter.address,
    consts.AAVE_LENDING_POOL_CORE_ADDRESS,
    consts.FORGE_AAVE,
  ]);

  await pendleRouter.addForge(consts.FORGE_AAVE, pendleAaveForge.address);

  await setTimeNextBlock(provider, consts.T0); // set the minting time for the first OT and XYT

  // USDT
  await pendleRouter.newYieldContracts(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );
  const otTokenAddress = await pendleData.otTokens(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await pendleData.xytTokens(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const pendleOwnershipToken = new Contract(
    otTokenAddress,
    PendleOwnershipToken.abi,
    alice
  );
  const pendleFutureYieldToken = new Contract(
    xytTokenAddress,
    PendleFutureYieldToken.abi,
    alice
  );

  // USDC

  await pendleRouter.newYieldContracts(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );
  const otTokenAddress2 = await pendleData.otTokens(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const xytTokenAddress2 = await pendleData.xytTokens(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const pendleOwnershipToken2 = new Contract(
    otTokenAddress2,
    PendleOwnershipToken.abi,
    alice
  );
  const pendleFutureYieldToken2 = new Contract(
    xytTokenAddress2,
    PendleFutureYieldToken.abi,
    alice
  );

  return {
    pendleAaveForge,
    pendleOwnershipToken,
    pendleFutureYieldToken,
    pendleOwnershipToken2,
    pendleFutureYieldToken2,
  };
}
