import { expect } from 'chai'
import { Contract, providers, Wallet, BigNumber as BN, utils } from "ethers";
import PENDLE from "../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import MockPendle from '../../build/artifacts/contracts/mock/MockPENDLE.sol/MockPENDLE.json'
import { errMsg, consts, evm_revert, evm_snapshot, setTimeNextBlock, advanceTime, approxBigNumber } from "../helpers";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

describe("Token name test", async () => {
    const wallets: Wallet[] = provider.getWallets();

    const [root, a1, a2, a3, a4, a5] = wallets;

    const name = "Pendle";
    const symbol = "PENDLE";
    const initialSupply = BN.from("188700000000000000000000000");
    const CONFIG_DENOMINATOR = BN.from("1000000000000000000");


    let PENDLE: Contract;
    let globalSnapshotId: string;
    let snapshotId: string;

    before(async () => {
        globalSnapshotId = await evm_snapshot();
        snapshotId = await evm_snapshot();
    });

    after(async () => {
        await evm_revert(globalSnapshotId);
    });

    beforeEach(async () => {
        await evm_revert(snapshotId);
        PENDLE = await deployContract(root, MockPendle, [
            root.address,
            a1.address,
            a2.address,
            a3.address,
            a4.address,
        ])
        snapshotId = await evm_snapshot();
    });

    describe("token basic information", async() => {
        it("token name should be Pendle", async() => {
            // console.log(await PENDLE.name());
            expect(await PENDLE.name()).to.be.equal(name);
        });
    
        it("token symble should be PENDLE", async() => {
            // console.log(await PENDLE.symbol());
            expect(await PENDLE.symbol()).to.be.equal(symbol);
        });
    });

    describe("PENDLE emissions", async() => {
        xit("initial 26 weeks emissions", async() => {
            const connected = PENDLE.connect(a4);
            expect(await connected.balanceOf(a4.address)).to.be.equal(BN.from(31200000).mul(CONFIG_DENOMINATOR));
            expect(await connected.getCurrentWeek()).to.be.equal(1);
        });


        xit("try callstatic to check for amount claimable each week", async() => {
            let toBeExpected;
            const connected = await PENDLE.connect(a4);
            const INITIAL_LIQUIDITY_EMISSION = BN.from(await connected.balanceOf(a4.address));
            
            let lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
            let totalClaimed = BN.from(0);

            advanceTime(provider, consts.ONE_WEEK.mul(26));

            for(let i = 27; i < 260; ++i) {
                expect(await connected.getCurrentWeek()).to.be.equal(i);
                let currentWeekClaimed = BN.from(await connected.callStatic.claimLiquidityEmissions()).sub(totalClaimed);
                expect(lastWeekClaimed.gt(currentWeekClaimed)).to.be.true;
                let expectedAmount = lastWeekClaimed.mul(989).div(1000);
                approxBigNumber(
                    currentWeekClaimed,
                    expectedAmount,
                    0,
                    false
                );
                totalClaimed = totalClaimed.add(currentWeekClaimed);
                lastWeekClaimed = expectedAmount;

                toBeExpected = BN.from(await connected.callStatic.getTotalSupply()).mul(379848538).div(BN.from(1000000000000));
                advanceTime(provider, consts.ONE_WEEK);
            }


            for (let i = 260; i < 260 + 52; ++i){
                expect(await connected.getCurrentWeek()).to.be.equal(i);
                let currentWeekClaimed = BN.from(await connected.callStatic.claimLiquidityEmissions()).sub(totalClaimed);
                let expectedAmount = BN.from(await connected.callStatic.getTotalSupply()).mul(379848538).div(BN.from(1000000000000));

                approxBigNumber(
                    currentWeekClaimed,
                    toBeExpected,
                    10,
                    false
                );

                /// I put the second term expectedAmount to see if theres any minor problem. And apparently theres not.
                totalClaimed = totalClaimed.add(expectedAmount);
                
                toBeExpected = expectedAmount;
                advanceTime(provider, consts.ONE_WEEK);
            }
        });

        xit("Multiple emissions claims for each week", async() => {
            const CLAIM_TRY = 5; 
            const connected = PENDLE.connect(a4);
            expect(await connected.getCurrentWeek()).to.be.equal(1);

            const INITIAL_LIQUIDITY_EMISSION = BN.from(await connected.balanceOf(a4.address));
            approxBigNumber(
                            INITIAL_LIQUIDITY_EMISSION,
                            BN.from(31200000).mul(CONFIG_DENOMINATOR),
                            0,
                            false
                        );
            
            
            let totalSupply = BN.from(await connected.callStatic.getTotalSupply());
            let totalClaimed = BN.from(0);
            let lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
            let lastWeekSupply = 0;

            for(let week = 1; week < 260 + 52 * 10; ++week) {
                if (week < 27) {
                    for(let t = 0; t < CLAIM_TRY; ++t) {
                        const emissionClaimable = BN.from(await connected.callStatic.claimLiquidityEmissions()).sub(totalClaimed);
                        expect(emissionClaimable).to.be.equal(0);                        
                    }
                }
                else if (week < 260) {
                    let expectedAmount = lastWeekClaimed.mul(989).div(1000);
                    let claimableAmount = (await connected.callStatic.claimLiquidityEmissions());
                    for(let t = 0; t < CLAIM_TRY; ++t) {
                        let currentClaimableAmount = (await connected.callStatic.claimLiquidityEmissions());
                        if (t == 0) {
                            approxBigNumber(
                                currentClaimableAmount,
                                expectedAmount,
                                0,
                                false
                            );
                            await connected.claimLiquidityEmissions();
                        }
                        else {
                            expect(currentClaimableAmount).to.be.equal(0);
                            await connected.claimLiquidityEmissions();
                        }
                    }
                    lastWeekClaimed = claimableAmount;
                    totalClaimed = totalClaimed.add(claimableAmount);
                    totalSupply = totalSupply.add(claimableAmount);
                } else {
                    let expectedAmount = totalSupply.mul(379848538).div(BN.from(1000000000000));
                    let claimableAmount = BN.from(await connected.callStatic.claimLiquidityEmissions());
                    for(let t = 0; t < CLAIM_TRY; ++t) {
                        let currentClaimableAmount = BN.from(await connected.callStatic.claimLiquidityEmissions());
                        
                        if (t == 0) {
                            approxBigNumber(
                                currentClaimableAmount,
                                expectedAmount,
                                0,
                                false
                            );
                            await connected.claimLiquidityEmissions();
                        }
                        else {
                            expect(currentClaimableAmount).to.be.equal(0);
                            await connected.claimLiquidityEmissions();
                        }
                    }
                    lastWeekClaimed = claimableAmount;
                    totalClaimed = totalClaimed.add(claimableAmount);
                    totalSupply = totalSupply.add(claimableAmount);
                }
                advanceTime(provider, consts.ONE_WEEK);
            }
        });

        it("test various ranges of waiting before claiming", async() => {
            let testRanges = [[3, 5]];
            let points = [2, 25, 26, 259, 260, 500, 13, 100, 37, 20, 300, 400];
            for(let i = 0; i < points.length; ++i) {
                for(let j = 0; j < points.length; ++j) {
                    for(let x = -1; x <= 1; ++x) {
                        for(let y = -1; y <= 1; ++y) {
                            let l = points[i] + x;
                            let r = points[j] + y;
                            if (l >= r) continue;
                            testRanges.push([l, r]);
                        }
                    }
                }
            }

            const startSupply = await PENDLE.callStatic.getTotalSupply();
            const INITIAL_LIQUIDITY_EMISSION = await PENDLE.connect(a4).balanceOf(a4.address);
            expect(INITIAL_LIQUIDITY_EMISSION)

            function calculateClaimableAmount(week, totalSupply, lastWeekClaimed){
                if (week < 27) return BN.from(0);
                if (week < 260) return lastWeekClaimed.mul(989).div(1000);
                return totalSupply.mul(379848538).div(BN.from(1000000000000));
            }

            let currentSupply = startSupply;
            let lastWeekClaimed = 0;
            let weeklyEmissions = [0];
            for (let week = 1; week < 600; ++week) {
                let claimableAmount = calculateClaimableAmount(week, currentSupply, lastWeekClaimed);
                currentSupply = currentSupply.add(claimableAmount);
                lastWeekClaimed = claimableAmount;
                if (week <= 26) lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
                weeklyEmissions.push(claimableAmount);
            }

            for(let i = 0; i < testRanges.length; ++i) {
                const range = testRanges[i];
                const l = range[0];
                const r = range[1];

                console.log(l, r);
                let shouldBeClaiming = BN.from(0);
                for(let j = l; j <= r; ++j) {
                    shouldBeClaiming = shouldBeClaiming.add(weeklyEmissions[j]);
                }

                PENDLE = await deployContract(root, MockPendle, [
                    root.address,
                    a1.address,
                    a2.address,
                    a3.address,
                    a4.address,
                ]);

                const connected = PENDLE.connect(a4);
                
                if(l > 2) advanceTime(provider, consts.ONE_WEEK.mul(BN.from(l - 2)));
                const pastClaimed = BN.from(await connected.callStatic.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE));
                await connected.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE);
                
                if (l == 1)
                    advanceTime(provider, consts.ONE_WEEK.mul(BN.from(r - l)));
                else
                    advanceTime(provider, consts.ONE_WEEK.mul(BN.from(r - l + 1)));

            
                const nowClaimed = BN.from(await connected.callStatic.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE));
                await connected.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE);

                const amountClaimed = nowClaimed;
                expect(amountClaimed.eq(shouldBeClaiming)).to.be.true;
            }
        });
    });
        

    // it("token after time....", async() => {
    //     advanceTime(provider, consts.ONE_WEEK.mul(50));
    //     console.log((await PENDLE.balanceOf(root.address)).toString());
    //     // await PENDLE.connect(a1).claimLiquidityEmissions();
    //     console.log((await PENDLE.balanceOf(root.address)).toString());

    // });
});