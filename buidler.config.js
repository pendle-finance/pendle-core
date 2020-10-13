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
      timeout: 20000,
    },
  },
  solc: {
    version: '0.7.2',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: './contracts/benchmark',
    tests: './test',
  },
  mocha: {
    enableTimeouts: false,
  },
};
