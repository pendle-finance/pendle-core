require('dotenv').config();
require('@nomiclabs/hardhat-truffle5');
require('@nomiclabs/hardhat-web3');
require('./deployment/protocol');

module.exports = {
  defaultNetwork: 'ganache',
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      },
      allowUnlimitedContractSize: false,
      blockGasLimit: 12400000,
      gas: 'auto',
      gasPrice: 'auto',
      timeout: 1000000,
    },
    ganache: {
      url: 'http://127.0.0.1:8545',
      gas: 12400000,
      network_id: 5777,
      timeout: 1000000,
    },
    // kovan: {
    //   url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
    //   gas: 8000000,
    //   timeout: 100000,
    //   accounts: [`${process.env.PRIVATE_KEYS}`],
    // },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.6',
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
    tests: './test/core/',
  },
  mocha: {
    enableTimeouts: false,
  }
};
