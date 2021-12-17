import { PendleEnv } from '../type';
import { web3 } from 'hardhat';
import { BigNumber as BN, BigNumberish } from 'ethers';

export function isOToffchain(env: PendleEnv, tokenAddr: string) {
  for (let forgeId in env.forgeMap) {
    let forge = env.forgeMap[forgeId];
    for (let yieldContract of forge.yieldContracts) {
      if (yieldContract.OT.address == tokenAddr) {
        return true;
      }
    }
  }
  return false;
}

export function amountToWei(amount: BigNumberish, decimal: BigNumberish) {
  return BN.from(10).pow(decimal).mul(amount);
}

export function weiToAmount(amount: BigNumberish, decimal: BigNumberish) {
  return BN.from(amount).div(BN.from(10).pow(decimal));
}

export function hexToString(inp: string) {
  return web3.utils.hexToString(inp);
}

export function convertUnixToDate(UNIX_timestamp: number) {
  const a = new Date(UNIX_timestamp * 1000);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const year = a.getFullYear();
  const month = months[a.getMonth()];
  const date = a.getDate();
  return `${date}_${month}_${year}`;
}
