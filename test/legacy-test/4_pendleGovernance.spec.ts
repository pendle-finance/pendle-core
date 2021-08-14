import { expect } from 'chai';
import { constants, Contract } from 'ethers';
import { checkDisabled, governanceFixture, Mode } from '../fixtures';

const { waffle } = require('hardhat');
const { loadFixture, provider } = waffle;

export async function runTest(mode: Mode) {
  describe('', async () => {
    const [alice] = provider.getWallets();

    let pendle: Contract;
    let timelock: Contract;
    let governor: Contract;
    beforeEach(async () => {
      const fixture = await loadFixture(governanceFixture);
      pendle = fixture.pendle;
      timelock = fixture.timelock;
      governor = fixture.governor;
    });

    it('timelock', async () => {
      const admin = await timelock.admin();
      expect(admin).to.be.eq(alice.address);
      const pendingAdmin = await timelock.pendingAdmin();
      expect(pendingAdmin).to.be.eq(constants.AddressZero);
      const delay = await timelock.delay();
      expect(delay).to.be.eq(45000);
    });

    it('governor', async () => {
      const votingPeriod = await governor.votingPeriod();
      expect(votingPeriod).to.be.eq(17280);
      const timelockAddress = await governor.timelock();
      expect(timelockAddress).to.be.eq(timelock.address);
      const pendleFromGovernor = await governor.pendle();
      expect(pendleFromGovernor).to.be.eq(pendle.address);
    });
  });
}

describe('PendleGovernance', function () {
  if (checkDisabled(Mode.GENERAL_TEST)) return;
  runTest(Mode.GENERAL_TEST);
});
