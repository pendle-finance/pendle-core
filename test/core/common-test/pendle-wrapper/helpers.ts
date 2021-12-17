import { Erc20Token, MiscConsts } from '@pendle/constants';
import {
  bootstrapMarket,
  getOtRouter,
  mintXytBenQi,
  mintXytTraderJoeFixed,
  mintXytWMEMOFixed,
  mintXytXJoeFixed,
} from '../../../helpers';
import { Mode, TestEnv, wallets } from '../../../fixtures';
import { amountToWei, doInfinityApproveWrapper, getBalanceToken } from '../../../../pendle-deployment-scripts';
import { BigNumber as BN, BigNumberish, Contract, Wallet } from 'ethers';
import { expect } from 'chai';

const [alice, bob, charlie, dave, eve] = wallets;

export const ModeToModeMapping: Record<Mode, number> = {
  [Mode.BENQI]: 0,
  [Mode.TRADER_JOE]: 1,
  [Mode.XJOE]: 2,
  [Mode.WONDERLAND]: 3,
  [Mode.KYBER_DMM]: -1,
  [Mode.COMPOUND_V2]: -1,
  [Mode.SUSHISWAP_SIMPLE]: -1,
  [Mode.SUSHISWAP_COMPLEX]: -1,
  [Mode.UNISWAPV2]: -1,
  [Mode.COMPOUND]: -1,
  [Mode.SLP_LIQ]: -1,
  [Mode.GENERAL_TEST]: -1,
  [Mode.JLP_LIQ]: -1,
  [Mode.AAVE_V2]: -1,
};

export interface DataTknzSingle {
  token: string;
  amount: BigNumberish;
}

export interface PairTokenAmount {
  token: string;
  amount: BigNumberish;
}

export interface DataAddLiqJoe {
  tokenA: string;
  tokenB: string;
  amountADesired: BigNumberish;
  amountBDesired: BigNumberish;
  amountAMin: BigNumberish;
  amountBMin: BigNumberish;
  deadline: BigNumberish;
}

export interface DataTknz {
  single: DataTknzSingle;
  double: DataAddLiqJoe;
  forge: string;
  expiryYT: BigNumberish;
}

export interface DataAddLiqYT {
  baseToken: string;
  amountTokenDesired: BigNumberish;
  amountTokenMin: BigNumberish;
  marketFactoryId: string;
  liqMiningAddr: string;
}

export interface DataAddLiqOT {
  baseToken: string;
  amountTokenDesired: BigNumberish;
  amountTokenMin: BigNumberish;
  deadline: BigNumberish;
  liqMiningAddr: string;
}

export interface DataSwap {
  amountInMax: BigNumberish;
  amountOut: BigNumberish;
  path: string[];
}

export interface DataPull {
  swaps: DataSwap[];
  pulls: PairTokenAmount[];
  deadline: BN;
}

export function getDataTknzDouble(env: TestEnv, isEthTest: boolean): DataTknz {
  if (!isEthTest) {
    return {
      single: { token: MiscConsts.ZERO_ADDRESS, amount: 0 },
      double: {
        tokenA: env.underlyingTokens[0].address,
        tokenB: env.underlyingTokens[1].address,
        amountADesired: amountToWei(BN.from(1000), env.underlyingTokens[0].decimal),
        amountBDesired: amountToWei(BN.from(1000), env.underlyingTokens[1].decimal),
        amountAMin: 0,
        amountBMin: 0,
        deadline: MiscConsts.INF,
      },
      forge: env.forge.address,
      expiryYT: env.EXPIRY,
    };
  } else {
    /// ASSUMING underlyingTokens[0] = WETH
    return {
      single: { token: MiscConsts.ZERO_ADDRESS, amount: 0 },
      double: {
        tokenA: env.ptokens.NATIVE.address,
        tokenB: env.underlyingTokens[1].address,
        amountADesired: amountToWei(BN.from(1000), env.underlyingTokens[0].decimal),
        amountBDesired: amountToWei(BN.from(1000), env.underlyingTokens[1].decimal),
        amountAMin: 0,
        amountBMin: 0,
        deadline: MiscConsts.INF,
      },
      forge: env.forge.address,
      expiryYT: env.EXPIRY,
    };
  }
}

export function getDataTknzSingle(env: TestEnv, initialUnderlyingBalance: BN): DataTknz {
  return {
    single: { token: env.underlyingAsset.address, amount: initialUnderlyingBalance.div(2) },
    double: {
      tokenA: MiscConsts.ZERO_ADDRESS,
      tokenB: MiscConsts.ZERO_ADDRESS,
      amountADesired: 0,
      amountBDesired: 0,
      amountAMin: 0,
      amountBMin: 0,
      deadline: 0,
    },
    forge: env.forge.address,
    expiryYT: env.EXPIRY,
  };
}

