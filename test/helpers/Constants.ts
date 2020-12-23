import { BigNumber, utils } from "ethers";

export type Token = {
  address: string;
  decimal: number;
  owner?: string;
};

type TokenMap = Record<string, Token>;

export const constants = {
  DUMMY_GOVERNANCE_ADDRESS: "0xdac17f958d2ee523a2206206994597c13d831ec7",

  AAVE_LENDING_POOL_CORE_ADDRESS: "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3",
  AAVE_LENDING_POOL_ADDRESS: "0x398ec7346dcd622edc5ae82352f02be94c62d119",
  AAVE_DUMMY_REFERRAL_CODE: 0,
  FORGE_AAVE: utils.formatBytes32String("Aave"),
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
  MAX_ALLOWANCE: BigNumber.from(2)
    .pow(BigNumber.from(256))
    .sub(BigNumber.from(1)),
  ONE_DAY: BigNumber.from(86400),
  ONE_MOUNTH: BigNumber.from(2592000),
  TEST_EXPIRY: BigNumber.from(Math.round(Date.now() / 1000)).add(2592000 * 6),
  ONE_YEAR: BigNumber.from(31536000),
  HIGH_GAS_OVERRIDE: { gasLimit: 40000000 },
};

export const tokens: TokenMap = {
  USDT: {
    address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    decimal: 6,
    owner: "0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828",
  },
  WETH: {
    address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    decimal: 18,
  },
  USDC: {
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimal: 6,
  },
};
