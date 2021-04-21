import { Deployment, validAddress, deploy } from "../helpers/deployHelpers";

export async function beforeAll(
  deployer: any,
  hre: any,
  deployment: Deployment,
  consts: any
) {
  const multisigNames = [
    "GOVERNANCE_MULTISIG",
    "TEAM_TOKENS_MULTISIG",
    "ECOSYSTEM_FUND_MULTISIG",
    "SALES_MULTISIG",
    "LIQUIDITY_INCENTIVES_MULTISIG",
  ];

  if (!["kovan", "mainnet"].includes(hre.network.name)) {
    console.log(
      `[NOTICE] its not mainnet or kovan, so we are using deployer account ${deployer.address} as the multisigs`
    );
    for (const multisig of multisigNames) {
      process.env[multisig] = deployer.address;
    }
  }

  let valid = true;
  for (const multisig of multisigNames) {
    const address = process.env[multisig];
    if (!validAddress(multisig, address)) {
      valid = false;
    }
  }
  if (!valid) process.exit(1);

  for (const multisig of multisigNames) {
    deployment.variables[multisig] = process.env[multisig];
    console.log(`\t\t${multisig} = ${process.env[multisig]}`);
  }
}
