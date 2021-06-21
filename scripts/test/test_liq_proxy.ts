import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { advanceTime } from '../../test/helpers';

async function main() {
  const user = '0xB723bDeEfDd4b01379378379d549bF64B8c2e3Fb';
  const liqMiningContract = '0x5B1C59Eb6872f88a92469751a034B9B5ADA9A73F';
  const EXPIRY = 1672272000;

  const proxy = await (await hre.ethers.getContractFactory('PendleLiquidityRewardsProxy')).deploy();

  await advanceTime(BN.from(3 * 86400));

  const results = await proxy.callStatic.redeemLiquidityRewards(liqMiningContract, [EXPIRY], user);
  console.log(`results = ${JSON.stringify(results, null, '  ')}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
