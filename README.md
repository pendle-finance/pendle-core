# Pendle Protocol

## Introduction

Pendle’s protocol leverages on the base lending layer created by prominent DeFi protocols such as Aave and Compound, which has shown incredible growth and community acceptance. We build on this layer by separating the future cash flows from these lending protocols’ yield tokens and tokenizing it. This allows future yield to be traded without affecting ownership of the underlying
asset.

Ownership of the future cash flows is guaranteed by the smart contract, so there is no need to worry about collateral or counterparty risk, as long as the underlying lending protocol is not compromised.

## What does this allow?

This allows for freely tradable on-chain fixed and floating yields of alt coins, creating forward yield curves across tokens, giving the lending market greater visibility and more maturity. Having on-chain information tradable across multiple time horizons creates a new avenue for yield strategies such as Yearn vaults to maximize or protect returns. It allows for lenders to lock in their yields and traders to speculate and gain exposure to changes in yield.

The tokenization of future yields also allows for the creation of products with future yield as collateral. Various new trading derivatives will be feasible, such as rate swap products, the selling and buying of yield protection and spread trading. Besides creating a vibrant rates trading layer across the most relevant lending token pairs, Pendle may also participate in the creation of yield products,providing the ecosystem with a greater selection of strategies to choose from to easily express their view of the market.

## Contracts' terminologies
* `underlyingAsset`: the token that was deposited into Aave. For example: USDT
* `underlyingYieldToken`: the Aave aToken. For example, aUSDT
* Each OT and XYT is uniquely identified by `(bytes32 forgeId, address underlyingAsset, address underlyingYieldToken uint256 expiry)`
  * The `expiry` is the UNIX timestamp at 0:00 UTC of the day right after the expiry date. For example: if it expires on 3rd Oct, the `expiry` is the Unix timestamp of 4th Oct, 0:00 UTC

## Deployment:
* To deploy core contracts:
  * set the multisig addresses in `.env`, similar to `.env.example`
    * Please note that for networks other than `mainnet` and `kovan`, the scripts will use the deploying key as all the multisig.
    * Therefore, if we want to deploy a test instance with seeded contracts to kovan, we should use network `kovantest` instead of `kovan`
    * `kovan` will be used when we rehearse the real deployment steps (before doing it real on mainnet)
  * Run: (this runs `scripts/deploy/deploy.ts`)
  ```
  yarn deploy:core --network <network>
  ```
  * This will save the deployed contracts to `deployments/<network>.json`
  * If we want to reset the instance, put `RESET=true`:
  ```
  RESET=true yarn deploy:core --network <network>
  ```
* To deploy test instances of contracts (yield contracts, markets, liquidity mining): (this runs `scripts/manage/seed_test_contracts.ts`)
  ```
  yarn deploy:seed --network <network>
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
