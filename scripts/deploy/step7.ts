import { Deployment, validAddress, deploy, isNotAvax } from '../helpers/deployHelpers';

export async function step7(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;
  const governanceManagerLiqMining = deployment.contracts.PendleGovernanceManagerLiqMining.address;

  if (!validAddress('pendleRouterAddress', pendleRouterAddress)) process.exit(1);
  if (!validAddress('governanceManagerLiqMining', governanceManagerLiqMining)) process.exit(1);

  console.log(`\t\t pendleRouterAddress used = ${pendleRouterAddress}`);
  console.log(`\t\t governanceManagerLiqMining used = ${governanceManagerLiqMining}`);
  // if (isNotAvax(hre)) {
  //   await deploy(hre, deployment, 'PendleRedeemProxyEth', [pendleRouterAddress]);
  // } else {
  //   await deploy(hre, deployment, 'PendleRedeemProxyAvax', [pendleRouterAddress]);
  // }
  if (!isNotAvax(hre)) {
    await deploy(hre, deployment, 'PendleWrapper', [
      {
        pendleRouter: pendleRouterAddress,
        aaveLendingPool: consts.common.ZERO_ADDRESS,
        uniRouter: consts.misc.JOE_ROUTER_ADDRESS,
        sushiRouter: consts.misc.JOE_ROUTER_ADDRESS,
        kyberRouter: consts.misc.KYBER_ROUTER,
        weth: consts.tokens.WETH.address,
        codeHashUni: consts.misc.CODE_HASH_TRADER_JOE,
        codeHashSushi: consts.misc.CODE_HASH_TRADER_JOE,
      },
    ]);
  }

  await deploy(hre, deployment, 'PendleWhitelist', [governanceManagerLiqMining]);
}
