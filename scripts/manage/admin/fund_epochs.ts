const hre = require('hardhat');
import { BigNumber as BN } from 'ethers';

import { sendAndWaitForTransaction } from '../../helpers/deployHelpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  //check and load arguments
  //liquidity mining contract address, liquidity mining contract name, rewards

  const pendle = await hre.ethers.getContractAt('IERC20', '0xff3b42ccb73Dc70Af4BB2a03EfCF021B5ad08033');
  console.log(`pendle balance of deployer = ${await pendle.balanceOf(deployer.address)}`);

  const liqMiningAddress = process.argv[2];
  const rewardPerEpoch = BN.from(10).pow(18).mul(1000);
  const rewards = [rewardPerEpoch, rewardPerEpoch];

  const liqMiningContract = await hre.ethers.getContractAt('IPendleLiquidityMining', liqMiningAddress);

  console.log(`\n\tNetwork = ${network}, deployer = ${deployer.address}, liqMining=${liqMiningContract.address}`);
  console.log(`rewards = ${rewards}`);
  await sendAndWaitForTransaction(hre, liqMiningContract.fund, 'Fund Liq Mining', [rewards]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
