import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber as BN } from 'ethers';
import { Erc20Token, MiscConsts } from '@pendle/constants';
import { getContract, getEth, impersonateAccount, impersonateAccountStop } from '../pendle-deployment-scripts';
import hre from 'hardhat';
import { assert } from 'chai';
import { DataAddLiqJoeStruct } from '../typechain-types/PendleWrapper';

export async function mintFromSource(user: SignerWithAddress, amount: BN, token: Erc20Token): Promise<void> {
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

export function getEmptyDataAddLiqJoe(): DataAddLiqJoeStruct {
  return {
    tokenA: MiscConsts.ZERO_ADDRESS,
    tokenB: MiscConsts.ZERO_ADDRESS,
    amountADesired: 0,
    amountBDesired: 0,
    amountAMin: 0,
    amountBMin: 0,
    deadline: 0,
  };
}
