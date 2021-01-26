import { expect } from "chai";
import { createFixtureLoader } from "ethereum-waffle";
import { Contract } from "ethers";
import { dateFixture } from "./fixtures";

const { waffle } = require("hardhat");
const provider = waffle.provider;

describe("Date", () => {
  const [wallet] = provider.getWallets();
  const loadFixture = createFixtureLoader([wallet], provider);

  let dateContract: Contract;
  beforeEach(async () => {
    const fixture = await loadFixture(dateFixture);
    dateContract = fixture.date;
  });

  it("1 Jan 2000", async () => {
    const date = await dateContract.parseTimestamp(946731600);
    expect(date.day).to.be.eq(1);
    expect(date.month).to.be.eq(1);
    expect(date.year).to.be.eq(2000);
  });

  it("31 Dec 2019", async () => {
    const date = await dateContract.parseTimestamp(1577836700);
    expect(date.day).to.be.eq(31);
    expect(date.month).to.be.eq(12);
    expect(date.year).to.be.eq(2019);
  });

  it("1 Jan 2020", async () => {
    const date = await dateContract.parseTimestamp(1577836800);
    expect(date.day).to.be.eq(1);
    expect(date.month).to.be.eq(1);
    expect(date.year).to.be.eq(2020);
  });

  it("31 Dec 2020", async () => {
    const date = await dateContract.parseTimestamp(1609419600);
    expect(date.day).to.be.eq(31);
    expect(date.month).to.be.eq(12);
    expect(date.year).to.be.eq(2020);
  });

  it("29 Feb 2020", async () => {
    const date = await dateContract.parseTimestamp(1582938061);
    expect(date.day).to.be.eq(29);
    expect(date.month).to.be.eq(2);
    expect(date.year).to.be.eq(2020);
  });

  it("1 Mar 2100", async () => {
    const date = await dateContract.parseTimestamp(4107546000);
    expect(date.day).to.be.eq(1);
    expect(date.month).to.be.eq(3);
    expect(date.year).to.be.eq(2100);
  });

  it("gets RFC2822 string", async () => {
    const date = await dateContract.toRFC2822String(1777836800);
    expect(date).to.be.eq("3MAY2026");
  });
});
