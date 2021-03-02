import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { constants, Contract } from "ethers";
import { governanceFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleGovernance", () => {
  const [alice] = provider.getWallets();
  const loadFixture = createFixtureLoader([alice], provider);

  let pendle: Contract;
  let timelock: Contract;
  let governor: Contract;
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture);
    pendle = fixture.pendle;
    timelock = fixture.timelock;
    governor = fixture.governor;
  });

  it("timelock", async () => {
    const admin = await timelock.admin();
    expect(admin).to.be.eq(alice.address);
    const pendingAdmin = await timelock.pendingAdmin();
    expect(pendingAdmin).to.be.eq(constants.AddressZero);
    const delay = await timelock.delay();
    expect(delay).to.be.eq(45000);
  });

  it("governor", async () => {
    const votingPeriod = await governor.votingPeriod();
    expect(votingPeriod).to.be.eq(17280);
    const timelockAddress = await governor.timelock();
    expect(timelockAddress).to.be.eq(timelock.address);
    const pendleFromGovernor = await governor.pendle();
    expect(pendleFromGovernor).to.be.eq(pendle.address);
  });
});
