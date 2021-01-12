
import { Contract, Wallet } from 'ethers'
import PendleAaveForge from '../../../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json'
import PendleOwnershipToken from '../../../build/artifacts/contracts/tokens/PendleOwnershipToken.sol/PendleOwnershipToken.json'
import PendleFutureYieldToken from "../../../build/artifacts/contracts/tokens/PendleFutureYieldToken.sol/PendleFutureYieldToken.json"
import {constants, tokens} from "../../helpers/Constants"
import {PendleCoreFixture} from "./pendleCore.fixture"

const { waffle } = require("hardhat");
const { deployContract } = waffle;

export interface PendleAaveFixture {
    pendleAaveForge: Contract
    pendleOwnershipToken: Contract
    pendleFutureYieldToken: Contract
}

export async function pendleAaveForgeFixture(
    wallet: Wallet,
    {pendle, pendleData}: PendleCoreFixture
  ): Promise<PendleAaveFixture> {
    const pendleAaveForge = await deployContract(wallet, PendleAaveForge, [pendle.address, constants.AAVE_LENDING_POOL_CORE_ADDRESS, constants.FORGE_AAVE]);

    await pendle.addForge(constants.FORGE_AAVE, pendleAaveForge.address)

    await pendleAaveForge.newYieldContracts(tokens.USDT.address, constants.TEST_EXPIRY);
    const otTokenAddress = await pendleData.otTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.TEST_EXPIRY
    );

    const xytTokenAddress = await pendleData.xytTokens(
        constants.FORGE_AAVE,
        tokens.USDT.address,
        constants.TEST_EXPIRY
    );

    const pendleOwnershipToken = new Contract(otTokenAddress, PendleOwnershipToken.abi, wallet);
    const pendleFutureYieldToken = new Contract(xytTokenAddress, PendleFutureYieldToken.abi, wallet);

    return {pendleAaveForge, pendleOwnershipToken, pendleFutureYieldToken, };
  }
