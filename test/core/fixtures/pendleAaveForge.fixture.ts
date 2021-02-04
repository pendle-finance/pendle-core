
import { Contract, Wallet } from 'ethers'
import PendleAaveForge from '../../../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json'
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json'
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json"
import { constants, tokens } from "../../helpers/Constants"
import { PendleRouterFixture } from "./pendleRouter.fixture"
import { PendleGovernanceFixture } from "./pendleGovernance.fixture"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleAaveFixture {
    pendleAaveForge: Contract
    pendleOwnershipToken: Contract
    pendleFutureYieldToken: Contract
}

export async function pendleAaveForgeFixture(
    wallet: Wallet,
    { pendleRouter, pendleData }: PendleRouterFixture,
    { pendle }: PendleGovernanceFixture
): Promise<PendleAaveFixture> {
    const pendleAaveForge = await deployContract(wallet, PendleAaveForge, [pendle.address, pendleRouter.address, constants.AAVE_LENDING_POOL_CORE_ADDRESS, constants.FORGE_AAVE]);

    await pendleRouter.addForge(constants.FORGE_AAVE, pendleAaveForge.address)

    await pendleRouter.newYieldContracts(constants.FORGE_AAVE, tokens.USDT.address, constants.SIX_MONTH_FROM_NOW);
    const otTokenAddress = await pendleData.otTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.SIX_MONTH_FROM_NOW
    );

    const xytTokenAddress = await pendleData.xytTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.SIX_MONTH_FROM_NOW
    );

    const pendleOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, wallet);
    const pendleFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, wallet);

    return { pendleAaveForge, pendleOwnershipToken, pendleFutureYieldToken, };
}
