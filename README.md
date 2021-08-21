# Pendle Core
This repository contains the core smart contracts for the Pendle Protocol.

## Introduction
Prominent DeFi protocols have introduced various yield bearing tokens, like Aave's aToken or Compound's cToken, which has shown incredible growth
and community acceptance. Pendle Protocol builds on top of this layer, by splitting the yield bearing tokens into two tokens: the Yield Token (YT) that represents the right to receive the yield, and the Ownership Token (OT) that represents the right to the underlying yield bearing tokens. This
allows for the trading of yield, which has wide-ranging applications.

On top of yield tokenisation, Pendle Protocol has an AMM specifically designed for the trading of time-decaying assets, which aims to minimise
impermanent loss (IL) for liquidity providers.

## How it works
* All current documentations for how Pendle works is [at this link](./docs/SPECS.md)

## Deployment:
* To deploy core contracts:
  * set the multisig addresses in `.env`, similar to `.env.example`
    * Please note that for networks other than `mainnet` and `kovan`, the scripts will use the deploying key as all the multisig.
  * Run: (this runs `scripts/deploy/deploy.ts`)
  ```
  yarn deploy:core --network <network>
  ```
  * This will save the deployed contracts to `deployments/<network>.json`
  * If we want to reset the instance, put `RESET=true`:
  ```
  RESET=true yarn deploy:core --network <network>
  ```
* To deploy test instances of contracts (yield contracts, markets, liquidity mining) for an expiry: (this runs `scripts/manage/seed_test_contracts.ts`)
  ```
  EXPIRY=<expiry_to_seed> yarn deploy:seed --network <network>
  ```
  * This will save the new yield contracts to `deployments/<network>.json` as well
* To verify contracts that have been deployed in `deployments/<network>.json`:
  * First, install tenderly [link](https://github.com/Tenderly/tenderly-cli)
  * Then, `tenderly login`
  * Run: (which runs `scripts/manage/verify_tenderly.ts`)
  ```
  yarn verify --network <network>
  ```

## Testing:
* Create a .env file containing the following properties:
  ```
  ALCHEMY_KEY=<insert your ALCHEMY_KEY key here>
  ```
* Run test:
  ```
  yarn test
  ```
* Run test coverage:
  ```
  yarn coverage:all
  ```

## Setup for UI development environment (forking mainnet)
* In a separate terminal:
```
yarn hardhat node
```
* Mint tokens to alice, bob, charlie and let alice tokeniseYield, add liquidity and stake:
```
yarn dev
```
* Teleport by 1 week
```
yarn teleport
```

## Note on naming
* In the contracts and tests, Yield Token (YT) are referred to as XYT. XYT and YT refer to the same thing.

## Licensing
The primary license for Pendle Core is the Business Source License 1.1 (BUSL-1.1), see [`LICENSE`](./LICENSE).
### Exceptions
- All files in `contracts/interfaces/`, `contracts/governance/` and `contracts/mock` are licensed under `MIT` (as indicated in their SPDX headers)
- `contracts/periphery/Timelock.sol` and `contracts/tokens/PENDLE.sol` are also licensed under `MIT` (as indicated in their SPDX header)
- All files in `contracts/libraries/` are licensed under `GPL-2.0-or-later` (as indicated in their SPDX headers), see [`contracts/libraries/LICENSE`](contracts/libraries/LICENSE)
