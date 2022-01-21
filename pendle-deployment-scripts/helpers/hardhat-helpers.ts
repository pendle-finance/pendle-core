import { assert } from 'chai';
import { BigNumber as BN } from 'ethers';
import hre, { ethers } from 'hardhat';
import { PendleEnv } from '../index';

export async function impersonateAccount(address: string) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
}

export async function impersonateAccountStop(address: string) {
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [address],
  });
}

export async function evm_snapshot() {
  return (await hre.network.provider.request({
    method: 'evm_snapshot',
    params: [],
  })) as string;
}

export async function evm_revert(snapshotId: string) {
  return (await hre.network.provider.request({
    method: 'evm_revert',
    params: [snapshotId],
  })) as string;
}

export async function advanceTime(duration: BN) {
  await hre.network.provider.send('evm_increaseTime', [duration.toNumber()]);
  await hre.network.provider.send('evm_mine', []);
}

export async function setTimeNextBlock(time: BN) {
  await hre.network.provider.send('evm_setNextBlockTimestamp', [time.toNumber()]);
}

export async function setTime(time: BN) {
  await hre.network.provider.send('evm_setNextBlockTimestamp', [time.toNumber()]);
  await hre.network.provider.send('evm_mine', []);
}

export async function advanceTimeAndBlock(time: BN, blockCount: number) {
  assert(blockCount >= 1);
  await advanceTime(time);
  await mineBlock(blockCount - 1);
}

export async function mineAllPendingTransactions() {
  let pendingBlock: any = await hre.network.provider.send('eth_getBlockByNumber', ['pending', false]);
  await mineBlock();
  pendingBlock = await hre.network.provider.send('eth_getBlockByNumber', ['pending', false]);
  assert(pendingBlock.transactions.length == 0);
}

export async function mineBlock(count?: number) {
  if (count == null) count = 1;
  while (count-- > 0) {
    await hre.network.provider.send('evm_mine', []);
  }
}

export async function minerStart() {
  await hre.network.provider.send('evm_setAutomine', [true]);
}

export async function minerStop() {
  await hre.network.provider.send('evm_setAutomine', [false]);
}

export async function getEth(user: string) {
  await hre.network.provider.send('hardhat_setBalance', [user, '0x56bc75e2d63100000000000000']);
}

export async function impersonateGov(env: PendleEnv) {
  await impersonateAccount(env.consts.common.GOVERNANCE_MULTISIG);
  env.deployer = await ethers.getSigner(env.consts.common.GOVERNANCE_MULTISIG);
  await getEth(env.deployer.address);
}

export async function impersonateSomeone(env: PendleEnv, user: string) {
  await impersonateAccount(user);
  env.deployer = await ethers.getSigner(user);
}
