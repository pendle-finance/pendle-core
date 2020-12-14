
import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-waffle";
import "solidity-coverage"

const config: HardhatUserConfig = {
  defaultNetwork: 'development',
  paths: {
    sources: './contracts',
    tests: './test/core/',
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      blockGasLimit: 12450000,
      gas: 'auto',
      gasPrice: 'auto',
    },
    development: {
      url: 'http://127.0.0.1:8545',
      gas: 12400000,
      timeout: 1000000,
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.7.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  mocha: {
    timeout: 500000,
  },
};

export default config;