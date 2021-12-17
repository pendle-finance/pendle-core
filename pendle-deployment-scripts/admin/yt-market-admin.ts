import { MiscConsts } from '@pendle/constants';
import { BigNumber as BN } from 'ethers';
import { assert, ethers } from 'hardhat';
import {
  approve,
  getBalanceToken,
  getForgeIdFromYO,
  getInfoMarket,
  getInfoSimpleToken,
  getInfoSingleForge,
  getInfoYO,
  PendleEnv,
  saveNewMarket,
  sendAndWaitForTransaction,
} from '../index';

export async function createNewYTMarket(env: PendleEnv, factoryId: string, YTAddr: string, baseToken: string) {
  assert(baseToken != MiscConsts.ZERO_ADDRESS, 'BaseToken ZERO ADDRESS');

  let YTInfo = await getInfoYO(YTAddr);
  await sendAndWaitForTransaction(
    env.pendleRouter.createMarket,
    `createMarket ${factoryId} between ${(await getInfoSimpleToken(YTAddr)).symbol} and ${
      (
        await getInfoSimpleToken(baseToken)
      ).symbol
    }`,
    [factoryId, YTAddr, baseToken]
  );
  const marketAddress: string = await env.pendleData.getMarket(factoryId, YTAddr, baseToken);
  console.log(`\t Market created at ${marketAddress} `);

  await saveNewMarket(env, (await getInfoSingleForge(YTInfo.forge)).forgeId, marketAddress);
  return marketAddress;
}

export async function mintXytAndBootstrapYTMarket(
  env: PendleEnv,
  marketAddr: string,
  amountBaseToken: BN,
  amountUnderlyingYieldToken: BN,
  amountYTToBootstrapSetting?: BN
) {
  let market = await getInfoMarket(env, marketAddr);

  let YT = await getInfoYO(market.YT.address);

  let forgeId = await getForgeIdFromYO(YT.address);

  await approve(YT.underlyingYieldToken!.address, env.pendleRouter.address, amountUnderlyingYieldToken);

  let amountYTBefore = await getBalanceToken(YT, env.deployer.address);

  await sendAndWaitForTransaction(env.pendleRouter.tokenizeYield, 'tokenizeYield', [
    forgeId,
    YT.underlyingAsset.address,
    YT.expiry,
    amountUnderlyingYieldToken,
    env.deployer.address,
  ]);

  let amountYTAfter = await getBalanceToken(YT, env.deployer.address);

  let amountYTMinted = amountYTAfter.sub(amountYTBefore);

  const amountYTToBootstrap = amountYTToBootstrapSetting || amountYTMinted;

  console.log(`amountYTToBootstrap = ${amountYTToBootstrap}, YT.address = ${YT.address}`);

  await approve(market.baseToken.address, env.pendleRouter.address, amountBaseToken);
  await sendAndWaitForTransaction(env.pendleRouter.bootstrapMarket, 'bootstrapMarket', [
    market.factoryId,
    YT.address,
    market.baseToken.address,
    amountYTToBootstrap,
    amountBaseToken,
  ]);

  console.log(
    `\t\tBootstrapped market with ${amountYTToBootstrap} ${YT.symbol} and ${amountBaseToken} ${market.baseToken.symbol}`
  );
}
