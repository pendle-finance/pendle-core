import { BigNumber as BN, utils } from 'ethers';
const ONE_E_18 = BN.from(10).pow(18);
const ONE_DAY = BN.from(86400);
const RONE = BN.from(2).pow(40);
const LIQ_MINING_ALLOCATION_DENOMINATOR = 1000000000;

export const common = {
  ONE_E_18,
  FORGE_AAVE_V2: utils.formatBytes32String('AaveV2'),
  MARKET_FACTORY_AAVE: utils.formatBytes32String('Aave'),
  FORGE_COMPOUND: utils.formatBytes32String('CompoundV2'),
  MARKET_FACTORY_COMPOUND: utils.formatBytes32String('Compound'),
  FORGE_SUSHISWAP_SIMPLE: utils.formatBytes32String('SushiswapSimple'),
  FORGE_SUSHISWAP_COMPLEX: utils.formatBytes32String('SushiswapComplex'),
  FORGE_COMPOUNDV2: utils.formatBytes32String('CompoundV2Upgraded'),
  MARKET_FACTORY_GENERIC: utils.formatBytes32String('Generic'),
  CODE_HASH_SUSHISWAP: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
  CODE_HASH_UNISWAP: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
  ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
  MAX_ALLOWANCE: BN.from(2).pow(BN.from(256)).sub(BN.from(1)),
  ONE_DAY,
  // TEST_EXPIRY: 1624147200,
  LIQ_MINING_ALLOCATION_DENOMINATOR,
  HIGH_GAS_OVERRIDE: { gasLimit: 80000000 },
  liqParams: {
    EPOCH_DURATION: ONE_DAY.mul(7),
    VESTING_EPOCHS: 5,
    ALLOCATIONS: [LIQ_MINING_ALLOCATION_DENOMINATOR],
    REWARDS_PER_EPOCH: [], // TO BE OVERRIDED in script
    EXPIRIES: [], // TO BE OVERRIDED in script
    START_TIME: 0, // TO BE OVERRIDED in script
  },

  // Protocol params;
  LOCK_NUMERATOR: BN.from(1),
  LOCK_DENOMINATOR: BN.from(20),
  INTEREST_UPDATE_RATE_DELTA_FOR_MARKET: BN.from(2).pow(40).mul(334184).div(1e10), // 0.00334184 %
  EXPIRY_DIVISOR: ONE_DAY.mul(7),
  B_DELTA: BN.from(6595),
  // Fee
  FORGE_FEE: RONE.mul(3).div(100), // 3% forge fee
  SWAP_FEE: RONE.mul(35).div(10000), // 0.35%
  PROTOCOL_SWAP_FEE: RONE.div(7), // 1/7 * 0.35% = 0.05%
};

export const devConstants = {
  common,
  misc: {
    AAVE_LENDING_POOL_CORE_ADDRESS: '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3',
    AAVE_LENDING_POOL_ADDRESS: '0x398ec7346dcd622edc5ae82352f02be94c62d119',
    COMPOUND_COMPTROLLER_ADDRESS: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b',
    AAVE_V2_LENDING_POOL_ADDRESS: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(36959981).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 10 ** 6).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    // OT rewards
    STKAAVE_ADDRESS: '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
    COMP_ADDRESS: '0xc00e94cb662c3520282e6f5717214004a7f26888',
    AAVE_INCENTIVES_CONTROLLER: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
    SUSHI_ADDRESS: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    MASTER_CHEF: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd',

    SUSHISWAP_PAIR_FACTORY: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  },
  tokens: {
    USDT_AAVE: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    },
    USDT_COMPOUND: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    },
    WETH: {
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      decimal: 18,
      compound: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimal: 6,
      compound: '0x39aa39c021dfbae8fac545936693ac917d5e7563',
    },
    AUSDC: {
      address: '0xbcca60bb61934080951369a648fb03df4f96263c',
    },
    CDAI: {
      address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
    },
    DAI: {
      address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    },
    AUSDT: {
      address: '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
      decimal: 6,
      owner: '0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402',
    },
  },
};

