import { expect } from 'chai';
import { createFixtureLoader } from 'ethereum-waffle';
import { Contract } from 'ethers';
import { expiryUtilsFixture } from './fixtures';

const { waffle } = require('hardhat');
const provider = waffle.provider;

const OT = 'OT';
const XYT = 'YT';
const AAVE_NAME = 'Aave interest bearing USDT';
const AAVE_SYMBOL = 'aUSDT';

describe('ExpiryUtils @skip-on-coverage', () => {
  const [alice] = provider.getWallets();
  const loadFixture = createFixtureLoader([alice], provider);

  let expiryUtilsContract: Contract;

  async function validate(expiryEpoch: number, expiryString: string) {
    const otName = await expiryUtilsContract.concat(OT, AAVE_NAME, expiryEpoch, ' ');
    const otSymbol = await expiryUtilsContract.concat(OT, AAVE_SYMBOL, expiryEpoch, '-');
    const xytName = await expiryUtilsContract.concat(XYT, AAVE_NAME, expiryEpoch, ' ');
    const xytSymbol = await expiryUtilsContract.concat(XYT, AAVE_SYMBOL, expiryEpoch, '-');

    expect(otName).to.be.eq(`${OT} ${AAVE_NAME} ${expiryString}`);
    expect(otSymbol).to.be.eq(`${OT}-${AAVE_SYMBOL}-${expiryString}`);
    expect(xytName).to.be.eq(`${XYT} ${AAVE_NAME} ${expiryString}`);
    expect(xytSymbol).to.be.eq(`${XYT}-${AAVE_SYMBOL}-${expiryString}`);
  }

  beforeEach(async () => {
    const fixture = await loadFixture(expiryUtilsFixture);
    expiryUtilsContract = fixture.expiryUtils;
  });

  it('Aave 1 Jan 2000', async () => {
    const expiryEpoch = 946731600;
    await validate(expiryEpoch, '1JAN2000');
  });

  it('Aave 31 Dec 2019', async () => {
    const expiryEpoch = 1577836700;
    await validate(expiryEpoch, '31DEC2019');
  });

  it('Aave 31 Dec 2020', async () => {
    const expiryEpoch = 1609419600;
    await validate(expiryEpoch, '31DEC2020');
  });

  it('Aave 29 Feb 2020', async () => {
    const expiryEpoch = 1582938061;
    await validate(expiryEpoch, '29FEB2020');
  });

  it('Aave 1 Mar 2100', async () => {
    const expiryEpoch = 4107546000;
    await validate(expiryEpoch, '1MAR2100');
  });
});
