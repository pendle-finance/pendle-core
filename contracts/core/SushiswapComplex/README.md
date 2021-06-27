# SushiswapComplex

## Criterias of tokens to be compatible with SushiswapComplex

- Is a Sushiswap's LP token
- Is in Sushiswap's Onsen program
- Receives its rewards by `MasterChefV1` (and not `MasterChefV2`)

## Forge

- `PendleSushiswapComplexForge` inherits most of its functions from `PendleUniswapV2Forge` (since Sushiswap has a very similar set of contracts to UniswapV2)
- Only `verifyToken` needs to be overridden

## YieldContractDeployer

- `PendleSushiswapComplexYieldContractDeployer` inherits most of its function from `PendleYieldContractDeployerBaseV2`, but obviously `deployYieldTokenHolder` will have to be overriden to provide additional arguments for `MasterChef` & `pid`

## YieldTokenHolder

- `PendleSushiswapComplexYieldTokenHolder` inherits from `PendleYieldTokenHolderBaseV2`, but most functions are overridden
- Instead of holding yield tokens in the contract itself, the `yieldTokenHolder` will have to deposit all of its yield tokens to the `MasterChef` in order to earn Sushi rewards. Therefore `afterReceiveTokens` will have to deposit the entire contract's balance to `MasterChef`
- Similarly, when users withdraw their yield tokens, the `yieldTokenHolder` will first have to withdraw from `MasterChef` before transferring it to users
- `redeemRewards` being written in such a way is because `MasterChef` doesn't allow users to redeem the rewards separately

## Market, MarketFactory & LiquidityMining

- Please refer to the explanation for UniswapV2
