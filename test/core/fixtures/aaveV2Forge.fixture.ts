import { Contract, providers, Wallet } from "ethers";
import PendleAaveV2Forge from "../../../build/artifacts/contracts/core/PendleAaveV2Forge.sol/PendleAaveV2Forge.json";
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from "../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json";
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { CoreFixture } from "./core.fixture";
import { GovernanceFixture } from "./governance.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface AaveV2ForgeFixture {
  aaveV2Forge: Contract;
  a2OwnershipToken: Contract;
  a2FutureYieldToken: Contract;
  a2OwnershipToken2: Contract;
  a2FutureYieldToken2: Contract;
}

export async function aaveV2ForgeFixture(
  alice: Wallet,
  provider: providers.Web3Provider,
  { router, data }: CoreFixture,
  { pendle }: GovernanceFixture
): Promise<AaveV2ForgeFixture> {
  const aaveV2Forge = await deployContract(alice, PendleAaveV2Forge, [
    pendle.address,
    router.address,
    consts.AAVE_V2_LENDING_POOL_ADDRESS,
    consts.FORGE_AAVE_V2,
  ]);

  await router.addForge(consts.FORGE_AAVE_V2, aaveV2Forge.address);

  await setTimeNextBlock(provider, consts.T0_A2); // set the minting time for the first OT and XYT

  // USDT
  await router.newYieldContracts(
    consts.FORGE_AAVE_V2,
    tokens.USDT.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );
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

  const a2OwnershipToken = new Contract(
    otTokenAddress,
    PendleOwnershipToken.abi,
    alice
  );
  const a2FutureYieldToken = new Contract(
    xytTokenAddress,
    PendleFutureYieldToken.abi,
    alice
  );

  // USDC

  await router.newYieldContracts(
    consts.FORGE_AAVE_V2,
    tokens.USDC.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );
  const otTokenAddress2 = await data.otTokens(
    consts.FORGE_AAVE_V2,
    tokens.USDC.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const xytTokenAddress2 = await data.xytTokens(
    consts.FORGE_AAVE_V2,
    tokens.USDC.address,
    consts.T0_A2.add(consts.SIX_MONTH)
  );

  const a2OwnershipToken2 = new Contract(
    otTokenAddress2,
    PendleOwnershipToken.abi,
    alice
  );
  const a2FutureYieldToken2 = new Contract(
    xytTokenAddress2,
    PendleFutureYieldToken.abi,
    alice
  );

  return {
    aaveV2Forge,
    a2OwnershipToken,
    a2FutureYieldToken,
    a2OwnershipToken2,
    a2FutureYieldToken2,
  };
}