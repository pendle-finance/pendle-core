import { BigNumber as BN, Wallet } from 'ethers';
import hre, { ethers } from 'hardhat';
import { amountToWei, getContract, PendleEnv, SimpleTokenType } from '../index';
import { assert } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AvaxConsts, Erc20Token, LpToken, MiscConsts } from '@pendle/constants';
import { getEth, impersonateAccount, impersonateAccountStop } from './hardhat-helpers';
import { sendAndWaitForTransaction } from './transaction-helpers';

export async function mintFromSource(user: Wallet | SignerWithAddress, amount: BN, token: Erc20Token): Promise<void> {
  amount = amountToWei(amount, token.decimal);
  let source = token.whale!;
  await getEth(source);
  await impersonateAccount(source);
  const signer = await hre.ethers.getSigner(source);
  const contractToken = await getContract('ERC20', token.address);
  let balanceOfSource: BN = await contractToken.balanceOf(source);
  assert(amount.lt(balanceOfSource), `Total amount of ${token.symbol!} minted exceeds limit`);
  await contractToken.connect(signer).transfer(user.address, amount);
  await impersonateAccountStop(source);
}

export async function getBalanceToken(
  _token: string | SimpleTokenType | Erc20Token | LpToken,
  user: string | SignerWithAddress
): Promise<BN> {
  if (typeof _token != 'string') {
    _token = _token.address;
  }
  if (typeof user != 'string') {
    user = user.address;
  }
  if (_token == AvaxConsts.tokens.NATIVE.address) {
    return await ethers.provider.getBalance(user);
  }
  let token = await getContract('ERC20', _token);
  return await token.balanceOf(user);
}

export async function approveInfinityIfNeed(env: PendleEnv, tokenAddr: string, to: string) {
  let token = await getContract('IERC20', tokenAddr);
  let curAllowance = await token.allowance(env.deployer.address, to);
  if (curAllowance.gt(MiscConsts.INF.div(2))) {
    console.log(`\t\t\tSkip unnecessary infinity approval of token ${tokenAddr} to ${to}`);
    return;
  }

  await sendAndWaitForTransaction(
    token.connect(env.deployer).approve,
    `infinity approve token ${tokenAddr} for ${to}`,
    [to, MiscConsts.INF]
  );
}

export async function approve(tokenAddr: string, to: string, amount: BN) {
  let token = await getContract('IERC20', tokenAddr);
  await sendAndWaitForTransaction(token.approve, `approve token ${tokenAddr} for ${amount.toString()}`, [to, amount]);
}
