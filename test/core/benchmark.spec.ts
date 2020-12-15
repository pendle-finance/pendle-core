import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { benchmarkFixture } from './fixtures'
import {constants, tokens, amountToWei} from "../helpers"

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe('BenchmarkAaveForge', async () => {
    const wallets = provider.getWallets()
    const loadFixture = createFixtureLoader(wallets, provider)
    const [wallet] = wallets;

    let benchmark: Contract;
    let benchmarkTreasury: Contract;
    let benchmarkMarketFactory: Contract;
    let benchmarkData: Contract;
    let benchmarkOwnershipToken: Contract;
    let benchmarkFutureYieldToken: Contract;
    beforeEach(async () => {
        const fixture = await loadFixture(benchmarkFixture)
        benchmark = fixture.core.benchmark
        benchmarkTreasury = fixture.core.benchmarkTreasury
        benchmarkMarketFactory = fixture.core.benchmarkMarketFactory
        benchmarkData = fixture.core.benchmarkData
        benchmarkOwnershipToken = fixture.forge.benchmarkOwnershipToken
        benchmarkFutureYieldToken = fixture.forge.benchmarkFutureYieldToken 
    })

    it('should be able to deposit aUSDT to get back OT and XYT', async () => {
        const token = tokens.USDT
        const amountToTokenize = amountToWei(token, BigNumber.from(100));
        await benchmark.tokenizeYield(constants.FORGE_AAVE, token.address, constants.TEST_EXPIRY, amountToTokenize, wallet.address)
        const balanceOwnershipToken = await benchmarkOwnershipToken.balanceOf(wallet.address);
        const balanceFutureYieldToken= await benchmarkFutureYieldToken.balanceOf(wallet.address)
        expect(balanceOwnershipToken).to.be.eq(amountToTokenize)
        expect(balanceFutureYieldToken).to.be.eq(amountToTokenize)
    });
});