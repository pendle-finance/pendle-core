import { Contract, providers, Wallet } from "ethers";
import PendleAaveForge from "../../../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json";
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from "../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json";
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { CoreFixture } from "./core.fixture";
import { GovernanceFixture } from "./governance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface AaveForgeFixture {
  aaveForge: Contract;
  aOwnershipToken: Contract;
  aFutureYieldToken: Contract;
  aOwnershipToken2: Contract;
  aFutureYieldToken2: Contract;
}

export async function aaveForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<AaveForgeFixture> {
  const aaveForge = await deployContract(alice, PendleAaveForge, [
    pendle.address,
    router.address,
    consts.AAVE_LENDING_POOL_CORE_ADDRESS,
    consts.FORGE_AAVE,
  ]);

  await router.addForge(consts.FORGE_AAVE, aaveForge.address);

  await setTimeNextBlock(provider, consts.T0); // set the minting time for the first OT and XYT

  // USDT
  await router.newYieldContracts(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );
  const otTokenAddress = await data.otTokens(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const xytTokenAddress = await data.xytTokens(
    consts.FORGE_AAVE,
    tokens.USDT.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const aOwnershipToken = new Contract(
    otTokenAddress,
    PendleOwnershipToken.abi,
    alice
  );
  const aFutureYieldToken = new Contract(
    xytTokenAddress,
    PendleFutureYieldToken.abi,
    alice
  );

  // USDC

  await router.newYieldContracts(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );
  const otTokenAddress2 = await data.otTokens(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const xytTokenAddress2 = await data.xytTokens(
    consts.FORGE_AAVE,
    tokens.USDC.address,
    consts.T0.add(consts.SIX_MONTH)
  );

  const aOwnershipToken2 = new Contract(
    otTokenAddress2,
    PendleOwnershipToken.abi,
    alice
  );
  const aFutureYieldToken2 = new Contract(
    xytTokenAddress2,
    PendleFutureYieldToken.abi,
    alice
  );

  return {
    aaveForge,
    aOwnershipToken,
    aFutureYieldToken,
    aOwnershipToken2,
    aFutureYieldToken2,
  };
}
