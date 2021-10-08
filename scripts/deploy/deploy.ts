import hre from 'hardhat';
import fs from 'fs';
import path from 'path';

import {
  devConstants,
  kovanConstants,
  mainnetConstants,
  goerliConstants,
  polygonConstants,
} from '../helpers/constants';

import { deploy, Deployment, getDeployment } from '../helpers/deployHelpers';

import { beforeAll } from './beforeAll';
import { step0 } from './step0';
import { step1 } from './step1';
import { step2 } from './step2';
import { step3 } from './step3';
import { step4 } from './step4';
import { step5 } from './step5';
import { step6 } from './step6';
import { step7 } from './step7';
import { step8 } from './step8';
import { step9 } from './step9';
import { step10 } from './step10';
import { step11 } from './step11';
import { step12 } from './step12';
import { step13 } from './step13';
import { step14 } from './step14';
import { step15 } from './step15';
import { step16 } from './step16';
import { step17 } from './step17';
const NUMBER_OF_STEPS = 17;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let deployment: Deployment;
  let consts: any;

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (network == 'kovan' || network == 'kovantest') {
    consts = kovanConstants;
  } else if (network == 'goerli') {
    consts = goerliConstants;
  } else if (network == 'mainnet') {
    consts = mainnetConstants;
  } else if (network == 'polygon') {
    consts = polygonConstants;
  } else {
    if (process.env.ISPOLYGON) {
      console.log('Dev network forking polygon');
      consts = polygonConstants;
    } else {
      consts = devConstants;
    }
  }

  if (fs.existsSync(filePath)) {
    // const
    deployment = getDeployment(filePath);
    console.log(`\tThere is an existing deployment`);
  } else {
    console.log(`\tNo existing deployment file`);
    deployment = {
      step: -1,
      contracts: {},
      variables: {},
      yieldContracts: {},
      liquidityMiningV2Contracts: [],
      directories: [],
    };
  }
  if (process.env.RESET == 'true') {
    console.log(`\tRESETing, deploying a brand new instance of contracts`);
    deployment.step = -1;
  }

  const lastStep = process.env.LAST_STEP != null ? parseInt!(process.env.LAST_STEP) : NUMBER_OF_STEPS;
  console.log(`======= Deploying from step ${deployment.step} to step ${lastStep}`);

  console.log(`\nSetting Environment Variables`);
  await beforeAll(deployer, hre, deployment, consts);
  for (let step = deployment.step + 1; step <= lastStep; step++) {
    switch (step) {
      case 0: {
        if (network == 'polygon' || process.env.ISPOLYGON) {
          console.log(`\nSkipping step ${step} because the network is Polygon.`);
          break;
        }
        console.log(`\n[Step ${step}]: Deploying PendleTeamTokens & PendleEcosystemFund's contracts`);
        await step0(deployer, hre, deployment, consts);
        break;
      }
      case 1: {
        console.log(`\n[Step ${step}]: Deploying PENDLE`);
        await step1(deployer, hre, deployment, consts);
        break;
      }
      case 2: {
        console.log(
          `\n[Step ${step}]: Deploying GovernanceManagerMain, GovernanceManagerLiqMining, PausingManagerMain, PausingManagerLiqMining`
        );
        await step2(deployer, hre, deployment, consts);
        break;
      }
      case 3: {
        console.log(`\n[Step ${step}]: Deploying PendleData`);
        await step3(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 4: {
        console.log(`\n[Step ${step}]: Deploying PendleMarketReader`);
        await step4(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 5: {
        console.log(`\n[Step ${step}]: Deploying PendleRouter`);
        await step5(deployer, hre, deployment, consts);
        break;
      } // DONE
      case 6: {
        console.log(`\n[Step ${step}]: Initialise PendleData`);
        await step6(deployer, hre, deployment, consts);
        break;
      } // DONE
      case 7: {
        console.log(`\n[Step ${step}]: Deploying PendleRedeemProxy & PendleWhitelist`);
        await step7(deployer, hre, deployment, consts);
        break;
      } // DONE
      case 8: {
        if (network == 'polygon' || process.env.ISPOLYGON) {
          console.log(`\nSkipping step ${step} because the network is Polygon.`);
          break;
        }
        console.log(
          `\n[Step ${step}]: Deploying PendleCompoundForge, cRewardManager (+init), cYieldContractDeployer (+init) & PendleCompoundMarketFactory`
        );
        await step8(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 9: {
        console.log(
          `\n[Step ${step}]: Deploying PendleAaveV2Forge, a2RewardManager (+init), a2YieldContractDeployer (+init) & PendleAaveMarketFactory`
        );
        await step9(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 10: {
        console.log(`\n[Step ${step}]: Set up params in PendleData`);
        await step10(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 11: {
        console.log(`\n[Step ${step}]: Add forges and market factories`);
        await step11(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 12: {
        console.log(`\n[Step ${step}]: Transfer governance to governance multisig`);
        await step12(deployer, hre, deployment, consts);
        break;
      } //DONE
      case 13: {
        console.log(
          `\n[Step ${step}]: Deploying PendleSushiswapSimpleForge, sushiswapSimpleRewardManager (+init), sushiswapSimpleYieldContractDeployer (+init)`
        );
        await step13(deployer, hre, deployment, consts);
        break;
      }
      case 14: {
        console.log(
          `\n[Step ${step}]: Deploying PendleSushiswapComplexForge, sushiswapComplexRewardManager (+init), sushiswapComplexYieldContractDeployer (+init)`
        );
        await step14(deployer, hre, deployment, consts);
        break;
      }
      case 15: {
        if (network == 'polygon' || process.env.ISPOLYGON) {
          console.log(`\nSkipping step ${step} because the network is Polygon.`);
          break;
        }
        console.log(
          `\n[Step ${step}]: Deploying PendleCompoundV2Forge, compoundV2RewardManager (+init), compoundV2YieldContractDeployer (+init)`
        );
        await step15(deployer, hre, deployment, consts);
        break;
      }
      case 16: {
        console.log(`\n[Step ${step}]: Deploying PendleGenericMarketFactory`);
        await step16(deployer, hre, deployment, consts);
        break;
      }
      case 17: {
        console.log(
          `\n[Step ${step}]: Add forges and market factories for sushiswap simple, sushiswap complex and compoundV2`
        );
        await step17(deployer, hre, deployment, consts);
        break;
      }
      // case 999: {
      //   console.log(`\n[Step ${step}]: Adding PendleCompoundForge + PendleCompoundMarketFactory`);
      //   await step9(deployer, hre, deployment, consts);
      //   break;
      // }

      default: {
        break;
      }
    }
    deployment.step = step;
    console.log(`\tsaving updated deployment data`);
    fs.writeFileSync(filePath, JSON.stringify(deployment, null, '  '), 'utf8');
    console.log(`[Step ${step} - Done]: saved updated deployment data for step ${step}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
