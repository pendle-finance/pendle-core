import chai, { expect } from 'chai'
import { Contract, constants } from 'ethers'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { governanceFixture } from './fixtures'

chai.use(solidity)

describe('BenchmarkGovernance', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999,
    },
  })
  const [wallet] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let bmk: Contract
  let timelock: Contract
  let bmkGovernor: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(governanceFixture)
    bmk = fixture.bmk
    timelock = fixture.timelock
    bmkGovernor = fixture.bmkGovernor
  })

  it('timelock', async () => {
    const admin = await timelock.admin()
    expect(admin).to.be.eq(wallet.address)
    const pendingAdmin = await timelock.pendingAdmin()
    expect(pendingAdmin).to.be.eq(constants.AddressZero)
    const delay = await timelock.delay()
    expect(delay).to.be.eq(45000)
  })

  it('governor', async () => {
    const votingPeriod = await bmkGovernor.votingPeriod()
    expect(votingPeriod).to.be.eq(17280)
    const timelockAddress = await bmkGovernor.timelock()
    expect(timelockAddress).to.be.eq(timelock.address)
    const bmkFromGovernor = await bmkGovernor.bmk()
    expect(bmkFromGovernor).to.be.eq(bmk.address)
  })
})