export const kovanConstants = {
  common,
  misc: {
    ONE_E_18,
    AAVE_LENDING_POOL_CORE_ADDRESS: '0x95D1189Ed88B380E319dF73fF00E479fcc4CFa45',
    AAVE_LENDING_POOL_ADDRESS: '0x580D4Fdc4BF8f9b5ae2fb9225D584fED4AD5375c',
    AAVE_V2_LENDING_POOL_ADDRESS: '0xE0fBa4Fc209b4948668006B2bE61711b7f465bAe',
    COMPOUND_COMPTROLLER_ADDRESS: '0x5eae89dc1c671724a672ff0630122ee834098657',
    LOCK_NUMERATOR: BN.from(1),
    LOCK_DENOMINATOR: BN.from(20),

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(37417125).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 10 ** 6).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    LIQ_MINING_ALLOCATION_DENOMINATOR: 1000000000,
    INTEREST_UPDATE_RATE_DELTA_FOR_MARKET: BN.from(2).pow(40).mul(277754).div(1e9),

    // OT rewards
    STKAAVE_ADDRESS: '0xa1c74a9a3e59ffe9bee7b85cd6e91c0751289ebd', //WETH for kovan
    COMP_ADDRESS: '0xa1c74a9a3e59ffe9bee7b85cd6e91c0751289ebd', //WETH for kovan
    AAVE_INCENTIVES_CONTROLLER: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
    SUSHI_ADDRESS: '0x83e68b8E4CFA4d43A52d22709A626C0425036928', // Pendle clone of Sushiswap
    MASTER_CHEF: '0x0780E33CD04e33A4960b14DC332e69C5fb6b3C90', // Pendle clone of Sushiswap

    SUSHISWAP_PAIR_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
    // Fee
    FORGE_FEE: RONE.mul(3).div(100), // 3% forge fee
    SWAP_FEE: RONE.mul(35).div(10000), // 0.35%
    PROTOCOL_SWAP_FEE: RONE.div(7), // 1/7 * 0.35% = 0.05%
  },
  tokens: {
    USDT_AAVE: {
      address: '0x13512979ade267ab5100878e2e0f485b568328a4',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0x3f0a0ea2f86bae6362cf9799b523ba06647da018',
    },
    USDT_COMPOUND: {
      address: '0x07de306ff27a2b630b1141956844eb1552b956b5',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0x3f0a0ea2f86bae6362cf9799b523ba06647da018',
    },
    WETH: {
      address: '0xa1c74a9a3e59ffe9bee7b85cd6e91c0751289ebd',
      decimal: 18,
      compound: '0x41B5844f4680a8C38fBb695b7F9CFd1F64474a72',
    },
    USDC: {
      address: '0xe22da380ee6b445bb8273c81944adeb6e8450422',
      decimal: 6,
      compound: '0x4a92e71227d294f041bd82dd8f78591b75140d63',
    },
    AUSDT: {
      address: '0xff3c8bc103682fa918c954e84f5056ab4dd5189d',
      decimal: 6,
      // owner: "0x81dfbbaF5011e3b86383f72A24793EE44ea547C5"
    },
    DAI: {
      address: '0x4f96fe3b7a6cf9725f59d353f723c1bdb64ca6aa',
      decimals: 8,
      compound: '0xf0d0eb522cfa50b716b3b1604c4f0fa6f04376ad',
    },
  },
};

export const goerliConstants = {
  common,
  misc: {
    ONE_E_18,
    ZERO_ADDRESS: '0x0000000000000000000000000000000000000000',
    MAX_ALLOWANCE: BN.from(2).pow(BN.from(256)).sub(BN.from(1)),

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(37417125).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 10 ** 6).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),
  },
  tokens: {},
};

