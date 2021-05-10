import {
  Deployment,
  validAddress,
  deploy,
  getContractFromDeployment,
} from "../helpers/deployHelpers";

export async function step8(
  deployer: any,
  hre: any,
  deployment: Deployment,
  consts: any
) {
  const governanceMultisig = deployment.variables.GOVERNANCE_MULTISIG;
  const pendleRouterAddress = deployment.contracts.PendleRouter.address;

  if (!validAddress("GOVERNANCE_MULTISIG", governanceMultisig)) process.exit(1);
  if (!validAddress("PendleRouter address", pendleRouterAddress))
    process.exit(1);

  console.log(`\tPendleRouter address used = ${pendleRouterAddress}`);
  console.log(`\tGOVERNANCE_MULTISIG used = ${governanceMultisig}`);
  console.log(
    `\tCOMPOUND_COMPTROLLER_ADDRESS used = ${consts.misc.COMPOUND_COMPTROLLER_ADDRESS}`
  );
  console.log(`\tForge Id used = ${consts.misc.FORGE_COMPOUND}`);

  const cRewardManager = await deploy(hre, deployment, "PendleRewardManager", [
    governanceMultisig,
    consts.misc.FORGE_COMPOUND,
  ]);

  //TODO: change it to a Compound one
  const cYieldContractDeployer = await deploy(
    hre,
    deployment,
    "PendleAaveYieldContractDeployer",
    [governanceMultisig, consts.misc.FORGE_COMPOUND]
  );

  const pendleCompoundForge = await deploy(
    hre,
    deployment,
    "PendleCompoundForge",
    [
      governanceMultisig,
      pendleRouterAddress,
      consts.misc.COMPOUND_COMPTROLLER_ADDRESS,
      consts.misc.FORGE_COMPOUND,
      consts.misc.COMP_ADDRESS,
      cRewardManager.address,
      cYieldContractDeployer.address,
    ]
  );

  await cRewardManager.initialize(pendleCompoundForge.address);
  await cYieldContractDeployer.initialize(pendleCompoundForge.address);

  const pendleCompoundMarketFactory = await deploy(
    hre,
    deployment,
    "PendleCompoundMarketFactory",
    [governanceMultisig, consts.misc.FORGE_COMPOUND]
  );

  await pendleCompoundMarketFactory.initialize(pendleRouterAddress);
  const pendleRouter = await getContractFromDeployment(
    hre,
    deployment,
    "PendleRouter"
  );
  await pendleRouter.addMarketFactory(
    consts.misc.MARKET_FACTORY_COMPOUND,
    pendleCompoundMarketFactory.address
  );
  await pendleRouter.addForge(
    consts.misc.FORGE_COMPOUND,
    pendleCompoundForge.address
  );

  const pendleData = await getContractFromDeployment(
    hre,
    deployment,
    "PendleData"
  );

  if (!["kovan", "mainnet"].includes(hre.network.name)) {
    await pendleData.setForgeFactoryValidity(
      consts.misc.FORGE_COMPOUND,
      consts.misc.MARKET_FACTORY_COMPOUND,
      true
    );
  } else {
    console.log(
      "[NOTICE - TODO] We will need to use the governance multisig to setForgeFactoryValidity for Compound"
    );
    const txDetails = await pendleData.populateTransaction.setForgeFactoryValidity(
      consts.misc.FORGE_COMPOUND,
      consts.misc.MARKET_FACTORY_COMPOUND,
      true
    );
    console.log(
      `[NOTICE - TODO] Transaction details: \n${JSON.stringify(
        txDetails,
        null,
        "  "
      )}`
    );
  }
}
