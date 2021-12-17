import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN, utils } from 'ethers';
import { AvaxConsts, CommonConstsType, EthConsts, PendleConstsType } from '@pendle/constants';

const ONE_E_12 = BN.from(10).pow(12);
const ONE_E_18 = BN.from(10).pow(18);

export function getLocalCommonConsts(deployer: SignerWithAddress, CommonConsts: CommonConstsType): CommonConstsType {
  return {
    ...CommonConsts,
    GOVERNANCE_MULTISIG: deployer.address,
    TEAM_TOKENS_MULTISIG: deployer.address,
    ECOSYSTEM_FUND_MULTISIG: deployer.address,
    SALES_MULTISIG: deployer.address,
    LIQUIDITY_INCENTIVES_MULTISIG: deployer.address,
    FORGE_EMERGENCY_HANDLER: deployer.address,
    MARKET_EMERGENCY_HANDLER: deployer.address,
    LIQ_MINING_EMERGENCY_HANDLER: deployer.address,
    TREASURY_MULTISIG: deployer.address,
    FORGE_FEE: BN.from(0),
    SWAP_FEE: BN.from(0),
    PROTOCOL_SWAP_FEE: BN.from(0),
    EXPIRY_DIVISOR: BN.from(10),
    CURVE_SHIFT_DELTA: BN.from(0),
    LIQ_MINING_VESTING_EPOCHS: BN.from(4),
    LIQ_MINING_EPOCH_DURATION: BN.from(3600 * 24 * 10), //10 days
  };
}

export function getLocalAvaxConsts(deployer: SignerWithAddress): PendleConstsType {
  return {
    ...AvaxConsts,
    common: getLocalCommonConsts(deployer, AvaxConsts.common),
  };
}

export function getLocalEthConsts(deployer: SignerWithAddress): PendleConstsType {
  return {
    ...EthConsts,
    common: getLocalCommonConsts(deployer, EthConsts.common),
  };
}

export interface LiqParams {
  START_TIME: BN;
  EPOCH_DURATION: BN;
  REWARDS_PER_EPOCH: BN[];
  REWARDS_PER_EPOCH2: BN[][];
  NUMBER_OF_EPOCHS: BN;
  VESTING_EPOCHS: BN;
  TOTAL_NUMERATOR: BN;
  ALLOCATION_SETTING: BN[];
}

export const teConsts = {
  ONE_E_12,
  ONE_E_18,

  AAVE_DUMMY_REFERRAL_CODE: 0,
  ZERO_BYTES: utils.formatBytes32String(''),
  RANDOM_BYTES: utils.formatBytes32String('ZpTw6Y3Ft4ruk7pmwTJF'),
  DEFAULT_CHAIN_ID: 31337,
  T0_A2: BN.from(1653715050),
  T0_C: BN.from(1653715100),
  T0_C2: BN.from(1653715150),
  T0_SC: BN.from(1653715200),
  T0_SS: BN.from(1653715250),
  T0_UNI: BN.from(1653715300),
  T0_K: BN.from(1653715400),
  T0_B: BN.from(1653715400),
  T0_TJ: BN.from(1653715450),
  T0_XJ: BN.from(1653715500),
  T0_WM: BN.from(1653715550),
  INITIAL_BENQI_DAI_AMOUNT: BN.from(5 * 10 ** 3),
  INITIAL_xJOE_AMOUNT: BN.from(5 * 10 ** 4),
  INITIAL_JOE_TOKEN_AMOUNT: BN.from('161405309761232190531'),
  INITIAL_wMEMO_TOKEN_AMOUNT: BN.from('603373055070188660'),
  HG: { gasLimit: 80000000 },
  LG: { gasLimit: 200000 },
  INITIAL_AAVE_USDT_AMOUNT: BN.from(10 ** 5),
  INITIAL_COMPOUND_USDT_AMOUNT: BN.from(10 ** 7),
  INITIAL_AAVE_TOKEN_AMOUNT: BN.from(10 ** 4),
  INITIAL_COMPOUND_TOKEN_AMOUNT: BN.from(10 ** 6),
  INITIAL_SUSHI_TOKEN_AMOUNT: BN.from('171489293677797333'),
  INITIAL_KYBER_TOKEN_AMOUNT: BN.from(10 ** 7),
  INITIAL_OT_XYT_AMOUNT: BN.from(10 ** 4),
  TEST_TOKEN_DELTA: BN.from(200),

  // Pendle token distribution
  INVESTOR_AMOUNT: BN.from(37417125).mul(ONE_E_18),
  ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
  TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
  TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
  ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 1000000).mul(ONE_E_18),
  PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
  INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
  CONFIG_DENOMINATOR: BN.from(72000000000),
  CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
  PENDLE_START_TIME: BN.from(4000000000),
  INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
  ONE_QUARTER: BN.from(7884000),
};

// TOTAL_DURATION = 10 days * 20 = 200 days
export const liqParams: LiqParams = {
  START_TIME: teConsts.T0_K.add(1000), // starts in 1000s
  EPOCH_DURATION: BN.from(3600 * 24 * 10), //10 days
  REWARDS_PER_EPOCH: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  ].map((a) => BN.from('10000000000').mul(a)), // = [10000000000, 20000000000, ..]
  REWARDS_PER_EPOCH2: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
  ].map((a) => [BN.from('10000000000').mul(a), BN.from(0)]),
  NUMBER_OF_EPOCHS: BN.from(30),
  VESTING_EPOCHS: BN.from(4),
  TOTAL_NUMERATOR: BN.from(10 ** 9),
  ALLOCATION_SETTING: [
    1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 3, 4, 4, 4, 4, 4, 4, 4, 4, 1, 1, 2, 3, 1, 2, 3, 4, 10, 11, 1, 2, 3, 1, 1, 1, 1,
  ].map((a) => BN.from(10 ** 9).div(a)),
};
