import {
  Deployment,
  validAddress,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step10(deployer: any, hre: any, deployment: Deployment, consts: any) {
  console.log(`\t\t LOCK_NUMERATOR = ${consts.misc.LOCK_NUMERATOR}`);
  console.log(`\t\t LOCK_DENOMINATOR = ${consts.misc.LOCK_DENOMINATOR}`);
  console.log(`\t\t INTEREST_UPDATE_RATE_DELTA_FOR_MARKET = ${consts.misc.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET}`);
  console.log(`\t\t FORGE_FEE = ${consts.misc.FORGE_FEE}`);
  console.log(`\t\t SWAP_FEE = ${consts.misc.SWAP_FEE}`);
  console.log(`\t\t PROTOCOL_SWAP_FEE = ${consts.misc.PROTOCOL_SWAP_FEE}`);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t\tPendleData address = ${pendleData.address}`);
  await sendAndWaitForTransaction(hre, pendleData.setLockParams, 'set lock params', [
    consts.misc.LOCK_NUMERATOR,
    consts.misc.LOCK_DENOMINATOR,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setInterestUpdateRateDeltaForMarket, 'set i/r update delta', [
    consts.misc.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setForgeFee, 'set forge fee', [consts.misc.FORGE_FEE]);

  await sendAndWaitForTransaction(hre, pendleData.setMarketFees, 'set market fees', [
    consts.misc.SWAP_FEE,
    consts.misc.PROTOCOL_SWAP_FEE,
  ]);
}
