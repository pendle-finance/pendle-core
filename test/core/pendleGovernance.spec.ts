import { expect } from "chai";
import { Contract, constants } from "ethers";
import { createFixtureLoader } from "ethereum-waffle";
import { governanceFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("PendleGovernance", () => {
  const [wallet] = provider.getWallets();
  const loadFixture = createFixtureLoader([wallet], provider);

  let pdl: Contract;
  let timelock: Contract;
  let pdlGovernor: Contract;
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture);
    pdl = fixture.pdl;
    timelock = fixture.timelock;
    pdlGovernor = fixture.pdlGovernor;
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
    const votingPeriod = await pdlGovernor.votingPeriod();
    expect(votingPeriod).to.be.eq(17280);
    const timelockAddress = await pdlGovernor.timelock();
    expect(timelockAddress).to.be.eq(timelock.address);
    const pdlFromGovernor = await pdlGovernor.pdl();
    expect(pdlFromGovernor).to.be.eq(pdl.address);
  });
});
