import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { advanceTime } from '../../../test/helpers';

async function main() {
  const network = hre.network.name;
  if (network != 'development') {
    console.log(`\tThis script is for funding accounts in development !`);
    process.exit(1);
  }
  const [a] = await hre.ethers.getSigners();
  console.log(`\t Teleporting by 1 week`);
  await advanceTime(BN.from(7 * 24 * 3600));
  for (let i = 0; i < 3301; i++) {
    await a.sendTransaction({ to: a.address, value: 1 });
  }
  console.log(`\t Done`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
