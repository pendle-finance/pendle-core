import { Deployment, validAddress, deploy } from "../helpers/deployHelpers";

export async function step4(
  deployer: any,
  hre: any,
  deployment: Deployment,
  consts: any
) {
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;
  const wethAddress = consts.tokens.WETH.address;
  const pendleDataAddress = deployment.contracts.PendleData.address;

  if (!validAddress("GOVERNANCE_MULTISIG", governanceMultisig)) process.exit(1);
  if (!validAddress("WETH address", wethAddress)) process.exit(1);

  console.log(`\t\tGOVERNANCE_MULTISIG used = ${governanceMultisig}`);
  console.log(`\t\tWETH used = ${consts.tokens.WETH.address}`);

  await deploy(hre, deployment, "PendleRouter", [
    governanceMultisig,
    wethAddress,
    pendleDataAddress,
  ]);
}
