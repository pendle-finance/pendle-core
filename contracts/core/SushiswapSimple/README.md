## YieldContractDeployer & YieldTokenHolder

- Similar to UniswapV2, SushiswapSimple will use the `PendleYieldTokenHolderBaseV2` & `PendleYieldContractDeployerBaseV2` directly since it has no special requirements (no rewards, no external pools to lock tokens in)

## Market, MarketFactory & LiquidityMining

- Similar to UniswapV2, SushiswapSimple will use 3 contracts from `Generic` folder because UniswapV2's YT has the same interest distribution mechanism as Compound's YT
