const hre = require('hardhat');
import { BigNumber as BN } from 'ethers';
import path from 'path';
import { sendAndWaitForTransaction, getDeployment } from '../../helpers/deployHelpers';
import { devConstants as consts } from '../../helpers/constants';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  //check and load arguments
  //liquidity mining contract address, liquidity mining contract name, rewards
  const filePath = path.resolve(__dirname, `../../../deployments/${network}.json`);
  //load depolyment and deployed contracts
  const deployment = getDeployment(filePath);

  const liqMiningAddress = process.argv[2];
  const rewardPerEpoch = BN.from(process.argv[3]).mul(BN.from(10).pow(18));
  const rewards = [];
  for (let i = 0; i < 100; i++) {
    rewards.push(rewardPerEpoch);
  }

  const liqMiningContract = await hre.ethers.getContractAt('IPendleLiquidityMining', liqMiningAddress);

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}, liqMining=${liqMiningContract.address}`);
  console.log(`rewards = ${rewards}`);
  const pendle = await hre.ethers.getContractAt('IERC20', deployment.contracts.PENDLE.address);
  await sendAndWaitForTransaction(hre, pendle.approve, 'Approve liq mining contract to spend PENDLE', [
    liqMiningContract.address,
    consts.common.MAX_ALLOWANCE,
  ]);
  await sendAndWaitForTransaction(hre, liqMiningContract.fund, 'Fund Liq Mining', [rewards]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
