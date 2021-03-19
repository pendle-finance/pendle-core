import { BigNumber as BN, utils } from "ethers";
export type Token = {
  address: string;
  decimal: number;
  compound: string;
  owner?: string;
};

type TokenMap = Record<string, Token>;

const ONE_E_18 = BN.from(10).pow(18);

export const consts = {
  ONE_E_18,
  DUMMY_ADDRESS: "0xDEADbeEfEEeEEEeEEEeEEeeeeeEeEEeeeeEEEEeE",
  DUMMY_GOVERNANCE_ADDRESS: "0xdac17f958d2ee523a2206206994597c13d831ec7",

  AAVE_LENDING_POOL_CORE_ADDRESS: "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3",
  AAVE_LENDING_POOL_ADDRESS: "0x398ec7346dcd622edc5ae82352f02be94c62d119",
  COMPOUND_COMPTROLLER_ADDRESS: "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",
  AAVE_V2_LENDING_POOL_ADDRESS: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9",
  AAVE_DUMMY_REFERRAL_CODE: 0,
  FORGE_AAVE: utils.formatBytes32String("Aave"),
  MARKET_FACTORY_AAVE: utils.formatBytes32String("Aave"),
  FORGE_AAVE_V2: utils.formatBytes32String("AaveV2"),
  MARKET_FACTORY_AAVE_V2: utils.formatBytes32String("AaveV2"),
  FORGE_COMPOUND: utils.formatBytes32String("Compound"),
  MARKET_FACTORY_COMPOUND: utils.formatBytes32String("Compound"),
  ZERO_BYTES: utils.formatBytes32String(""),
  RANDOM_BYTES: utils.formatBytes32String("ZpTw6Y3Ft4ruk7pmwTJF"),
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  ETH_ADDRESS: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  MAX_ALLOWANCE: BN.from(2).pow(256).sub(1),
  ONE_DAY: BN.from(86400),
  ONE_WEEK: BN.from(86400 * 7),
  FIFTEEN_DAY: BN.from(86400 * 15),
  ONE_MONTH: BN.from(2592000),
  THREE_MONTH: BN.from(2592000 * 3),
  FIVE_MONTH: BN.from(2592000 * 5),
  SIX_MONTH: BN.from(2592000 * 6),
  ONE_YEAR: BN.from(31536000),
  T0: BN.from(4000000000), // start time of all contracts
  T0_A2: BN.from(4000000050), // the time that the first AaveV2_XYT is minted
  T0_C: BN.from(4000000100), // the time that the first Compound_XYT is minted
  HIGH_GAS_OVERRIDE: { gasLimit: 40000000 },
  INITIAL_AAVE_USDT_AMOUNT: BN.from(10 ** 5),
  INITIAL_COMPOUND_USDT_AMOUNT: BN.from(10 ** 7),
  INITIAL_AAVE_TOKEN_AMOUNT: BN.from(10 ** 4),
  INITIAL_COMPOUND_TOKEN_AMOUNT: BN.from(10 ** 6),
  INITIAL_OT_XYT_AMOUNT: BN.from(10 ** 4),
  TEST_TOKEN_DELTA: BN.from(10).pow(2),
  TEST_LP_DELTA: BN.from(10).pow(11),
  LOCK_NUMERATOR: BN.from(1),
  LOCK_DENOMINATOR: BN.from(180),

  // Pendle token distribution
  INVESTOR_AMOUNT: BN.from(34102839).mul(ONE_E_18),
  ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
  TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
  TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(91602839).mul(ONE_E_18),
  ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(50 * 1000000).mul(ONE_E_18),
  PUBLIC_SALES_TOKEN_AMOUNT: BN.from(15897161).mul(ONE_E_18),
  INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
  CONFIG_DENOMINATOR: BN.from(72000000000),
  CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
  PENDLE_START_TIME: BN.from(4000000000),
  INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
  ONE_QUARTER: BN.from(7884000),
};

// export function setT0(time: BN) {
//   consts.T0 = time;
// }

export const tokens: TokenMap = {
  USDT: {
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimal: 6,
    compound: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
  },
  WETH: {
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    decimal: 18,
    compound: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  },
  USDC: {
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimal: 6,
    compound: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  },
};
