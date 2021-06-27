# UniswapV2

## Criterias of tokens to be compatible with UniswapV2

- Is a UniswapV2's LP token

## Forge

- `PendleUniswapV2Forge` inherits from `PendleForgeBaseV2`, but override all interest-related function
- Please refer to the UniswapV2's detailed specs for more information

## YieldContractDeployer & YieldTokenHolder

- UniswapV2 will use the `PendleYieldTokenHolderBaseV2` & `PendleYieldContractDeployerBaseV2` directly since it has no special requirements (no rewards, no external pools to lock tokens in)

## Market, MarketFactory & LiquidityMining

- UniswapV2 will use 3 contracts from `GenOne` folder because UniswapV2's YT has the same interest distribution mechanism as Compound's YT
- More specifically, both YTs will receive their interest over time, and there is no self-compounding of interest. In other words, its balance in users' accounts doesn't change & only its exchangeRate changes
