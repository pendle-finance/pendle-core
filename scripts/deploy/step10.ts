import {
  Deployment,
  validAddress,
  sendAndWaitForTransaction,
  getContractFromDeployment,
} from '../helpers/deployHelpers';

export async function step10(deployer: any, hre: any, deployment: Deployment, consts: any) {
  console.log(`\t\t LOCK_NUMERATOR = ${consts.common.LOCK_NUMERATOR}`);
  console.log(`\t\t LOCK_DENOMINATOR = ${consts.common.LOCK_DENOMINATOR}`);
  console.log(`\t\t INTEREST_UPDATE_RATE_DELTA_FOR_MARKET = ${consts.common.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET}`);
  console.log(`\t\t FORGE_FEE = ${consts.common.FORGE_FEE}`);
  console.log(`\t\t SWAP_FEE = ${consts.common.SWAP_FEE}`);
  console.log(`\t\t PROTOCOL_SWAP_FEE = ${consts.common.PROTOCOL_SWAP_FEE}`);
  console.log(`\t\t EXPIRY_DIVISOR = ${consts.common.EXPIRY_DIVISOR}`);
  console.log(`\t\t B_DELTA = ${consts.common.B_DELTA}`);

  const pendleData = await getContractFromDeployment(hre, deployment, 'PendleData');
  console.log(`\t\tPendleData address = ${pendleData.address}`);
  await sendAndWaitForTransaction(hre, pendleData.setLockParams, 'set lock params', [
    consts.common.LOCK_NUMERATOR,
    consts.common.LOCK_DENOMINATOR,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setInterestUpdateRateDeltaForMarket, 'set i/r update delta', [
    consts.common.INTEREST_UPDATE_RATE_DELTA_FOR_MARKET,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setForgeFee, 'set forge fee', [consts.common.FORGE_FEE]);

  await sendAndWaitForTransaction(hre, pendleData.setMarketFees, 'set market fees', [
    consts.common.SWAP_FEE,
    consts.common.PROTOCOL_SWAP_FEE,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setExpiryDivisor, 'set expiry divisor', [
    consts.common.EXPIRY_DIVISOR,
  ]);

  await sendAndWaitForTransaction(hre, pendleData.setCurveShiftBlockDelta, 'set bDelta', [consts.common.B_DELTA]);
}
