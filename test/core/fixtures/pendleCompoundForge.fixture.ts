
import { Contract, providers, Wallet } from 'ethers';
import PendleCompoundForge from '../../../build/artifacts/contracts/core/PendleCompoundForge.sol/PendleCompoundForge.json';
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json";
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json';
import { consts, setTimeNextBlock, tokens } from "../../helpers";
import { PendleCoreFixture } from "./pendleCore.fixture";

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleCompoundFixture {
    pendleCompoundForge: Contract
    pendleOwnershipToken: Contract
    pendleFutureYieldToken: Contract
}

export async function pendleCompoundForgeFixture(
    alice: Wallet,
    provider: providers.Web3Provider,
    { pendle, pendleData }: PendleCoreFixture,
): Promise<PendleCompoundFixture> {
    const pendleCompoundForge = await deployContract(alice, PendleCompoundForge, [pendle.address, consts.Compound_LENDING_POOL_CORE_ADDRESS, consts.FORGE_COMPOUND]);

    await pendle.addForge(consts.FORGE_COMPOUND, pendleCompoundForge.address)

    await setTimeNextBlock(provider, consts.T0); // set the minting time for the first OT and XYT
    await pendleCompoundForge.newYieldContracts(tokens.USDT.address, consts.T0.add(consts.SIX_MONTH));
    const otTokenAddress = await pendleData.otTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T0.add(consts.SIX_MONTH)
    );

    const xytTokenAddress = await pendleData.xytTokens(
        consts.FORGE_COMPOUND,
        tokens.USDT.address,
        consts.T0.add(consts.SIX_MONTH)
    );

    const pendleOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, alice);
    const pendleFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, alice);

    return { pendleCompoundForge, pendleOwnershipToken, pendleFutureYieldToken, };
}
