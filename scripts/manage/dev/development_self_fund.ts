import hre from 'hardhat';
import { BigNumber as BN } from 'ethers';
import { impersonateAccount } from '../../../test/helpers';
import { devConstants } from '../../helpers/constants';

async function main() {
  const [alice, bob, charlie] = await hre.ethers.getSigners();
  const selfFund = async (whaleAddress: string, tokenAddress: string, amount: BN) => {
    const token = await hre.ethers.getContractAt('IERC20', tokenAddress);
    console.log(`balance of whale    = ${await token.balanceOf(whaleAddress)}`);
    console.log(`balance of alice = ${await token.balanceOf(alice.address)}`);
    console.log(`amount              = ${amount}`);
    await alice.sendTransaction({ to: whaleAddress, value: BN.from(10).pow(18) });
    console.log('Sent ETH');
    await impersonateAccount(whaleAddress);
    const whaleSigner = await hre.ethers.getSigner(whaleAddress);
    for (const person of [alice, bob, charlie]) {
      await token.connect(whaleSigner).transfer(person.address, amount.div(3));
    }
  };

  const network = hre.network.name;
  if (network != 'development') {
    console.log(`\tThis script is for funding accounts in development !`);
    process.exit(1);
  }
  let consts = devConstants;

  // const ONE_E_18 = BN.from(10).pow(18);
  const USDC_WHALE = '0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2';
  const aUSDC_WHALE = '0x3ddfa8ec3052539b6c9549f12cea2c295cff5296';
  const cDAI_WHALE = '0x10bf1dcb5ab7860bab1c3320163c6dddf8dcc0e4';
  const INITIAL_USDC_AMOUNT = BN.from(3000000e6);
  const INITIAL_AUSDC_AMOUNT = BN.from(3000000e6);
  const INITIAL_CDAI_AMOUNT = BN.from(30000000e8);

  // USDC
  await selfFund(USDC_WHALE, consts.tokens.USDC.address, INITIAL_USDC_AMOUNT); // 30000
  //
  // // aUSDC
  await selfFund(aUSDC_WHALE, consts.tokens.AUSDC.address, INITIAL_AUSDC_AMOUNT); // 30000

  // cDAI
  await selfFund(cDAI_WHALE, consts.tokens.CDAI.address, INITIAL_CDAI_AMOUNT);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
