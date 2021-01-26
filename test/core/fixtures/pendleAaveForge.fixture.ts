
import { Contract, Wallet } from 'ethers';
import PendleAaveForge from '../../../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json';
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json';
import { consts, tokens } from "../../helpers";
import { PendleCoreFixture } from "./pendleCore.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleAaveFixture {
    pendleAaveForge: Contract
    pendleOwnershipToken: Contract
    pendleFutureYieldToken: Contract
}

export async function pendleAaveForgeFixture(
    wallet: Wallet,
    { pendle, pendleData }: PendleCoreFixture
): Promise<PendleAaveFixture> {
    const pendleAaveForge = await deployContract(wallet, PendleAaveForge, [pendle.address, consts.AAVE_LENDING_POOL_CORE_ADDRESS, consts.FORGE_AAVE]);

    await pendle.addForge(consts.FORGE_AAVE, pendleAaveForge.address)

    await pendleAaveForge.newYieldContracts(tokens.USDT.address, consts.SIX_MONTH_FROM_NOW);
    const otTokenAddress = await pendleData.otTokens(
        consts.FORGE_AAVE,
        tokens.USDT.address,
        consts.SIX_MONTH_FROM_NOW
    );

    const xytTokenAddress = await pendleData.xytTokens(
        consts.FORGE_AAVE,
        tokens.USDT.address,
        consts.SIX_MONTH_FROM_NOW
    );

    const pendleOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, wallet);
    const pendleFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, wallet);

    return { pendleAaveForge, pendleOwnershipToken, pendleFutureYieldToken, };
}
