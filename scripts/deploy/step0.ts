import { Deployment, validAddress, deployWithName } from '../helpers/deployHelpers';
import { BigNumber as BN } from 'ethers';

export async function step0(deployer: any, hre: any, deployment: Deployment, consts: any) {
  await deployWithName(hre, deployment, 'PendleTokenDistribution', 'PendleTeamTokens', [
    deployment.variables.TEAM_TOKENS_MULTISIG,
    [
      consts.misc.ONE_QUARTER,
      consts.misc.ONE_QUARTER.mul(2),
      consts.misc.ONE_QUARTER.mul(3),
      consts.misc.ONE_QUARTER.mul(4),
      consts.misc.ONE_QUARTER.mul(5),
      consts.misc.ONE_QUARTER.mul(6),
      consts.misc.ONE_QUARTER.mul(7),
      consts.misc.ONE_QUARTER.mul(8),
    ],
    [
      consts.misc.INVESTOR_AMOUNT.div(4).add(consts.misc.ADVISOR_AMOUNT.div(4)),
      consts.misc.INVESTOR_AMOUNT.div(4).add(consts.misc.ADVISOR_AMOUNT.div(4)),
      consts.misc.INVESTOR_AMOUNT.div(4).add(consts.misc.ADVISOR_AMOUNT.div(4)),
      consts.misc.INVESTOR_AMOUNT.div(4).add(consts.misc.ADVISOR_AMOUNT.div(4)).add(consts.misc.TEAM_AMOUNT.div(2)),
      consts.misc.TEAM_AMOUNT.div(8),
      consts.misc.TEAM_AMOUNT.div(8),
      consts.misc.TEAM_AMOUNT.div(8),
      consts.common.MAX_ALLOWANCE,
    ],
  ]);

  await deployWithName(hre, deployment, 'PendleTokenDistribution', 'PendleEcosystemFund', [
    deployment.variables.ECOSYSTEM_FUND_MULTISIG,
    [BN.from(0), consts.misc.ONE_QUARTER.mul(4)],
    [consts.misc.ECOSYSTEM_FUND_TOKEN_AMOUNT.div(2), consts.common.MAX_ALLOWANCE],
  ]);
}
