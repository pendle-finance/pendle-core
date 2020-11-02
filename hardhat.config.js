require('dotenv').config();
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');

module.exports = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      },
      allowUnlimitedContractSize: false,
      blockGasLimit: 12450000,
      gas: 'auto',
      gasPrice: 'auto',
      timeout: 1800000,
    },
    development: {
      url: 'http://127.0.0.1:8545',
      gas: 12400000,
      timeout: 100000,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
  },
  mocha: {
    enableTimeouts: false,
  },
  tenderly: {
    username: 'ayobuenavista',
    project: 'projects',
  },
};
