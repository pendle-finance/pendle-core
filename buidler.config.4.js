usePlugin('@nomiclabs/buidler-truffle5');
usePlugin('@nomiclabs/buidler-web3');
usePlugin('solidity-coverage');

module.exports = {
  defaultNetwork: 'development',
  networks: {
    buidlerevm: {
      gas: 11500000,
      blockGasLimit: 11500000,
      allowUnlimitedContractSize: false,
      timeout: 1800000,
    },
    development: {
      url: 'http://127.0.0.1:8545',
      gas: 12400000,
      timeout: 100000,
    },
  },
  solc: {
    version: '0.4.17',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: './contracts/v4',
  },
  mocha: {
    enableTimeouts: false,
  },
};
