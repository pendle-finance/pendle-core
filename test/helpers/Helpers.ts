import { Contract, Wallet, providers, BigNumber } from 'ethers'
import TetherToken from "../../artifacts/contracts/interfaces/IUSDT.sol/IUSDT.json";
import ERC20 from "../../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json";
import {aaveFixture} from "../core/fixtures/aave.fixture";
import AToken from "../../artifacts/contracts/interfaces/IAToken.sol/IAToken.json";

const hre = require('hardhat');

import {constants, Token} from "./Constants"

type MutyiplierMap = Record<string, BigNumber>;

export async function impersonateAccount(address: String ) {
    await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
    });
}

export async function mint(provider: providers.Web3Provider, token: Token, wallet: Wallet, amount: BigNumber) {
    await impersonateAccount(token.owner!)
    const signer = await provider.getSigner(token.owner!);

    const contractToken = new Contract(token.address, TetherToken.abi, signer);
    const tokenAmount = amountToWei(token, amount);
    await contractToken.issue(tokenAmount);
    await contractToken.transfer(wallet.address, tokenAmount);
}

export async function mintAaveToken(token: Token,  wallet: Wallet, amount: BigNumber) {
  const {lendingPool} = await aaveFixture(wallet);
  const tokenAmount = amountToWei(token, amount); 

  const erc20 = new Contract(token.address, ERC20.abi, wallet);
  await erc20.approve(constants.AAVE_LENDING_POOL_CORE_ADDRESS, constants.MAX_ALLOWANCE);  

  await lendingPool.deposit(token.address, tokenAmount, 0);
}

export async function getAContract(wallet: Wallet, lendingPoolCore: Contract, token: Token) : Promise<Contract> {
  const aTokenAddress = await lendingPoolCore.getReserveATokenAddress(token.address);
  return new Contract(aTokenAddress, AToken.abi, wallet);
}

export function amountToWei({decimal}: Token, amount: BigNumber) {
    return BigNumber.from(10 ** decimal).mul(amount);
  }
