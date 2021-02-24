import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { constants, Contract } from "ethers";
import { pendleGovernanceFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleGovernance", () => {
  const [alice] = provider.getWallets();
  const loadFixture = createFixtureLoader([alice], provider);

  let pendle: Contract;
  let timelock: Contract;
  let pendleGovernor: Contract;
  beforeEach(async () => {
    const fixture = await loadFixture(pendleGovernanceFixture);
    pendle = fixture.pendle;
    timelock = fixture.timelock;
    pendleGovernor = fixture.pendleGovernor;
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
    const votingPeriod = await pendleGovernor.votingPeriod();
    expect(votingPeriod).to.be.eq(17280);
    const timelockAddress = await pendleGovernor.timelock();
    expect(timelockAddress).to.be.eq(timelock.address);
    const pendleFromGovernor = await pendleGovernor.pendle();
    expect(pendleFromGovernor).to.be.eq(pendle.address);
  });
});
