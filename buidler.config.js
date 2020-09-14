usePlugin('@nomiclabs/buidler-truffle5');
usePlugin('@nomiclabs/buidler-web3');
usePlugin('solidity-coverage');

module.exports = {
  defaultNetwork: 'buidlerevm',
  networks: {
    development: {
      url: 'http://127.0.0.1:8545',
      gas: 12400000,
      timeout: 20000,
    },
  },
  solc: {
    version: '0.7.1',
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
  },
  mocha: {
    enableTimeouts: false,
  },
};
