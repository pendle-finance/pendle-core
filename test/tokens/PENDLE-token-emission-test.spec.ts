import { expect } from "chai";
import { Contract, providers, Wallet, BigNumber as BN, utils } from "ethers";
import PENDLE from "../../build/artifacts/contracts/tokens/PENDLE.sol/PENDLE.json";
import MockPendle from "../../build/artifacts/contracts/mock/MockPENDLE.sol/MockPENDLE.json";
import {
  errMsg,
  consts,
  evm_revert,
  evm_snapshot,
  setTimeNextBlock,
  advanceTime,
  approxBigNumber,
} from "../helpers";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

describe("Token name test", async () => {
  const wallets: Wallet[] = provider.getWallets();

  const [root, a1, a2, a3, a4] = wallets;

  const name = "Pendle";
  const symbol = "PENDLE";
  const initialSupply = BN.from("188700000000000000000000000");
  const CONFIG_DENOMINATOR = BN.from(1000000000000);

  let PENDLE: Contract;
  let globalSnapshotId: string;
  let snapshotId: string;

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    snapshotId = await evm_snapshot();

    let terminalInflationRateNumerator = BN.from(379848538);
    let emissionRateMultiplierNumerator = CONFIG_DENOMINATOR.mul(989).div(1000);
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    PENDLE = await deployContract(root, MockPendle, [
      root.address,
      root.address,
      root.address,
      root.address,
      a4.address,
    ]);
    snapshotId = await evm_snapshot();
  });

  describe("token basic information", async () => {
    it("token name should be Pendle", async () => {
      // console.log(await PENDLE.name());
      expect(await PENDLE.name()).to.be.equal(name);
    });

    it("token symble should be PENDLE", async () => {
      // console.log(await PENDLE.symbol());
      expect(await PENDLE.symbol()).to.be.equal(symbol);
    });
  });

  describe("PENDLE emissions", async () => {
    xit("initial 26 weeks emissions", async () => {
      const connected = PENDLE.connect(a4);
      expect(await connected.balanceOf(a4.address)).to.be.equal(
        BN.from(31200000).mul(CONFIG_DENOMINATOR)
      );
      expect(await connected.getCurrentWeek()).to.be.equal(1);
    });

    xit("try callstatic to check for amount claimable each week", async () => {
      let toBeExpected = BN.from(0);
      const connected = await PENDLE.connect(a4);
      const INITIAL_LIQUIDITY_EMISSION = BN.from(
        await connected.balanceOf(a4.address)
      );

      let lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
      let totalClaimed = BN.from(0);

      advanceTime(provider, consts.ONE_WEEK.mul(26));

      for (let i = 27; i < 260; ++i) {
        expect(await connected.getCurrentWeek()).to.be.equal(i);
        let currentWeekClaimed = BN.from(
          await connected.callStatic.claimLiquidityEmissions()
        ).sub(totalClaimed);
        expect(lastWeekClaimed.gt(currentWeekClaimed)).to.be.true;
        let expectedAmount = lastWeekClaimed.mul(989).div(1000);
        approxBigNumber(currentWeekClaimed, expectedAmount, 0, false);
        totalClaimed = totalClaimed.add(currentWeekClaimed);
        lastWeekClaimed = expectedAmount;

        toBeExpected = BN.from(await connected.callStatic.getTotalSupply())
          .mul(379848538)
          .div(BN.from(1000000000000));
        advanceTime(provider, consts.ONE_WEEK);
      }

      for (let i = 260; i < 260 + 52; ++i) {
        expect(await connected.getCurrentWeek()).to.be.equal(i);
        let currentWeekClaimed = BN.from(
          await connected.callStatic.claimLiquidityEmissions()
        ).sub(totalClaimed);
        let expectedAmount = BN.from(
          await connected.callStatic.getTotalSupply()
        )
          .mul(379848538)
          .div(BN.from(1000000000000));

        approxBigNumber(currentWeekClaimed, toBeExpected, 10, false);

        /// I put the second term expectedAmount to see if theres any minor problem. And apparently theres not.
        totalClaimed = totalClaimed.add(expectedAmount);

        toBeExpected = expectedAmount;
        advanceTime(provider, consts.ONE_WEEK);
      }
    });

    xit("Multiple emissions claims for each week", async () => {
      const CLAIM_TRY = 5;
      const connected = PENDLE.connect(a4);
      expect(await connected.getCurrentWeek()).to.be.equal(1);

      const INITIAL_LIQUIDITY_EMISSION = BN.from(
        await connected.balanceOf(a4.address)
      );
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

      for (let week = 1; week < 260 + 52 * 10; ++week) {
        if (week < 27) {
          for (let t = 0; t < CLAIM_TRY; ++t) {
            const emissionClaimable = BN.from(
              await connected.callStatic.claimLiquidityEmissions()
            ).sub(totalClaimed);
            expect(emissionClaimable).to.be.equal(0);
          }
        } else if (week < 260) {
          let expectedAmount = lastWeekClaimed.mul(989).div(1000);
          let claimableAmount = await connected.callStatic.claimLiquidityEmissions();
          for (let t = 0; t < CLAIM_TRY; ++t) {
            let currentClaimableAmount = await connected.callStatic.claimLiquidityEmissions();
            if (t == 0) {
              approxBigNumber(currentClaimableAmount, expectedAmount, 0, false);
              await connected.claimLiquidityEmissions();
            } else {
              expect(currentClaimableAmount).to.be.equal(0);
              await connected.claimLiquidityEmissions();
            }
          }
          lastWeekClaimed = claimableAmount;
          totalClaimed = totalClaimed.add(claimableAmount);
          totalSupply = totalSupply.add(claimableAmount);
        } else {
          let expectedAmount = totalSupply
            .mul(379848538)
            .div(BN.from(1000000000000));
          let claimableAmount = BN.from(
            await connected.callStatic.claimLiquidityEmissions()
          );
          for (let t = 0; t < CLAIM_TRY; ++t) {
            let currentClaimableAmount = BN.from(
              await connected.callStatic.claimLiquidityEmissions()
            );

            if (t == 0) {
              approxBigNumber(currentClaimableAmount, expectedAmount, 0, false);
              await connected.claimLiquidityEmissions();
            } else {
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

    xit("test various ranges of waiting before claiming", async () => {
      let testRanges = [[3, 5]];
      let points = [2, 25, 26, 259, 260, 500, 13, 100, 37, 20, 300, 400];
      for (let i = 0; i < points.length; ++i) {
        for (let j = 0; j < points.length; ++j) {
          for (let x = -1; x <= 1; ++x) {
            for (let y = -1; y <= 1; ++y) {
              let l = points[i] + x;
              let r = points[j] + y;
              if (l >= r) continue;
              testRanges.push([l, r]);
            }
          }
        }
      }

      testRanges = [[27, 77]];

      const startSupply = await PENDLE.callStatic.getTotalSupply();
      const INITIAL_LIQUIDITY_EMISSION = await PENDLE.connect(a4).balanceOf(
        a4.address
      );
      expect(INITIAL_LIQUIDITY_EMISSION);

      function calculateClaimableAmount(week:number, totalSupply:BN, lastWeekClaimed:BN) {
        if (week < 27) return BN.from(0);
        if (week < 260) return lastWeekClaimed.mul(989).div(1000);
        return totalSupply.mul(379848538).div(BN.from(1000000000000));
      }

      let currentSupply = startSupply;
      let lastWeekClaimed = BN.from(0);
      let weeklyEmissions = [BN.from(0)];
      for (let week = 1; week < 600; ++week) {
        let claimableAmount = calculateClaimableAmount(
          week,
          currentSupply,
          lastWeekClaimed
        );
        currentSupply = currentSupply.add(claimableAmount);
        lastWeekClaimed = claimableAmount;
        if (week <= 26) lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
        weeklyEmissions.push(claimableAmount);
      }

      for (let i = 0; i < testRanges.length; ++i) {
        const range = testRanges[i];
        const l = range[0];
        const r = range[1];

        console.log(l, r);
        let shouldBeClaiming = BN.from(0);
        for (let j = l; j <= r; ++j) {
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

        if (l > 2) advanceTime(provider, consts.ONE_WEEK.mul(BN.from(l - 2)));
        const pastClaimed = BN.from(
          await connected.callStatic.claimLiquidityEmissions(
            consts.HIGH_GAS_OVERRIDE
          )
        );
        await connected.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE);

        if (l == 1) advanceTime(provider, consts.ONE_WEEK.mul(BN.from(r - l)));
        else advanceTime(provider, consts.ONE_WEEK.mul(BN.from(r - l + 1)));

        const nowClaimed = BN.from(
          await connected.callStatic.claimLiquidityEmissions(
            consts.HIGH_GAS_OVERRIDE
          )
        );
        await connected.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE);

        const amountClaimed = nowClaimed;
        expect(amountClaimed.eq(shouldBeClaiming)).to.be.true;
      }
    });

    it("test applying config changes to pendle", async () => {
      function getRandomNumber(max: number) {
        return Math.floor(Math.random() * max);
      }

      function getRandomBigNumber(max: number) {
        return BN.from(getRandomNumber(max));
      }

      const root_connected = PENDLE.connect(root);
      const INITIAL_LIQUIDITY_EMISSION = BN.from(
        await PENDLE.balanceOf(a4.address)
      );

      const recipents = [a2, a3, a4];

      const addresses = [a2.address, a3.address, a4.address];

      let correctEmissionForAddress = [
        BN.from(0),
        BN.from(0),
        INITIAL_LIQUIDITY_EMISSION,
      ];

      let emissionForAddress = [
        BN.from(0),
        BN.from(0),
        INITIAL_LIQUIDITY_EMISSION,
      ];

      let lastWeekClaimed = INITIAL_LIQUIDITY_EMISSION.div(26);
      let totalSupplyNumber = await root_connected.callStatic.getTotalSupply(
        consts.HIGH_GAS_OVERRIDE
      );
      let totalSupply = BN.from(totalSupplyNumber);

      let recipentIndex = 2;
      let pendingRecipentIndex = 2;

      let emissionRateMultiplierNumerator = CONFIG_DENOMINATOR.mul(989).div(
        1000
      );
      let terminalInflationRateNumerator = BN.from(379848538);
      let liquidityIncentivesRecipient = a4.address;

      let pendingEmissionRateMultiplierNumerator = BN.from(0);
      let pendingTerminalInflationRateNumerator = BN.from(0);
      let pendingLiquidityIncentivesRecipient = "0";
      let configChangesInitiated = BN.from(0);

      async function initiateConfigChangeSimulator(
        _emissionRateMultiplierNumerator: BN,
        _terminalInflationRateNumerator: BN,
        _liquidityIncentivesRecipient: string
      ) {
        configChangesInitiated = await root_connected.getCurrentTime(
          consts.HIGH_GAS_OVERRIDE
        );
        pendingEmissionRateMultiplierNumerator = _emissionRateMultiplierNumerator;
        pendingTerminalInflationRateNumerator = _terminalInflationRateNumerator;
        pendingLiquidityIncentivesRecipient = _liquidityIncentivesRecipient;
        await root_connected.initiateConfigChanges(
          _emissionRateMultiplierNumerator,
          _terminalInflationRateNumerator,
          _liquidityIncentivesRecipient,
          consts.HIGH_GAS_OVERRIDE
        );
      }

      async function initiateConfigChange(
        _emissionRateMultiplierNumerator: BN,
        _terminalInflationRateNumerator: BN,
        recipent: number
      ) {
        await initiateConfigChangeSimulator(
          _emissionRateMultiplierNumerator,
          _terminalInflationRateNumerator,
          addresses[recipent]
        );
        pendingRecipentIndex = recipent;
      }

      async function updateCorrectEmission(week: number) {
        if (week > 26) {
          let amountClaimable = BN.from(0);
          if (week < 260) {
            amountClaimable = lastWeekClaimed
              .mul(emissionRateMultiplierNumerator)
              .div(CONFIG_DENOMINATOR);
          } else {
            amountClaimable = totalSupply
              .mul(terminalInflationRateNumerator)
              .div(CONFIG_DENOMINATOR);
          }
          correctEmissionForAddress[recipentIndex] = correctEmissionForAddress[
            recipentIndex
          ].add(amountClaimable);
          totalSupply = totalSupply.add(amountClaimable);
          lastWeekClaimed = amountClaimable;
        }
      }

      async function applyConfigSimulator() {
        const recipent_connected = PENDLE.connect(recipents[recipentIndex]);
        emissionForAddress[recipentIndex] = emissionForAddress[
          recipentIndex
        ].add(
          await recipent_connected.callStatic.claimLiquidityEmissions(
            consts.HIGH_GAS_OVERRIDE
          )
        );

        await recipent_connected.claimLiquidityEmissions(
          consts.HIGH_GAS_OVERRIDE
        );

        if (configChangesInitiated.eq(BN.from(0))) return;
        await root_connected.applyConfigChanges(consts.HIGH_GAS_OVERRIDE);

        emissionRateMultiplierNumerator = pendingEmissionRateMultiplierNumerator;
        terminalInflationRateNumerator = pendingTerminalInflationRateNumerator;
        liquidityIncentivesRecipient = pendingLiquidityIncentivesRecipient;
        recipentIndex = pendingRecipentIndex;
        configChangesInitiated = BN.from(0);
      }

      async function claimLiquidityEmissionsSimulator() {
        const claimedAmount = await PENDLE.connect(
          recipents[recipentIndex]
        ).callStatic.claimLiquidityEmissions(consts.HIGH_GAS_OVERRIDE);
        await PENDLE.connect(recipents[recipentIndex]).claimLiquidityEmissions(
          consts.HIGH_GAS_OVERRIDE
        );
        emissionForAddress[recipentIndex] = emissionForAddress[
          recipentIndex
        ].add(claimedAmount);
        return claimedAmount;
      }

      for (let week = 1; week < 1000; ++week) {
        if (getRandomNumber(100) < 5) {
          await initiateConfigChange(
            emissionRateMultiplierNumerator
              .mul(getRandomBigNumber(200).add(BN.from(800)))
              .div(BN.from(1000)),
            terminalInflationRateNumerator
              .mul(getRandomBigNumber(200).add(BN.from(800)))
              .div(BN.from(1000)),
            getRandomNumber(3)
          );
        }

        await updateCorrectEmission(week);
        await claimLiquidityEmissionsSimulator();
        
        try {
          /// Might not have been 1 week yet
          if (getRandomNumber(100) < 10) await applyConfigSimulator();
        } catch (error) {}

        advanceTime(provider, consts.ONE_WEEK);
      }

      await updateCorrectEmission(1000);
      await claimLiquidityEmissionsSimulator();

      expect(correctEmissionForAddress[0].eq(emissionForAddress[0])).to.be
        .true;
      expect(correctEmissionForAddress[1].eq(emissionForAddress[1])).to.be
        .true;
      expect(correctEmissionForAddress[2].eq(emissionForAddress[2])).to.be
        .true;
    });
  });

  // it("token after time....", async() => {
  //     advanceTime(provider, consts.ONE_WEEK.mul(50));
  //     console.log((await PENDLE.balanceOf(root.address)).toString());
  //     // await PENDLE.connect(a1).claimLiquidityEmissions();
  //     console.log((await PENDLE.balanceOf(root.address)).toString());

  // });
});
