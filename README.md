# Benchmark Protocol

## Introduction

Benchmark’s protocol leverages on the base lending layer created by prominent DeFi protocols such as Aave and Compound, which has shown incredible growth and community acceptance. We build on this layer by separating the future cash flows from these lending protocols’ yield tokens and tokenizing it. This allows future yield to be traded without affecting ownership of the underlying
asset.

Ownership of the future cash flows is guaranteed by the smart contract, so there is no need to worry about collateral or counterparty risk, as long as the underlying lending protocol is not compromised.

## What does this allow?

This allows for freely tradable on-chain fixed and floating yields of alt coins, creating forward yield curves across tokens, giving the lending market greater visibility and more maturity. Having on-chain information tradable across multiple time horizons creates a new avenue for yield strategies such as Yearn vaults to maximize or protect returns. It allows for lenders to lock in their yields and traders to speculate and gain exposure to changes in yield.

The tokenization of future yields also allows for the creation of products with future yield as collateral. Various new trading derivatives will be feasible, such as rate swap products, the selling and buying of yield protection and spread trading. Besides creating a vibrant rates trading layer across the most relevant lending token pairs, Benchmark may also participate in the creation of yield products,providing the ecosystem with a greater selection of strategies to choose from to easily express their view of the market.

## Contracts' terminologies
* `underlyingAsset`: the token that was deposited into Aave. For example: USDT
* `underlyingYieldToken`: the Aave aToken. For example, aUSDT
* Each OT and XYT is uniquely identified by `(bytes32 forgeId, address underlyingAsset, address underlyingYieldToken uint256 expiry)`
  * The `expiry` is the UNIX timestamp at 0:00 UTC of the day right after the expiry date. For example: if it expires on 3rd Oct, the `expiry` is the Unix timestamp of 4th Oct, 0:00 UTC

## Scripts:
* Run a mainnet fork on ganache: `INFURA_KEY=XXXX yarn ganache`
* Compile (both benchmark and aave): `yarn compile`
* run a console for development network: `yarn console:dev`

## Testing:
* Create a .env file containing the following properties:
  ```
  INFURA_KEY=<insert your Infura key here>
  PRIVATE_KEYS=<insert comma delimited private keys here>
  ```
* The main test for now: `yarn test test/core/Benchmark.js`
