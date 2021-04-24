import { expect } from "chai";
import {
  BigNumber as BN,
  providers,
} from "ethers";

const hre = require("hardhat");


export async function impersonateAccount(address: String) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
}

export async function evm_snapshot(): Promise<string> {
  return await hre.network.provider.request({
    method: "evm_snapshot",
    params: [],
  });
}

export async function evm_revert(snapshotId: string) {
  return await hre.network.provider.request({
    method: "evm_revert",
    params: [snapshotId],
  });
}

export async function advanceTime(
  provider: providers.Web3Provider,
  duration: BN
) {
  await provider.send("evm_increaseTime", [duration.toNumber()]);
  await provider.send("evm_mine", []);
}

export async function setTimeNextBlock(
  provider: providers.Web3Provider,
  time: BN
) {
  await provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

export async function setTime(provider: providers.Web3Provider, time: BN) {
  await provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
  await provider.send("evm_mine", []);
}

export async function mineBlock(provider: providers.Web3Provider) {
  await provider.send("evm_mine", []);
}

export async function minerStart(provider: providers.Web3Provider) {
  await provider.send("evm_setAutomine", [true]);
}

export async function minerStop(provider: providers.Web3Provider) {
  await provider.send("evm_setAutomine", [false]);
}