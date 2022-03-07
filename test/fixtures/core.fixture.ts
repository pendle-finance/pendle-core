import { checkDisabled, Mode, TestEnv, wallets } from '.';
import {
  addGenericMarketFactoryToPendleData,
  deployGenericMarketFactory,
  deployGovernanceAndPausingManagers,
  deployMerkleDistributor,
  DeployOrFetch,
  deployPendleData,
  deployPendleMarketReader,
  deployPendleProxyAdmin,
  deployPendleRouter,
  deployPendleWhitelist,
  deployPendleWrapper,
  getContract,
  getPENDLEcontract,
  initializeConfigPendleData,
  isAvax,
  isEth,
  Network,
  PendleEnv,
  setUpEnv,
} from '../../pendle-deployment-scripts';
import { approveAll, deployContract, getEth, getLocalAvaxConsts, getLocalEthConsts } from '../helpers';
import { MiscConsts } from '@pendle/constants';

async function basicSetup(env: TestEnv) {
  env.penv = {} as PendleEnv;
  await setUpEnv(env.penv, Network.LOCAL_AVAX);
  switch (env.penv.network) {
    case Network.LOCAL_ETH:
      env.penv.consts = getLocalEthConsts(env.penv.deployer);
      break;
    case Network.LOCAL_AVAX:
      env.penv.consts = getLocalAvaxConsts(env.penv.deployer);
      break;
  }

  env.penv.tokens = env.penv.consts.tokens;
  env.pconsts = env.penv.consts;
  env.ptokens = env.pconsts.tokens;

  env.eve = wallets[4];
  env.ETH_TEST = false;

  env.USDTContract = await getContract('ERC20', env.ptokens.USDT!);
  env.DAIContract = await getContract('ERC20', env.ptokens.DAI!);
  env.WNativeContract = await getContract('ERC20', env.ptokens.WNATIVE.address);

  if (isEth(env.penv)) {
    env.sushiPool = await getContract('IUniswapV2Pair', env.ptokens.SUSHI_USDT_WETH_LP!.address);
    env.uniPool = await getContract('IUniswapV2Pair', env.ptokens.UNI_USDT_WETH_LP!.address);
    env.SUSHIContract = await getContract('IERC20', env.ptokens.SUSHI!.address);
    env.MasterchefV1 = await getContract('IMasterChef', env.pconsts.sushi!.MASTERCHEF_V1);
    env.sushiRouter = await getContract('IUniswapV2Router02', env.pconsts.sushi!.ROUTER);
    env.uniRouter = await getContract('IUniswapV2Router02', env.pconsts.uni!.ROUTER);

    await approveAll([env.USDTContract, env.WNativeContract], [env.pconsts.sushi!.ROUTER, env.pconsts.uni!.ROUTER]);
    await approveAll(
      [env.USDTContract, env.WNativeContract, env.DAIContract],
      [env.pconsts.aave!.LENDING_POOL, env.pconsts.kyber!.ROUTER]
    );
    for (let person of [MiscConsts.USDT_OWNER_ON_ETH, env.ptokens.USDC!.whale!, env.ptokens.DAI!.whale!]) {
      await getEth(person);
    }
  }

  if (isAvax(env.penv)) {
    env.xJoe = await getContract('IJoeBar', env.ptokens.XJOE!.address);
    env.JOEContract = await getContract('IERC20', env.ptokens.JOE!.address);
    env.joeMasterChefV2 = await getContract('IJoeMasterChefV2', env.pconsts.joe!.MASTERCHEF_V2);
    env.joeRouter = await getContract('IJoeRouter01', env.pconsts.joe!.ROUTER);
    env.joePool = await getContract('IUniswapV2Pair', env.ptokens.JOE_WAVAX_DAI_LP!.address);
    env.wonderlandTimeStaking = await getContract('ITimeStaking', env.pconsts.wonderland!.TIME_STAKING!);
    env.wMEMOContract = await getContract('IWMEMO', env.ptokens.wMEMO!.address);
    env.MEMOContract = await getContract('IERC20', env.ptokens.MEMO!.address);
    env.TIMEContract = await getContract('IERC20', env.ptokens.TIME!.address);

    await approveAll([env.DAIContract, env.WNativeContract], [env.pconsts.joe!.ROUTER]);
    await approveAll([env.JOEContract], [env.ptokens.XJOE!.address]);
    await approveAll(
      [env.TIMEContract, env.wMEMOContract, env.MEMOContract],
      [env.wonderlandTimeStaking, env.wMEMOContract]
    );

    for (let person of [env.ptokens.USDT!.whale!, env.ptokens.DAI!.whale!]) {
      await getEth(person);
    }
  }
}

export async function coreFixture(): Promise<TestEnv> {
  console.time('setupCoreFixutre');
  let env = {} as TestEnv;
  await basicSetup(env);

  let [alice] = wallets;

  env.treasury = await deployContract('PendleTreasury', [alice.address]);
  await deployGovernanceAndPausingManagers(env.penv, DeployOrFetch.DEPLOY);

  env.govManager = env.penv.governanceManagerMain;
  env.pausingManagerMain = env.penv.pausingManagerMain;
  env.pausingManagerLiqMining = env.penv.pausingManagerLiqMining;
  env.pausingManagerLiqMiningV2 = env.penv.pausingManagerLiqMiningV2;

  await deployPendleData(env.penv, DeployOrFetch.DEPLOY);
  env.data = env.penv.pendleData;

  await deployPendleRouter(env.penv, DeployOrFetch.DEPLOY);
  env.router = env.penv.pendleRouter;

  await initializeConfigPendleData(env.penv);

  await deployPendleMarketReader(env.penv, DeployOrFetch.DEPLOY);
  env.marketReader = env.penv.pendleMarketReader;

  if (!checkDisabled(Mode.COMPOUND)) {
    env.cMarketFactory = await deployContract('PendleCompoundMarketFactory', [
      env.router.address,
      env.pconsts.compound!.MARKET_FACTORY_ID,
    ]);
  }

  await deployGenericMarketFactory(env.penv, DeployOrFetch.DEPLOY);
  await addGenericMarketFactoryToPendleData(env.penv);

  env.genMarketFactory = env.penv.pendleGenericMarketFactory;

  await deployPendleProxyAdmin(env.penv, DeployOrFetch.DEPLOY);

  if (isAvax(env.penv)) {
    await deployPendleWrapper(env.penv, DeployOrFetch.DEPLOY);
    env.pendleWrapper = env.penv.pendleWrapper;
  }

  await getPENDLEcontract(env.penv);
  env.pendle = env.penv.PENDLE;

  await deployPendleWhitelist(env.penv, DeployOrFetch.DEPLOY);
  env.whitelist = env.penv.pendleWhitelist;

  await deployMerkleDistributor(env.penv, DeployOrFetch.DEPLOY);
  env.merkleDistributor = env.penv.merkleDistributor;

  console.timeEnd('setupCoreFixutre');
  return env;
}
