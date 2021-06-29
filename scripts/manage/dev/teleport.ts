import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { advanceTime } from '../../../test/helpers';

async function main() {
  const network = hre.network.name;
  if (network != 'development') {
    console.log(`\tThis script is for funding accounts in development !`);
    process.exit(1);
  }
  console.log(`\t Teleporting by 1 week`);
  await advanceTime(BN.from(7 * 24 * 3600));
  console.log(`\t Done`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