export function isSingleData(env: TestEnv) {
  return env.mode == Mode.XJOE || env.mode == Mode.BENQI || env.mode == Mode.WONDERLAND;
}

export function isDoubleData(env: TestEnv) {
  return env.mode == Mode.TRADER_JOE;
}

export async function expectZeroBalWrapper(env: TestEnv, tokens: any[]) {
  for (const token of tokens) {
    const balance: BN = await getBalanceToken(token, env.pendleWrapper.address);
    expect(balance).to.be.eq(0);
  }
}

export async function expectNonZeroBalUser(env: TestEnv, user: Wallet, tokens: any[]) {
  for (const token of tokens) {
    const balance: BN = await getBalanceToken(token, user.address);
    expect(balance.gt(0), 'Expecting token balance of user to be greater than 0').to.be.true;
  }
}

export async function expectZeroBalUser(env: TestEnv, user: Wallet, tokens: any[]) {
  for (const token of tokens) {
    const balance: BN = await getBalanceToken(token, user.address);
    expect(balance).to.be.eq(0);
  }
}

export async function manageApproval(env: TestEnv) {
  let approvalArray: { token: string; to: string }[] = [];

  function addToApprovalArray(token: Contract | Erc20Token, to: string) {
    approvalArray.push({ token: token.address, to });
  }

  for (let token of [env.yToken, env.xyt, env.testToken]) {
    addToApprovalArray(token, env.router.address);
  }
  for (let token of [env.ot, env.ptokens.USDC!, env.ptokens.WNATIVE]) {
    addToApprovalArray(token, getOtRouter(env));
  }
  if (env.mode == Mode.XJOE) {
    addToApprovalArray(env.underlyingAsset, env.ptokens.XJOE!.address);
  }
  if (env.mode == Mode.BENQI) {
    addToApprovalArray(env.ptokens.DAI!, env.ptokens.DAI!.benqi!);
  }
  if (env.mode == Mode.TRADER_JOE) {
    for (let token of env.underlyingTokens) {
      addToApprovalArray(token, env.pconsts.joe!.ROUTER);
    }
  }
  if (env.mode == Mode.WONDERLAND) {
    addToApprovalArray(env.MEMOContract, env.wMEMOContract.address);
    addToApprovalArray(env.TIMEContract, env.wonderlandTimeStaking.address);
  }
  await doInfinityApproveWrapper(env.penv, approvalArray);
}

export async function bootStrapMarkets(env: TestEnv) {
  if (env.mode == Mode.XJOE) {
    await mintXytXJoeFixed(env, alice, env.EXPIRY);
  } else if (env.mode == Mode.TRADER_JOE) {
    await mintXytTraderJoeFixed(env, alice, env.EXPIRY);
  } else if (env.mode == Mode.BENQI) {
    await mintXytBenQi(env, env.underlyingAsset, alice, env.INITIAL_YIELD_TOKEN_AMOUNT, env.EXPIRY);
  } else if (env.mode == Mode.WONDERLAND) {
    await mintXytWMEMOFixed(env, alice, env.EXPIRY);
  }
  const ytBalance = await env.xyt.balanceOf(alice.address);
  await bootstrapMarket(env, alice, ytBalance.div(2));
}

export function getPullData(
  swaps: DataSwap[],
  dataTknz?: DataTknz,
  dataAddLiqOt?: DataAddLiqOT,
  dataAddLiqYt?: DataAddLiqYT
): DataPull {
  let pulls: PairTokenAmount[] = [];

  function addToPulls(inp: PairTokenAmount) {
    if (inp.token == MiscConsts.ZERO_ADDRESS) return;
    for (let i = 0; i < pulls.length; i++) {
      if (pulls[i].token === inp.token) {
        pulls[i].amount = BN.from(pulls[i].amount).add(inp.amount);
        return;
      }
    }
    pulls.push(inp);
  }

  if (dataTknz !== undefined) {
    addToPulls({ token: dataTknz.single.token, amount: dataTknz.single.amount });
    addToPulls({ token: dataTknz.double.tokenA, amount: dataTknz.double.amountADesired });
    addToPulls({ token: dataTknz.double.tokenB, amount: dataTknz.double.amountBDesired });
  }

  if (dataAddLiqOt !== undefined) {
    addToPulls({ token: dataAddLiqOt.baseToken, amount: dataAddLiqOt.amountTokenDesired });
  }

  if (dataAddLiqYt !== undefined) {
    addToPulls({ token: dataAddLiqYt.baseToken, amount: dataAddLiqYt.amountTokenDesired });
  }

  return {
    swaps,
    pulls,
    deadline: MiscConsts.INF,
  };
}
