import {
  advanceTime,
  DeployOrFetch,
  evm_revert,
  evm_snapshot,
  fetchAll,
  getContract,
  impersonateGov,
  mineBlock,
  mintFromSource,
  Network,
  PendleEnv,
  registerNewRedactedToken,
  sendAndWaitForTransaction,
  setTimeNextBlock,
} from '../pendle-deployment-scripts';
import { BigNumber as BN } from 'ethers';
import {
  addRedactedForgeToPendleData,
  deployRedactedForge,
  initRedactedForge,
} from '../pendle-deployment-scripts/deploy-forge/deploy-redacted';
import hre from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ERC20, IWXBTRFLY } from '../typechain-types';
import { expect } from 'chai';
import { IRedactedStaking } from '../typechain-types/IRedactedStaking';

describe('Redacted forge test', async () => {
  const FORGE_FEE = 3;

  // test env data
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: PendleEnv = {} as PendleEnv;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let REF_AMOUNT: BN;

  // redacted data
  let REF_AMOUNT_WEI: BN;
  let T0: BN;
  let expiry: BN;
  let redactedStaking: IRedactedStaking;
  let forgeID: string;
  let xBTRFLY: ERC20;
  let wxBTRFLY: IWXBTRFLY;
  let OT: ERC20;
  let YT: ERC20;
  let importantTimestamp: BN[];
  let epochLength = 2200; // number of block to advance, for redactedStaking.rebase()

  async function tryDeployRedactedFixture(env: PendleEnv) {
    await deployRedactedForge(env, DeployOrFetch.DEPLOY);
    await initRedactedForge(env);
    await addRedactedForgeToPendleData(env);

    await registerNewRedactedToken(env);

    let T0 = BN.from(1653091200); // Saturday, 21 May 2022 00:00:00

    await setTimeNextBlock(T0);

    await sendAndWaitForTransaction(env.pendleRouter.newYieldContracts, 'newYieldContract', [
      env.consts.redacted!.FORGE_ID!,
      env.tokens.xBTRFLY!.address,
      T0.add(env.consts.misc.SIX_MONTH),
    ]);

    return T0;
  }

  async function getWXBTRFLY(user: SignerWithAddress, amountXBTRFLY: BN) {
    await mintFromSource(user, amountXBTRFLY, env.tokens.xBTRFLY!);
    await xBTRFLY.connect(user).approve(wxBTRFLY.address, env.consts.misc.INF);
    await wxBTRFLY.connect(user).wrapFromxBTRFLY(REF_AMOUNT_WEI);
  }

  async function addFakeIncomeRedacted() {
    await mineBlock(epochLength);
    await redactedStaking.rebase();
  }

  async function getValueInXBTRFLY(addr: string) {
    return await wxBTRFLY.xBTRFLYValue(await wxBTRFLY.balanceOf(addr));
  }

  // currently only used for 1e-9 xBTRFLY delta
  // getExchangeRate precision issue causes OT balance to be (1e-9 xBTRFLY) less then original xBTRFLY balance
  // at the time of writing this test, 1e-9 xBTRFLY < 1e-6 USD
  function expectEqualWithPrecision(val: BN, other: BN) {
    let diff = val.sub(other).abs();
    expect(diff).to.be.lte(1);
  }

  async function prepTestEnv() {
    // prep test env data
    await fetchAll(env, Network.ETH);
    await impersonateGov(env);
    T0 = await tryDeployRedactedFixture(env);
    expiry = T0.add(env.consts.misc.SIX_MONTH);
    [alice, bob] = await hre.ethers.getSigners();
    REF_AMOUNT = BN.from(10 ** 2);

    // prep redacted data
    REF_AMOUNT_WEI = REF_AMOUNT.mul(10 ** env.tokens.xBTRFLY!.decimal);

    redactedStaking = (await getContract('IRedactedStaking', env.consts.redacted!.BTRFLY_STAKING)) as IRedactedStaking;
    xBTRFLY = (await getContract('ERC20', env.tokens.xBTRFLY!)) as ERC20;
    wxBTRFLY = (await getContract('IWXBTRFLY', env.tokens.wxBTRFLY!)) as IWXBTRFLY;

    forgeID = env.consts.redacted!.FORGE_ID!;
    let YTAddr = await env.pendleData.xytTokens(forgeID, xBTRFLY.address, expiry);
    let OTAddr = await env.pendleData.otTokens(forgeID, xBTRFLY.address, expiry);
    OT = (await getContract('ERC20', OTAddr)) as ERC20;
    YT = (await getContract('ERC20', YTAddr)) as ERC20;

    // 1 month, 2 month, pre expiry, post expiry
    importantTimestamp = [
      T0.add(env.consts.misc.ONE_MONTH),
      T0.add(env.consts.misc.ONE_MONTH.mul(2)),
      expiry.sub(env.consts.misc.ONE_DAY),
      expiry.add(env.consts.misc.ONE_DAY),
    ];
  }

  async function prepTestScenario() {
    // at T0: alice and bob have the same amount of wxButterfly
    await getWXBTRFLY(alice, REF_AMOUNT);
    await getWXBTRFLY(bob, REF_AMOUNT);
    let wxBTRFLYBalanceAlice = await wxBTRFLY.balanceOf(alice.address);

    // alice mint OT/YT with wxBTRFLY
    await wxBTRFLY.connect(alice).approve(env.pendleRouter.address, env.consts.misc.INF);
    await env.pendleRouter
      .connect(alice)
      .tokenizeYield(forgeID, xBTRFLY.address, expiry, wxBTRFLYBalanceAlice, alice.address);
  }

  // simulate timestamp and execute test, no need to reset block
  async function simulateTimestamp(test: (timestamp: BN) => Promise<void>) {
    let lastTimestamp = T0;
    for (let timestamp of importantTimestamp) {
      await advanceTime(timestamp.sub(lastTimestamp));
      await addFakeIncomeRedacted();
      lastTimestamp = timestamp;
      await test(timestamp);
    }
  }

  before(async () => {
    globalSnapshotId = await evm_snapshot();

    await prepTestEnv();
    await prepTestScenario();

    snapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  it('getExchangeRate should work correctly', async () => {
    let otBal = await OT.balanceOf(alice.address);
    expect(otBal).to.be.eq(await YT.balanceOf(alice.address));
    expectEqualWithPrecision(otBal, REF_AMOUNT_WEI);
  });

  it('interest from YT should match normal interest minus forgeFee', async () => {
    await simulateTimestamp(async (timestamp: BN) => {
      let alicePreBalWXBTRL = await wxBTRFLY.balanceOf(alice.address);
      await env.pendleRouter.connect(alice).redeemDueInterests(forgeID, xBTRFLY.address, expiry, alice.address);
      let aliceInterest = await getValueInXBTRFLY(alice.address);
      let bobInterest = (await getValueInXBTRFLY(bob.address)).sub(REF_AMOUNT_WEI);

      if (timestamp < expiry) {
        expectEqualWithPrecision(aliceInterest, bobInterest.mul(100 - FORGE_FEE).div(100));
      } else {
        // alice should NOT gain any wxBTRFLY after expiry
        expect(alicePreBalWXBTRL).to.be.eq(await wxBTRFLY.balanceOf(alice.address));
      }
    });
  });

  it('redeem underlying should work correctly', async () => {
    await addFakeIncomeRedacted();
    await env.pendleRouter
      .connect(alice)
      .redeemUnderlying(forgeID, xBTRFLY.address, expiry, await OT.balanceOf(alice.address));
    let aliceInterest = (await getValueInXBTRFLY(alice.address)).sub(REF_AMOUNT_WEI);
    let bobInterest = (await getValueInXBTRFLY(bob.address)).sub(REF_AMOUNT_WEI);
    expectEqualWithPrecision(aliceInterest, bobInterest.mul(100 - FORGE_FEE).div(100));
  });

  it('redeem after expiry should work correctly', async () => {
    await advanceTime(expiry.sub(T0));
    await env.pendleRouter.redeemAfterExpiry(forgeID, xBTRFLY.address, expiry);
    expectEqualWithPrecision(await getValueInXBTRFLY(alice.address), await getValueInXBTRFLY(bob.address));
  });

  it('forge fee should be withdrawn to treasury correctly', async () => {
    await addFakeIncomeRedacted();
    await env.pendleRouter.connect(alice).redeemDueInterests(forgeID, xBTRFLY.address, expiry, alice.address);
    await env.pendleRedactedForge.connect(env.deployer).withdrawForgeFee(xBTRFLY.address, expiry);
    let treasuryInterest = await getValueInXBTRFLY(await env.pendleData.treasury());
    let bobInterest = (await getValueInXBTRFLY(bob.address)).sub(REF_AMOUNT_WEI);
    expectEqualWithPrecision(treasuryInterest, bobInterest.mul(FORGE_FEE).div(100));
  });
});
