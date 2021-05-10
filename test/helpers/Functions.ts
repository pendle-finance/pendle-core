import { BigNumber as BN, Contract, Wallet } from "ethers";
import { TestEnv } from "../core/fixtures";
import { tokens, consts, Token } from "./Constants";

let USDT: Token = tokens.USDT;

export async function tokenizeYield(env: TestEnv, user: Wallet, amount: BN, to?: Wallet): Promise<BN> {
  if (to == null) {
    to = user;
  }
  let amountTokenMinted = await env.ot.balanceOf(to.address);
  await env.router
    .connect(user)
    .tokenizeYield(
      env.FORGE_ID,
      USDT.address,
      env.EXPIRY,
      amount,
      to.address,
      consts.HIGH_GAS_OVERRIDE
    );
  amountTokenMinted = (await env.ot.balanceOf(to.address)).sub(
    amountTokenMinted
  );
  return amountTokenMinted;
}

export async function redeemDueInterests(env: TestEnv, user: Wallet, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router.connect(user).redeemDueInterests(
    env.FORGE_ID,
    USDT.address,
    expiry,
    user.address
  );
}

export async function redeemAfterExpiry(env: TestEnv, user: Wallet, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router.connect(user).redeemAfterExpiry(
    env.FORGE_ID,
    USDT.address,
    expiry
  );
}

export async function redeemUnderlying(env: TestEnv, user: Wallet, amount: BN, expiry?: BN) {
  if (expiry == null) {
    expiry = env.EXPIRY;
  }
  await env.router.connect(user).redeemUnderlying(
    env.FORGE_ID,
    USDT.address,
    expiry,
    amount,
    consts.HIGH_GAS_OVERRIDE
  );
}

