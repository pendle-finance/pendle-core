import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { impersonateAccount } from '../../test/helpers';

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const selfFund = async (whaleAddress: string, tokenAddress: string, amount: BN) => {
    const token = await hre.ethers.getContractAt('IERC20', tokenAddress);
    console.log(`balance of whale    = ${await token.balanceOf(whaleAddress)}`);
    console.log(`balance of deployer = ${await token.balanceOf(deployer.address)}`);
    console.log(`amount              = ${amount}`);
    await impersonateAccount(whaleAddress);
    const whaleSigner = await hre.ethers.getSigner(whaleAddress);
    await token.connect(whaleSigner).transfer(deployer.address, amount);
  };
  const ONE_E_18 = BN.from(10).pow(18);

  // USDC
  // await selfFund('0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', BN.from(1000e6));
  //
  // // aUSDC
  // await selfFund('0x3ddfa8ec3052539b6c9549f12cea2c295cff5296', '0xbcca60bb61934080951369a648fb03df4f96263c', BN.from(1000e6));
  //
  // // aCRV
  // await selfFund('0x279a7dbfae376427ffac52fcb0883147d42165ff', '0x8dae6cb04688c62d939ed9b68d32bc62e49970b1', ONE_E_18.mul(1000));

  // cDAI
  await selfFund(
    '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4',
    '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
    BN.from(100000000).mul(1000)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
