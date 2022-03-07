import { isEth, PendleEnv } from '../type';
import { assert } from 'hardhat';
import { MiscConsts } from '@pendle/constants';
import { getInfoOTMarket, getInfoSimpleToken, getInfoYO } from '../storage';
import { approve, sendAndWaitForTransaction } from '../helpers';
import { BigNumber as BN } from 'ethers';

export async function createNewOTMarket(env: PendleEnv, OTAddr: string, baseTokenAddr: string) {
  assert(baseTokenAddr != MiscConsts.ZERO_ADDRESS, 'BaseToken ZERO ADDRESS');
  let OT = await getInfoYO(OTAddr);
  let baseToken = await getInfoSimpleToken(baseTokenAddr);
  let joeSushiFactory = isEth(env) ? env.sushiFactory : env.joeFactory;

  let marketAddr: string = await joeSushiFactory.callStatic.createPair(OT.address, baseToken.address);
  await sendAndWaitForTransaction(
    joeSushiFactory.connect(env.deployer).createPair,
    `Create market between ${OT.symbol} and ${baseToken.symbol}`,
    [OT.address, baseToken.address]
  );

  return marketAddr;
}

export async function bootstrapOTMarket(env: PendleEnv, marketAddr: string, amountOT: BN, amountBaseToken: BN) {
  let market = await getInfoOTMarket(marketAddr);

  await approve(market.baseToken.address, env.joeRouter.address, amountBaseToken);
  await approve(market.OT.address, env.joeRouter.address, amountOT);

  await sendAndWaitForTransaction(
    env.joeRouter.connect(env.deployer).addLiquidity,
    `Bootstrapping market ${marketAddr}`,
    [market.OT.address, market.baseToken.address, amountOT, amountBaseToken, 0, 0, env.deployer.address, MiscConsts.INF]
  );

  console.log(
    `\t\tBootstrapped market with ${amountOT} ${market.OT.symbol} and ${amountBaseToken} ${market.baseToken.symbol}`
  );
}
