const hre = require("hardhat");
import fs from "fs";
import path from "path";

import {
  devConstants,
  kovanConstants,
  Deployment,
  DeployedContract,
  createNewYieldContractAndMarket,
  getContractFromDeployment,
} from "../helpers/deployHelpers";
import { beforeAll } from "./beforeAll";
import { step0 } from "./step0";
import { step1 } from "./step1";
import { step2 } from "./step2";
import { step3 } from "./step3";
import { step4 } from "./step4";
import { step5 } from "./step5";
import { step6 } from "./step6";
import { step7 } from "./step7";
import { step8 } from "./step8";
import { step9 } from "./step9";
const NUMBER_OF_STEPS = 9;

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const filePath = path.resolve(__dirname, `../../deployments/${network}.json`);
  let deployment: Deployment;
  let consts: any;

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}`);
  console.log(`\tDeployment's filePath = ${filePath}`);

  if (network == "kovan" || network == "kovantest") {
    consts = kovanConstants;
  } else {
    consts = devConstants;
  }

  if (fs.existsSync(filePath)) {
    // const
    const existingDeploymentJson = JSON.parse(
      fs.readFileSync(filePath, "utf8")
    );
    deployment = existingDeploymentJson as Deployment;

    console.log(`\tThere is an existing deployment`);
  } else {
    console.log(`\tNo existing deployment file`);
    deployment = {
      step: -1,
      contracts: {},
      variables: {},
      yieldContracts: {},
    };
  }
  if (process.env.RESET == "true") {
    console.log(`\tRESETing, deploying a brand new instance of contracts`);
    deployment.step = -1;
  }

  const lastStep =
    process.env.LAST_STEP != null
      ? parseInt!(process.env.LAST_STEP)
      : NUMBER_OF_STEPS;
  console.log(
    `======= Deploying from step ${deployment.step} to step ${lastStep}`
  );

  console.log(`\nSetting Environment Variables`);
  await beforeAll(deployer, hre, deployment, consts);
  for (let step = deployment.step + 1; step <= lastStep; step++) {
    switch (step) {
      case 0: {
        console.log(
          `\n[Step ${step}]: Deploying PendleTeamTokens & PendleEcosystemFund's contracts`
        );
        await step0(deployer, hre, deployment, consts);
        break;
      }
      case 1: {
        console.log(`\n[Step ${step}]: Deploying PENDLE`);
        await step1(deployer, hre, deployment, consts);
        break;
      }
      case 2: {
        console.log(`\n[Step ${step}]: Deploying PendleData`);
        await step2(deployer, hre, deployment, consts);
        break;
      }
      case 3: {
        console.log(`\n[Step ${step}]: Deploying PendleMarketReader`);
        await step3(deployer, hre, deployment, consts);
        break;
      }
      case 4: {
        console.log(`\n[Step ${step}]: Deploying PendleRouter`);
        await step4(deployer, hre, deployment, consts);
        break;
      }
      case 5: {
        console.log(`\n[Step ${step}]: Initializing PendleData`);
        await step5(deployer, hre, deployment, consts);
        break;
      }
      case 6: {
        console.log(`\n[Step ${step}]: Initializing PendleRouter`);
        await step6(deployer, hre, deployment, consts);
        break;
      }
      case 7: {
        console.log(
          `\n[Step ${step}]: Deploying PendleAaveForge & PendleAaveMarketFactory`
        );
        await step7(deployer, hre, deployment, consts);
        break;
      }
      case 8: {
        console.log(
          `\n[Step ${step}]: Deploying PendleCompoundForge & PendleCompoundMarketFactory`
        );
        await step8(deployer, hre, deployment, consts);
        break;
      }
      case 9: {
        console.log(`\n[Step ${step}]: Deploying PendleAaveV2Forge`);
        await step9(deployer, hre, deployment, consts);
        break;
      }
      default: {
        break;
      }
    }
    deployment.step = step;
    console.log(`\tsaving updated deployment data`);
    fs.writeFileSync(filePath, JSON.stringify(deployment, null, "  "), "utf8");
    console.log(
      `[Step ${step} - Done]: saved updated deployment data for step ${step}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
