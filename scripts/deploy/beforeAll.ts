import { Deployment, validAddress } from '../helpers/deployHelpers';

export async function beforeAll(deployer: any, hre: any, deployment: Deployment, consts: any) {
  const multisigNames = [
    'GOVERNANCE_MULTISIG',
    'TEAM_TOKENS_MULTISIG',
    'ECOSYSTEM_FUND_MULTISIG',
    'SALES_MULTISIG',
    'LIQUIDITY_INCENTIVES_MULTISIG',
    'FORGE_EMERGENCY_HANDLER',
    'MARKET_EMERGENCY_HANDLER',
    'LIQ_MINING_EMERGENCY_HANDLER',
    'TREASURY_MULTISIG',
  ];

  if (!['mainnet', 'goerli', 'kovan'].includes(hre.network.name)) {
    console.log(
      `[NOTICE] its not mainnet, so we are using deployer account ${deployer.address} as the multisigs, and the emergency handlers`
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
