const BN = web3.utils.BN;

const LendingPoolCore = artifacts.require('IAaveLendingPoolCore');
const LendingPool = artifacts.require('IAaveLendingPool');
const TetherToken = artifacts.require('IUSDT');
const AToken = artifacts.require('IAToken');

const { constants } = require('./Constants');
const { getTokenAmount } = require('./Math');

async function getAaveContracts() {
  const lendingPoolCore = await LendingPoolCore.at(constants.AAVE_LENDING_POOL_CORE_ADDRESS);
  const lendingPool = await LendingPool.at(constants.AAVE_LENDING_POOL_ADDRESS);
  const aUSDTAddress = await lendingPoolCore.getReserveATokenAddress(constants.USDT_ADDRESS);
  const aUSDT = await AToken.at(aUSDTAddress);
  return {
    lendingPoolCore,
    lendingPool,
    aUSDT
  };
}

async function mintUSDT(receiver, amount) {
  const usdt = await TetherToken.at(constants.USDT_ADDRESS);
  // console.log(`\tBalance of receiver before mintUSDT is ${await usdt.balanceOf.call(receiver)}`);
  const tokenAmount = getTokenAmount("USDT", amount);
  await usdt.issue(tokenAmount, { from: constants.USDT_OWNER_ADDRESS });
  await usdt.transfer(receiver, tokenAmount, { from: constants.USDT_OWNER_ADDRESS });
  console.log(`\tMinted ${amount} USDT to ${receiver}, balance = ${(await usdt.balanceOf.call(receiver)).div(new BN(1000000))}`);
}

async function mintAUSDT(receiver, amount) {
  const usdt = await TetherToken.at(constants.USDT_ADDRESS);

  // Let's use USDT_OWNER_ADDRESS as the address to deposit USDT to Aave to get aUSDT
  const lendingPoolCoreAllowance = await usdt.allowance.call(constants.USDT_OWNER_ADDRESS, constants.AAVE_LENDING_POOL_CORE_ADDRESS);
  console.log(`\t\tAllowance for aave lending pool = ${lendingPoolCoreAllowance}`);
  if (lendingPoolCoreAllowance < 1) {
    await usdt.approve(constants.AAVE_LENDING_POOL_CORE_ADDRESS, constants.MAX_ALLOWANCE, { from: constants.USDT_OWNER_ADDRESS });
  }

  const tokenAmount = getTokenAmount("USDT", amount);
  await usdt.issue(tokenAmount, { from: constants.USDT_OWNER_ADDRESS });

  const aaveContracts = await getAaveContracts();
  console.log(`\t\tUSDT balance of USDT_OWNER_ADDRESS = ${await usdt.balanceOf.call(constants.USDT_OWNER_ADDRESS)}`);

  await aaveContracts.lendingPool.deposit(constants.USDT_ADDRESS, tokenAmount, new BN(0), { from: constants.USDT_OWNER_ADDRESS });

  await aaveContracts.aUSDT.transfer(receiver, tokenAmount, { from: constants.USDT_OWNER_ADDRESS });
  console.log(`\tMinted ${amount} aUSDT to ${receiver}, balance = ${(await aaveContracts.aUSDT.balanceOf.call(receiver)).div(new BN(1000000))}`);
}

async function printAaveAddressDetails(address) {
  const aaveContracts = await getAaveContracts();
  console.log(`\tAave balance [USDT] - ${address}`);
  console.log(`\t\tbalanceOf = ${await aaveContracts.aUSDT.balanceOf.call(address)}`);
  console.log(`\t\tprincipal balance = ${await aaveContracts.aUSDT.principalBalanceOf.call(address)}`);
  console.log(`\t\tAUSDT pool's Normalized income = ${await aaveContracts.lendingPoolCore.getReserveNormalizedIncome.call(constants.USDT_ADDRESS)}`);
}

module.exports = { getAaveContracts, mintUSDT, mintAUSDT, printAaveAddressDetails };
