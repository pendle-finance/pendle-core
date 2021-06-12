/**
 * Steps to use:
 * 1. Start your local blockchain with yarn ganache
 * 2. Replace the private key below with a wallet containing ETH
 * 3. Run yarn deploy:dev
 */
const hre = require('hardhat');

const Web3 = require('web3');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const { ethers } = require('ethers');
const { devConstants, kovanConstants } = require('../deploy_helpers/Constants.ts');

import PendleMarket from '../build/artifacts/contracts/core/PendleMarket.sol/PendleMarket.json';
import PendleCompoundForge from '../build/artifacts/contracts/core/PendleCompoundForge.sol/PendleCompoundForge.json';
import PendleAaveForge from '../build/artifacts/contracts/core/PendleAaveForge.sol/PendleAaveForge.json';

const TEST_AMOUNT_TO_MINT = 100000000000;
const TEST_AMOUNT_TO_TOKENIZE = 1500000000;
const TEST_AMOUNT_TO_BOOTSTRAP = 1000000000;
const privateKey = 'a3237e736cc13bf91e38c50636593727a6b16d077ca4bb0ff627290b104fa93c';

const COMPOUND_FORGE_ADDRESS = '0xd00004547da025D828D850d8c08C78699f0B622c';
const COMPOUND_JUN_MARKET = '0xDf9d8aa9a9FCB390FA9c252af8e2c19f8907b6d2';

const func = async function () {
  const httpProvider = new ethers.providers.AlchemyProvider('kovan', '5cJkGtY8aUGF3Goy2X9KsH10NmJDcepZ');

  const signer = new ethers.Wallet(privateKey, httpProvider);
  const compoundForge = new ethers.Contract(COMPOUND_FORGE_ADDRESS, PendleCompoundForge.abi, signer);
  const compoundMarket = new ethers.Contract(COMPOUND_JUN_MARKET, PendleMarket.abi, signer);

  const deployer = signer.address;
  const chainId = await httpProvider.getNetwork().then((network: any) => network.chainId);

  console.log(`\tDeployer = ${deployer}`);
  console.log(`\tChainId = ${chainId}`);
  console.log(`\tcompoundForge = ${compoundForge.address}, compound june market = ${compoundMarket.address}`);
  const xytCompJunAddress = await compoundMarket.xyt();
  console.log(`\t[Compound Jun Market] xyt address = ${xytCompJunAddress}`);
  console.log(`\t[Compound Jun Market] reserves (xyt, basetoken, time) = ${await compoundMarket.getReserves()}`);

  const constants = chainId == 42 ? kovanConstants : devConstants;

  console.log(`\tBootstrapped Market`);
};
func();
