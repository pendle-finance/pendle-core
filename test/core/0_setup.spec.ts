import { liquidityMiningFixture } from './fixtures';

import hre from 'hardhat';
const { waffle } = hre;
const { loadFixture, provider } = waffle;

describe('setup', async () => {
  before(async () => {
    await loadFixture(liquidityMiningFixture);
  });

  it('setup', async () => {
    const [alice, bob] = provider.getWallets();
    await alice.sendTransaction({ to: bob.address, value: 1 });
    console.log(`block after setting up = ${await provider.getBlockNumber()}`);
  });
});
