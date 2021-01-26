import { expect } from "chai";
import { Contract, constants } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";
import { governanceFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleGovernance", () => {
  const [wallet] = provider.getWallets();
  const loadFixture = createFixtureLoader([wallet], provider);

  let pendle: Contract;
  let timelock: Contract;
  let pendleGovernor: Contract;
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture);
    pendle = fixture.pendle;
    timelock = fixture.timelock;
    pendleGovernor = fixture.pendleGovernor;
  });

  it("timelock", async () => {
    const admin = await timelock.admin();
    expect(admin).to.be.eq(wallet.address);
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