export const polygonConstants = {
  common,
  misc: {
    AAVE_V2_LENDING_POOL_ADDRESS: '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf', //checked *2

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(37417125).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 10 ** 6).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    // OT rewards
    STKAAVE_ADDRESS: '0xd6df932a45c0f255f85145f286ea0b292b21c90b', // Aave address
    AAVE_INCENTIVES_CONTROLLER: '0x357D51124f59836DeD84c8a1730D72B749d8BC23', //checked
    SUSHI_ADDRESS: '0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a',
    MASTER_CHEF: '0x0769fd68dfb93167989c6f7254cd0d766fb2841f',

    SUSHISWAP_PAIR_FACTORY: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
  },
  tokens: {
    USDT_AAVE: {
      // USDT
      address: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
      decimal: 6,
      owner: '0xf6422b997c7f54d1c6a6e103bcb1499eea0a7046',
    },
    WETH: {
      // must check
      address: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // checked * 2
      decimal: 18,
    },
    USDC: {
      address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // checked * 2
      decimal: 6,
    },
    AUSDC: {
      address: '0x1a13f4ca1d028320a707d99520abfefca3998b7f',
    },
    WETHUSDC_SLP: {
      address: '0x34965ba0ac2451A34a0471F04CCa3F990b8dea27',
    },
    // AUSDT: {
    //   address: '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
    //   decimal: 6,
    //   owner: '0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402',
    // },
  },
};

export const mainnetConstants = {
  common,
  misc: {
    // AAVE_LENDING_POOL_CORE_ADDRESS: '0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3',
    // AAVE_LENDING_POOL_ADDRESS: '0x398ec7346dcd622edc5ae82352f02be94c62d119',
    COMPOUND_COMPTROLLER_ADDRESS: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b', //checked *2
    AAVE_V2_LENDING_POOL_ADDRESS: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', //checked *2

    // Pendle token distribution
    INVESTOR_AMOUNT: BN.from(37417125).mul(ONE_E_18),
    ADVISOR_AMOUNT: BN.from(2500000).mul(ONE_E_18),
    TEAM_AMOUNT: BN.from(55000000).mul(ONE_E_18),
    TEAM_INVESTOR_ADVISOR_AMOUNT: BN.from(94917125).mul(ONE_E_18),
    ECOSYSTEM_FUND_TOKEN_AMOUNT: BN.from(46 * 10 ** 6).mul(ONE_E_18),
    PUBLIC_SALES_TOKEN_AMOUNT: BN.from(16582875).mul(ONE_E_18),
    INITIAL_LIQUIDITY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    CONFIG_DENOMINATOR: BN.from(72000000000),
    CONFIG_CHANGES_TIME_LOCK: BN.from(7 * 24 * 3600),
    PENDLE_START_TIME: BN.from(4000000000),
    INITIAL_WEEKLY_EMISSION: BN.from(1200000).mul(ONE_E_18),
    ONE_QUARTER: BN.from(7884000),

    // OT rewards
    STKAAVE_ADDRESS: '0x4da27a545c0c5b758a6ba100e3a049001de870f5', // checked * 2
    COMP_ADDRESS: '0xc00e94cb662c3520282e6f5717214004a7f26888', // checked * 2
    AAVE_INCENTIVES_CONTROLLER: '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5', //checked * 2
    SUSHI_ADDRESS: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2',
    MASTER_CHEF: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd',

    SUSHISWAP_PAIR_FACTORY: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  },
  tokens: {
    USDT_AAVE: {
      // USDT
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    },
    USDT_COMPOUND: {
      // USDT
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimal: 6,
      owner: '0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828',
      compound: '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9',
    },
    WETH: {
      // must check
      address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // checked * 2
      decimal: 18,
      compound: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5', // cEther - checked * 2
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // checked * 2
      decimal: 6,
      compound: '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC - checked * 2
    },
    // AUSDT: {
    //   address: '0x71fc860F7D3A592A4a98740e39dB31d25db65ae8',
    //   decimal: 6,
    //   owner: '0x4188a7dca2757ebc7d9a5bd39134a15b9f3c6402',
    // },
  },
};
