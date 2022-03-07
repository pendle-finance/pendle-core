import { Erc20Token } from '@pendle/constants';
import { BigNumber as BN, utils } from 'ethers';
import hre from 'hardhat';
import {
  approve,
  DeployOrFetch,
  deployRedeemProxy,
  deployRetroactiveDist,
  getBalanceToken,
  PendleEnv,
  sendAndWaitForTransaction,
} from '.';

export async function deployNewContracts(env: PendleEnv) {
  await deployRetroactiveDist(env, DeployOrFetch.DEPLOY);
  await deployRedeemProxy(env, DeployOrFetch.DEPLOY);
}

export async function verifyNewContracts(env: PendleEnv) {
  await hre.run('verify:verify', {
    address: env.retroDist.address,
    contract: 'contracts/misc/PendleRetroactiveDistribution.sol:PendleRetroactiveDistribution',
    constructorArguments: [],
  });
  await hre.run('verify:verify', {
    address: env.redeemProxyAvax.address,
    contract: 'contracts/misc/PendleRedeemProxyMulti.sol:PendleRedeemProxyMulti',
    constructorArguments: [env.pendleRouter.address, env.retroDist.address],
  });
}

export async function fundRewards(env: PendleEnv) {
  let users = ['0xB5E4846Db18d2B859c32951C843a5b7A2bf19126', '0x0D207520DF136bFc84c7a2932383362b8ae4fC61'];
  let tokens: Erc20Token[] = [env.tokens.WNATIVE, env.tokens.QI!, env.tokens.JOE!];
  let dummyAmount = BN.from(10).pow(9);
  let rewardType = utils.formatBytes32String('Test Reward');

  let multiplier = dummyAmount.div(10);
  for (let token of tokens) {
    await approve(token.address, env.retroDist.address, dummyAmount.mul(10));
    let userAmounts: [string, BN][] = users.map((ele) => {
      return [ele, dummyAmount.add(multiplier)];
    });

    await sendAndWaitForTransaction(env.retroDist.distribute, `Distributing ${token.symbol}`, [
      rewardType,
      token.address,
      userAmounts,
    ]);
    multiplier = multiplier.mul(2);
  }
}

export async function tryClaimingRewards(env: PendleEnv) {
  let users = ['0xB5E4846Db18d2B859c32951C843a5b7A2bf19126', '0x0D207520DF136bFc84c7a2932383362b8ae4fC61'];
  let tokens: Erc20Token[] = [env.tokens.WNATIVE, env.tokens.QI!, env.tokens.JOE!];
  let tokenAddrs: string[] = tokens.map((value) => {
    return value.address;
  });
  let dummyAmount = BN.from(10).pow(9);

  for (let user of users) {
    let preBals = [];
    for (const token of tokenAddrs) {
      preBals.push((await getBalanceToken(token, user)).toString());
    }
    await sendAndWaitForTransaction(env.redeemProxyAvax.redeem, `redeeming for ${user}`, [
      [[], [], [], [], [], tokenAddrs],
      user,
    ]);
    let postBals = [];
    for (const token of tokenAddrs) {
      postBals.push((await getBalanceToken(token, user)).toString());
    }
    console.log('preBals', preBals);
    console.log('postBals', postBals);
  }
}
