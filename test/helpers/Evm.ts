import { expect } from "chai";
import { BigNumber as BN, providers } from "ethers";

const hre = require("hardhat");
const { waffle } = require("hardhat");
const { provider } = waffle;

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

export async function advanceTime(duration: BN) {
  await provider.send("evm_increaseTime", [duration.toNumber()]);
  await provider.send("evm_mine", []);
}

export async function setTimeNextBlock(time: BN) {
  await provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
}

export async function setTime(time: BN) {
  await provider.send("evm_setNextBlockTimestamp", [time.toNumber()]);
  await provider.send("evm_mine", []);
}

export async function mineBlock() {
  await provider.send("evm_mine", []);
}

export async function minerStart() {
  await provider.send("evm_setAutomine", [true]);
}

export async function minerStop() {
  await provider.send("evm_setAutomine", [false]);
}
