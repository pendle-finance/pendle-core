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
    pendleCOwnershipToken: Contract
    pendleCFutureYieldToken: Contract
}

export async function pendleCompoundForgeFixture(
    alice: Wallet,
    provider: providers.Web3Provider,
    { pendleRouter, pendleData }: PendleCoreFixture,
    { pendle }: PendleGovernanceFixture
): Promise<PendleCompoundFixture> {
    const pendleCompoundForge = await deployContract(alice, PendleCompoundForge, [alice.address, pendleRouter.address, consts.FORGE_COMPOUND]);
    await pendleRouter.addForge(consts.FORGE_COMPOUND, pendleCompoundForge.address);

    await pendleCompoundForge.registerCTokens([tokens.USDT.address], [tokens.USDT.compound]);

    await setTimeNextBlock(provider, consts.T0_C); // set the minting time for the first OT and XYT
    await pendleRouter.newYieldContracts(consts.FORGE_COMPOUND, tokens.USDT.address, consts.T0_C.add(consts.ONE_MONTH));

    const otTokenAddress = await pendleData.otTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T0_C.add(consts.ONE_MONTH)
    );

    const xytTokenAddress = await pendleData.xytTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T0_C.add(consts.ONE_MONTH)
    );

    const pendleCOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, alice);
    const pendleCFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

    return {
        pendleCompoundForge,
        pendleCOwnershipToken,
        pendleCFutureYieldToken,
    };
}
