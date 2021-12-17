import { assert } from 'hardhat';
import { deployOrFetchContract } from '../helpers';
import { DeployOrFetch, isEth, PendleEnv } from '../type';
import { PendleWrapper } from '../../typechain-types';

export async function deployPendleWrapper(env: PendleEnv, runMode: DeployOrFetch) {
  if (isEth(env.network)) {
    assert(false, 'Cannot deploy Wrapper on ETH');
  } else {
    env.pendleWrapper = (await deployOrFetchContract(env, runMode, 'PendleWrapper', 'PendleWrapper', [
      {
        pendleRouter: env.pendleRouter.address,
        joeRouter: env.consts.joe!.ROUTER,
        joeBar: env.tokens.XJOE!.address,
        weth: env.tokens.WNATIVE.address,
        wMEMO: env.tokens.wMEMO!.address,
        timeStaking: env.consts.wonderland!.TIME_STAKING,
        codeHashJoe: env.consts.joe!.CODE_HASH,
      },
    ])) as PendleWrapper;
  }
}

export function getListOfTokensToApprove(env: PendleEnv) {
  let consts = env.consts;
  let tokens = env.tokens;

  let marketQiUSDC = '0x7552f903E33DB53A86167C1E74f0e082bD0740D5';
  let liqQiUSDC = '0x2489a32844556193fB296c22597BdC158e9762a0';
  let marketQiAVAX = '0x80aae49b1142E2F135033829a1B647b1636c1506';
  let liqQiAvax = '0x47a3E9D5c87651D4074Ef67a160AfDb3F42cB242';
  let marketPendleAvax = '0xd5736Ba0be93C99a10e2264e8e4EBd54633306f8';
  let liqPendleAvax = '0x204e698A71bb1973823517C74bE041a985EAA46e';
  let marketXJoe = '0x3E2737eB1b513Bcee93a2144204D22695B272215';
  let liqXJOE = '0xa3e0Ca7E35F47f6547c0C2d8f005312c2188E70F';

  const OTLPqiUSDC: string = '0x82db765c214c1aab16672058a3c22b12f6a42cd0';
  const OTLPqiAVAX: string = '0x5f973e06a59d0bafe464faf36d5b3b06e075c543';
  const OTLPxJOE: string = '0xD1f377b881010cb97Ab0890a5Ef908c45bCf13F9';
  const OTLPPENDLE_AVAX: string = '0x82922e6fBe83547c5E2E0229815942A2108e4624';
  let OTLM_qiUSDC = '0x224D395e9e123Bc9C37BfF8bCd845562d5232713';
  let OTLM_qiAVAX = '0xfe60eEC35E3C4Aad1e69f10957Ad0A7D3CFc6CEA';
  let OTLM_PENDLE_AVAX = '0xb3c6772F341ad234fa41f8C4F981cf4489dfa6E9';
  let OTLM_xJOE = '0xD0788Af7a613b81F437a51b96594A6387c7329b1';
  let OTqiUSDC = '0xfffe5fC3E511cE11dF20684AEC435A3E2b7D8136';
  let OTqiAVAX = '0xECC5748b1fF6b23f284EC81E8bf034409961d8Dc';
  let OTPENDLE_AVAX = '0xABCED2A62FD308BD1B98085c13DF74B685140C0b';
  let OTxJoe = '0x7D1e8650aBD5f8363D63Dc7AB838ceC8c726Dd38';
  let pendleRouter = env.pendleRouter.address;
  let res: {
    token: string;
    to: string;
  }[] = [
    { token: tokens.JOE!.address!, to: tokens.XJOE!.address },
    { token: tokens.PENDLE!.address, to: consts.joe!.ROUTER },
    { token: tokens.WNATIVE!.address, to: consts.joe!.ROUTER },
    { token: tokens.USDC!.address, to: consts.joe!.ROUTER },
    { token: tokens.USDC!.address, to: tokens.USDC!.benqi! },
    { token: tokens.XJOE!.address!, to: pendleRouter },
    { token: tokens.PENDLE!.address, to: pendleRouter },
    { token: tokens.USDC!.address, to: pendleRouter },
    { token: tokens.USDC!.benqi!, to: pendleRouter },
    { token: tokens.NATIVE!.benqi!, to: pendleRouter },
    { token: tokens.JOE_PENDLE_AVAX!.address!, to: pendleRouter },
    { token: tokens.JOE_USDC_AVAX!.address!, to: pendleRouter },
    { token: tokens.NATIVE.benqi!, to: pendleRouter },
    { token: marketQiUSDC, to: liqQiUSDC },
    { token: marketQiAVAX, to: liqQiAvax },
    { token: marketPendleAvax, to: liqPendleAvax },
    { token: marketXJoe, to: liqXJOE },
    { token: OTLPqiUSDC, to: OTLM_qiUSDC },
    { token: OTLPqiAVAX, to: OTLM_qiAVAX },
    { token: OTLPPENDLE_AVAX, to: OTLM_PENDLE_AVAX },
    { token: OTLPxJOE, to: OTLM_xJOE },
    { token: OTqiUSDC, to: OTLPqiUSDC },
    { token: OTqiAVAX, to: OTLPqiAVAX },
    { token: OTPENDLE_AVAX, to: OTLPPENDLE_AVAX },
    { token: OTxJoe, to: OTLPxJOE },
    { token: OTLPxJOE, to: env.consts.joe!.ROUTER },
    { token: OTqiUSDC, to: env.consts.joe!.ROUTER },
    { token: OTqiAVAX, to: env.consts.joe!.ROUTER },
    { token: OTPENDLE_AVAX, to: env.consts.joe!.ROUTER },
    { token: OTxJoe, to: env.consts.joe!.ROUTER },
  ];
  return res;
}
