import { Contract, providers, Wallet } from 'ethers'
import PendleCompoundForge from '../../../build/artifacts/contracts/core/PendleCompoundForge.sol/PendleCompoundForge.json'
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json'
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json"
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { PendleCoreFixture } from "./pendleCore.fixture";
import { PendleGovernanceFixture } from "./pendleGovernance.fixture"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCompoundFixture {
    pendleCompoundForge: Contract
    pendleOwnershipToken: Contract
    pendleFutureYieldCToken: Contract
}

export async function pendleCompoundForgeFixture(
    alice: Wallet,
    provider: providers.Web3Provider,
    { pendleRouter, pendleData }: PendleCoreFixture,
    { pendle }: PendleGovernanceFixture
): Promise<PendleCompoundFixture> {
    const pendleCompoundForge = await deployContract(alice, PendleCompoundForge, [pendle.address, pendleRouter.address, consts.FORGE_COMPOUND]);
    await pendleRouter.addForge(consts.FORGE_COMPOUND, pendleCompoundForge.address);

    await pendleCompoundForge.registerToken(tokens.USDT.address, tokens.USDT.compound);

    await setTimeNextBlock(provider, consts.T1); // set the minting time for the first OT and XYT
    await pendleRouter.newYieldContracts(consts.FORGE_COMPOUND, tokens.USDT.address, consts.T1.add(consts.ONE_MONTH));

    const otTokenAddress = await pendleData.otTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T1.add(consts.ONE_MONTH)
    );

    const xytTokenAddress = await pendleData.xytTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T1.add(consts.ONE_MONTH)
    );

    const pendleOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, alice);
    const pendleFutureYieldCToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

    return {
        pendleCompoundForge,
        pendleOwnershipToken,
        pendleFutureYieldCToken,
    };
}
