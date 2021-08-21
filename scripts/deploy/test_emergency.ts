import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { impersonateAccount } from '../../test/helpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const govAddress = '0x8119EC16F0573B7dAc7C0CB94EB504FB32456ee1';
  const ONE_E_18 = BN.from(10).pow(18);
  await deployer.sendTransaction({ to: govAddress, value: ONE_E_18 });
  await impersonateAccount(govAddress);
  const govSigner = await hre.ethers.getSigner(govAddress);

  const pendle = await hre.ethers.getContractAt('IERC20', '0x808507121B80c02388fAd14726482e061B8da827');
  const pausingManager = await hre.ethers.getContractAt(
    'PendlePausingManager',
    '0xea2575F82C881b223208FA53982e6e09aB55CcDa'
  );
  const EXPIRY = 1672272000;
  const liqMining = await hre.ethers.getContractAt(
    'IPendleLiquidityMining',
    '0xa133Fe86202e5DA288Ee0748fc68Ca1faf69d062'
  );
  const liqMining2 = await hre.ethers.getContractAt(
    'IPendleLiquidityMining',
    '0x7CCD8260fAF81Bf402bf3162736A31F3ca27F2D5'
  );

  // First step
  await pausingManager.connect(govSigner).setLiqMiningLocked(liqMining.address); //done
  await pausingManager.connect(govSigner).setLiqMiningLocked(liqMining2.address); //done

  // const results = await pausingManager.callStatic.checkLiqMiningStatus(liqMining.address);
  // console.log(`results = ${JSON.stringify(results, null, "  ")}`);

  // Second step
  await liqMining.connect(govSigner).setUpEmergencyMode([], govSigner.address); // done
  await liqMining2.connect(govSigner).setUpEmergencyMode([], govSigner.address); // done
  console.log(`balance of liqMining = ${await pendle.balanceOf(liqMining.address)}`);
  console.log(`balance of liqMining2 = ${await pendle.balanceOf(liqMining2.address)}`);

  // Thirdstep
  await pendle.connect(govSigner).transferFrom(liqMining.address, govSigner.address, ONE_E_18.mul(480000)); //done
  await pendle.connect(govSigner).transferFrom(liqMining2.address, govSigner.address, ONE_E_18.mul(480000));
  console.log(`balance of liqMining = ${await pendle.balanceOf(liqMining.address)}`);
  console.log(`balance of liqMining2 = ${await pendle.balanceOf(liqMining2.address)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
