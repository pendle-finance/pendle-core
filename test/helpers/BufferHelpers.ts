import { BigNumber as BN, Contract } from 'ethers';
import { emptyToken, mintTraderJoeLpFixed, mintUniswapLpFixed, mintXJoe, teConsts } from '.';
import { TestEnv } from '../fixtures';
import { getContract } from '../../pendle-deployment-scripts';

export async function bufferSushi(
  env: TestEnv,
  sushiForge: Contract,
  token: string,
  T0: BN,
  removeBalance: boolean = true
) {
  const sushiPool = await getContract('ERC20', token);
  const sushiYieldTokenHolderAddr = await sushiForge.yieldTokenHolders(token, T0.add(env.pconsts.misc.SIX_MONTH));
  const sushiYieldTokenHolder = await getContract('IPendleYieldTokenHolderV2', sushiYieldTokenHolderAddr);
  await sushiPool.connect(env.eve).transfer(sushiYieldTokenHolderAddr, 10, teConsts.HG);
  await sushiYieldTokenHolder.afterReceiveTokens(10, teConsts.HG);
  await sushiPool.connect(env.eve).transfer(sushiYieldTokenHolderAddr, 10, teConsts.HG);
  await sushiYieldTokenHolder.afterReceiveTokens(10, teConsts.HG);
  if (removeBalance) {
    await emptyToken(env, sushiPool, env.eve);
  }
}

export async function bufferJoe(env: TestEnv) {
  const joeYieldTokenHolderAddr = await env.joeForge.yieldTokenHolders(
    env.ptokens.JOE_WAVAX_DAI_LP!.address,
    teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH)
  );
  const joeYieldTokenHolder = await getContract('IPendleYieldTokenHolderV2', joeYieldTokenHolderAddr);
  await mintTraderJoeLpFixed(env, env.eve);
  await env.joePool
    .connect(env.eve)
    .transfer(
      await env.joeForge.yieldTokenHolders(
        env.ptokens.JOE_WAVAX_DAI_LP!.address,
        teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH)
      ),
      1000
    );
  await joeYieldTokenHolder.afterReceiveTokens(10, teConsts.HG);
  await env.joePool
    .connect(env.eve)
    .transfer(
      await env.joeForge.yieldTokenHolders(
        env.ptokens.JOE_WAVAX_DAI_LP!.address,
        teConsts.T0_TJ.add(env.pconsts.misc.SIX_MONTH)
      ),
      1000
    );
  await joeYieldTokenHolder.afterReceiveTokens(10, teConsts.HG);
  await emptyToken(env, env.joePool, env.eve);
}

export async function bufferUni(env: TestEnv) {
  await mintUniswapLpFixed(env, env.eve);
  await env.uniPool
    .connect(env.eve)
    .transfer(
      env.uniForge.yieldTokenHolders(
        env.ptokens.UNI_USDT_WETH_LP!.address,
        teConsts.T0_UNI.add(env.pconsts.misc.SIX_MONTH)
      ),
      1000
    );
  await emptyToken(env, env.uniPool, env.eve);
}

export async function bufferXJoe(env: TestEnv) {
  const xJoeYieldTokenHolderAddr = await env.xJoeForge.yieldTokenHolders(
    env.ptokens.JOE!.address,
    teConsts.T0_XJ.add(env.pconsts.misc.SIX_MONTH)
  );
  const xJoeYieldTokenHolder = await getContract('IPendleYieldTokenHolderV2', xJoeYieldTokenHolderAddr);
  await mintXJoe(env, env.xJoe, env.eve, teConsts.INITIAL_xJOE_AMOUNT);
  await env.xJoe.connect(env.eve).transfer(xJoeYieldTokenHolderAddr, 1000);
  await xJoeYieldTokenHolder.afterReceiveTokens(10, teConsts.HG);
  await emptyToken(env, env.xJoe, env.eve);
}
