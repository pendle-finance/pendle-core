## YieldContractDeployer & YieldTokenHolder

- UniswapV2 will use the `PendleYieldTokenHolderBaseV2` & `PendleYieldContractDeployerBaseV2` directly since it has no special requirements (no rewards, no external pools to lock tokens in)

## Market, MarketFactory & LiquidityMining

- UniswapV2 will use 3 contracts from `Generic` folder because UniswapV2's YT has the same interest distribution mechanism as Compound's YT
- More specifically, both YTs will receive their interest over time, and there is no self-compounding of interest. In other words, its balance in users' accounts doesn't change & only its exchangeRate changes
