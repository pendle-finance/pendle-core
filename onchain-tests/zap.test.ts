import {
  advanceTime,
  approveInfinityIfNeed,
  evm_revert,
  evm_snapshot,
  fetchAll, getBalanceToken,
  getContract,
  getEth,
  impersonateAccount,
  impersonateAccountStop,
  Network,
  PendleEnv,
  setTimeNextBlock
} from "../pendle-deployment-scripts";
import { ERC20, PendleWrapper } from "../typechain-types";
import {
  DataAddLiqJoeStruct,
  DataAddLiqOTStruct,
  DataAddLiqYTStruct,
  DataPullStruct,
  DataTknzStruct
} from "../typechain-types/PendleWrapper";
import { Erc20Token, MiscConsts } from "@pendle/constants";
import { BigNumber as BN } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from "hardhat";
import { assert } from "chai";

describe("Zap tests", async () => {
  let snapshotId: string;
  let globalSnapshotId: string;
  let env: PendleEnv = {} as PendleEnv;
  const MODE_WONDERLAND = 3;
  const MODE_BENQI = 0;
  const MODE_JOE_SIMPLE = 1;
  const MODE_XJOE = 2;

  let PENDLE: Erc20Token;
  let NATIVE: Erc20Token;
  let USDC: Erc20Token;
  let JOE: Erc20Token;

  before(async () => {
    globalSnapshotId = await evm_snapshot();
    await fetchAll(env, Network.AVAX);

    PENDLE = env.tokens.PENDLE;
    NATIVE = env.tokens.NATIVE;
    USDC = env.tokens.USDC;
    JOE = env.tokens.JOE!;

    snapshotId = await evm_snapshot();
  });

  after(async () => {
    await evm_revert(globalSnapshotId);
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    await setTimeNextBlock(BN.from(1639656010));
    snapshotId = await evm_snapshot();
  });

  function toWei(amount: number, token: Erc20Token) {
    return BN.from(10).pow(token.decimal).mul(amount);
  }

  function getEmptyDataAddLiqJoe(): DataAddLiqJoeStruct {
    return {
      tokenA: MiscConsts.ZERO_ADDRESS,
      tokenB: MiscConsts.ZERO_ADDRESS,
      amountADesired: 0,
      amountBDesired: 0,
      amountAMin: 0,
      amountBMin: 0,
      deadline: 0
    };
  }

  async function mintFromSource(user: SignerWithAddress, amount: BN, token: Erc20Token): Promise<void> {
    let source = token.whale!;
    await getEth(source);
    await impersonateAccount(source);
    const signer = await hre.ethers.getSigner(source);
    const contractToken = await getContract("ERC20", token.address);
    let balanceOfSource: BN = await contractToken.balanceOf(source);
    assert(amount.lt(balanceOfSource), `Total amount of ${token.symbol!} minted exceeds limit`);
    await contractToken.connect(signer).transfer(user.address, amount);
    await impersonateAccountStop(source);
  }

  async function testInsAddDualLiqForOTandYTWonderland(MEMOorTIME: Erc20Token) {
    let amountMIM = toWei(10 ** 6, env.tokens.MIM!);
    let amountMoT = toWei(1, MEMOorTIME);

    await mintFromSource(env.deployer, amountMIM, env.tokens.MIM!);
    await mintFromSource(env.deployer, amountMoT, MEMOorTIME);
    await approveInfinityIfNeed(env, env.tokens.MIM!.address, env.pendleWrapper.address);
    await approveInfinityIfNeed(env, MEMOorTIME.address, env.pendleWrapper.address);

    let dataPull: DataPullStruct = {
      swaps: [],
      pulls: [
        { token: MEMOorTIME.address, amount: amountMoT },
        { token: env.tokens.MIM!.address, amount: amountMIM }
      ],
      deadline: MiscConsts.INF
    };
    let dataTknz: DataTknzStruct = {
      single: { token: MEMOorTIME.address, amount: amountMoT },
      double: getEmptyDataAddLiqJoe(),
      forge: env.pendleWonderlandForge.address,
      expiryYT: env.flat.TIME_24_FEB_2022
    };
    let dataAddOt: DataAddLiqOTStruct = {
      baseToken: env.tokens.MIM!.address,
      amountTokenDesired: amountMIM.div(2),
      amountTokenMin: 0,
      deadline: MiscConsts.INF,
      liqMiningAddr: env.flat.LIQ_OT_WMEMO_24_FEB_2022_X_MIM
    };
    let dataAddYt: DataAddLiqYTStruct = {
      baseToken: env.tokens.MIM!.address,
      amountTokenDesired: amountMIM.div(2),
      amountTokenMin: 0,
      marketFactoryId: env.consts.common.GENERIC_MARKET_FACTORY_ID,
      liqMiningAddr: env.flat.LIQ_YT_WMEMO_X_MIM
    };

    await env.pendleWrapper.insAddDualLiqForOTandYT(
      MODE_WONDERLAND,
      dataPull,
      dataTknz,
      dataAddOt,
      dataAddYt
    );

    // console.log((await getBalanceToken(PENDLE,env.deployer)).toString());
    // await advanceTime(MiscConsts.ONE_WEEK.add(MiscConsts.ONE_DAY));
    // await env.redeemProxy.redeemLmV1([{
    //   addr: env.flat.LIQ_YT_WMEMO_X_MIM,
    //   expiry: env.flat.TIME_24_FEB_2022,
    //   mode: 2
    // }], env.deployer.address);
    // await env.redeemProxy.redeemLmV2([{
    //   addr: env.flat.LIQ_OT_WMEMO_24_FEB_2022_X_MIM,
    //   expiry: env.flat.TIME_24_FEB_2022,
    //   mode: 2
    // }], env.deployer.address);
    // console.log((await getBalanceToken(PENDLE,env.deployer)).toString());
  }

  async function testInsAddDualLiqForOTandYTBenQi(isAvax: boolean) {
    let underlyingAsset: Erc20Token = isAvax ? env.tokens.NATIVE : USDC;
    let liqYT = isAvax ? env.flat.LIQ_YT_QIAVAX_X_USDC : env.flat.LIQ_YT_QIUSDC_X_USDC;
    let liqOT: string = isAvax ? env.flat.LIQ_OT_QIAVAX_28_DEC_2023_X_USDC : env.flat.LIQ_OT_QIUSDC_28_DEC_2023_X_USDC;

    let amountUSDCToMint = toWei(10 ** 6, USDC);
    let _10 = toWei(10, underlyingAsset);
    let _10000 = toWei(10000, USDC);

    await mintFromSource(env.deployer, amountUSDCToMint, USDC);
    await approveInfinityIfNeed(env, USDC.address, env.pendleWrapper.address);

    let dataPull: DataPullStruct = {
      swaps: [],
      pulls: [
        { token: USDC.address, amount: amountUSDCToMint },
        { token: NATIVE.address, amount: _10 }
      ],
      deadline: MiscConsts.INF
    };
    let dataTknz: DataTknzStruct = {
      single: { token: underlyingAsset.address, amount: _10 },
      double: getEmptyDataAddLiqJoe(),
      forge: env.pendleBenQiForge.address,
      expiryYT: env.flat.TIME_28_DEC_2023
    };
    let dataAddOt: DataAddLiqOTStruct = {
      baseToken: USDC.address,
      amountTokenDesired: _10000,
      amountTokenMin: 0,
      deadline: MiscConsts.INF,
      liqMiningAddr: liqOT
    };
    let dataAddYt: DataAddLiqYTStruct = {
      baseToken: USDC.address,
      amountTokenDesired: _10000,
      amountTokenMin: 0,
      marketFactoryId: env.consts.common.GENERIC_MARKET_FACTORY_ID,
      liqMiningAddr: liqYT
    };

    await env.pendleWrapper.insAddDualLiqForOTandYT(
      MODE_BENQI,
      dataPull,
      dataTknz,
      dataAddOt,
      dataAddYt,
      { value: _10 }
    );
  }

  async function testInsAddDualLiqForOTandYTPAP() {
    let amountPENDLEToMint = toWei(1000000, PENDLE);
    let _10000PENDLE = toWei(10000, PENDLE);

    await mintFromSource(env.deployer, amountPENDLEToMint, PENDLE);
    await approveInfinityIfNeed(env, PENDLE.address, env.pendleWrapper.address);

    let _10Avax = toWei(10, NATIVE);

    let dataPull: DataPullStruct = {
      swaps: [],
      pulls: [
        { token: PENDLE.address, amount: amountPENDLEToMint },
        { token: NATIVE.address, amount: _10Avax }
      ],
      deadline: MiscConsts.INF
    };
    let dataTknz: DataTknzStruct = {
      single: { token: MiscConsts.ZERO_ADDRESS, amount: 0 },
      double: {
        tokenA: PENDLE.address,
        tokenB: NATIVE.address,
        amountADesired: _10000PENDLE,
        amountBDesired: _10Avax,
        amountAMin: 0,
        amountBMin: 0,
        deadline: MiscConsts.INF
      },
      forge: env.pendleTraderJoeSimpleForge.address,
      expiryYT: env.flat.TIME_28_DEC_2023
    };
    let dataAddOt: DataAddLiqOTStruct = {
      baseToken: PENDLE.address,
      amountTokenDesired: _10000PENDLE.mul(10),
      amountTokenMin: 0,
      deadline: MiscConsts.INF,
      liqMiningAddr: MiscConsts.ZERO_ADDRESS
    };
    let dataAddYt: DataAddLiqYTStruct = {
      baseToken: PENDLE.address,
      amountTokenDesired: _10000PENDLE,
      amountTokenMin: 0,
      marketFactoryId: env.consts.common.GENERIC_MARKET_FACTORY_ID,
      liqMiningAddr: env.flat.LIQ_YT_JLP_WAVAX_PENDLE_X_PENDLE
    };

    await env.pendleWrapper.insAddDualLiqForOTandYT(
      MODE_JOE_SIMPLE,
      dataPull,
      dataTknz,
      dataAddOt,
      dataAddYt,
      { value: _10Avax }
    );
  }

  async function testInsAddDualLiqForOTandYTxJOE() {
    let amountUSDCToMint = toWei(10 ** 6, USDC);
    let amountJOEToMint = toWei(10 ** 3, JOE);

    await mintFromSource(env.deployer, amountUSDCToMint, USDC);
    await mintFromSource(env.deployer, amountJOEToMint, JOE);
    await approveInfinityIfNeed(env, USDC.address, env.pendleWrapper.address);
    await approveInfinityIfNeed(env, JOE.address, env.pendleWrapper.address);

    let dataPull: DataPullStruct = {
      swaps: [],
      pulls: [
        { token: USDC.address, amount: amountUSDCToMint },
        { token: JOE.address, amount: amountJOEToMint }
      ],
      deadline: MiscConsts.INF
    };
    let dataTknz: DataTknzStruct = {
      single: { token: JOE.address, amount: amountJOEToMint },
      double: getEmptyDataAddLiqJoe(),
      forge: env.pendleXJoeForge.address,
      expiryYT: env.flat.TIME_30_JUN_2022
    };
    let dataAddOt: DataAddLiqOTStruct = {
      baseToken: USDC.address,
      amountTokenDesired: amountUSDCToMint,
      amountTokenMin: 0,
      deadline: MiscConsts.INF,
      liqMiningAddr: env.flat.LIQ_OT_XJOE_30_JUN_2022_X_USDC
    };
    let dataAddYt: DataAddLiqYTStruct = {
      baseToken: USDC.address,
      amountTokenDesired: amountUSDCToMint,
      amountTokenMin: 0,
      marketFactoryId: env.consts.common.GENERIC_MARKET_FACTORY_ID,
      liqMiningAddr: env.flat.LIQ_YT_XJOE_X_USDC
    };

    await env.pendleWrapper.insAddDualLiqForOTandYT(
      MODE_XJOE,
      dataPull,
      dataTknz,
      dataAddOt,
      dataAddYt,
    );
  }

  it("User should be able to do insAddDualLiqForOTandYT by TIME and MIM", async () => {
    await testInsAddDualLiqForOTandYTWonderland(env.tokens.TIME!);
  });
  it("User should be able to do insAddDualLiqForOTandYT by MEMO and MIM", async () => {
    await testInsAddDualLiqForOTandYTWonderland(env.tokens.MEMO!);
  });
  it("User should be able to do insAddDualLiqForOTandYT for QiUSDC", async () => {
    await testInsAddDualLiqForOTandYTBenQi(false);
  });
  it("User should be able to do insAddDualLiqForOTandYT for QiAvax", async () => {
    await testInsAddDualLiqForOTandYTBenQi(true);
  });
  it("User should be able to do insAddDualLiqForOTandYT for PAP", async () => {
    await testInsAddDualLiqForOTandYTPAP();
  });
  it("User should be able to do insAddDualLiqForOTandYT for xJOE", async () => {
    await testInsAddDualLiqForOTandYTxJOE();
  });
});
