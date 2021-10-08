const { expect } = require('chai');

let uncleGrandpa, pausingManagerMain, pausingManagerLiqV1, pausingManagerLiqV2, onePause, governance;

async function getEth(user) {
  if (user == ETH_SOURCE) return;
  await impersonateAccount(ETH_SOURCE);
  const signer = await ethers.provider.getSigner(ETH_SOURCE);
  const txn = await signer.sendTransaction({
    to: user,
    value: ethers.utils.parseEther('100.0'),
  });
  await impersonateAccountStop(ETH_SOURCE);
}

async function impersonateAccount(address) {
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
}

async function impersonateAccountStop(address) {
  await hre.network.provider.request({
    method: 'hardhat_stopImpersonatingAccount',
    params: [address],
  });
}

async function deployOnePause() {
  const OnePause = await hre.ethers.getContractFactory('PendleOnePause');
  onePause = await OnePause.deploy('0x0EF44218209D7d64737dD36f179d5e448df3EEd4');
  onePause.deployed();
  console.log(`OnePause deployed at ${onePause.address}`);
}

async function getContract(name, addr) {
  return await ethers.getContractAt(name, addr);
}

async function init() {
  await impersonateAccount(LONG_ADDR);
  uncleGrandpa = await ethers.getSigner(LONG_ADDR);
  await deployOnePause();

  await impersonateAccount(GOVERNANCE_ADDR);
  governance = await ethers.getSigner(GOVERNANCE_ADDR);

  await getEth(governance.address);

  console.log('Done topping up ETH');

  pausingManagerMain = await ethers.getContractAt('PendlePausingManager', PAUSING_MANAGER_MAIN_ADDR);
  await pausingManagerMain.connect(governance).setPausingAdmin(onePause.address, true);

  console.log('Done setPausingAdmin for pausingManagerMain');

  pausingManagerLiqV1 = await ethers.getContractAt('PendlePausingManager', PAUSING_MANAGER_LIQ_V1);
  await pausingManagerLiqV1.connect(governance).setPausingAdmin(onePause.address, true);

  console.log('Done setPausingAdmin for pausingManagerLiqV1');

  pausingManagerLiqV2 = await ethers.getContractAt('PendlePausingManager', PAUSING_MANAGER_LIQ_V2);
  await pausingManagerLiqV2.connect(governance).setPausingAdmin(onePause.address, true);

  console.log('Done setPausingAdmin for pausingManagerLiqV2');
}

async function doPause() {
  await onePause.connect(uncleGrandpa).pauseByData(pauseData);
}

async function checkAllForgePaused() {
  console.log('Forge pause status');
  let AaveV2Status = (await pausingManagerMain.callStatic.checkYieldContractStatus(AAVE_V2_FORGE_ID, USDC_ADDRESS, 0))
    ._paused;
  let CompoundV1Status = (
    await pausingManagerMain.callStatic.checkYieldContractStatus(COMPOUND_V1_FORGE_ID, USDC_ADDRESS, 0)
  )._paused;
  // let CompoundV2Status = (await pausingManagerMain.callStatic.checkYieldContractStatus(COMPOUND_V2_FORGE_ID, USDC_ADDRESS, 0))._paused)
  // .to.be.true;
  let SushiSimpleStatus = (
    await pausingManagerMain.callStatic.checkYieldContractStatus(SUSHISWAP_SIMPLE_FORGE_ID, USDC_ADDRESS, 0)
  )._paused;
  let SushiComplexStatus = (
    await pausingManagerMain.callStatic.checkYieldContractStatus(SUSHISWAP_COMPLEX_FORGE_ID, USDC_ADDRESS, 0)
  )._paused;

  console.log(
    `status AaveV2:${AaveV2Status} CompoundV1:${CompoundV1Status} SushiSimple:${SushiSimpleStatus} SushiComplex:${SushiComplexStatus}`
  );
}

async function checkAllMarketPaused() {
  console.log('Market pause status');
  let AaveV2Status = (await pausingManagerMain.callStatic.checkMarketStatus(AAVE_V2_MARKET_ID, ZERO_ADDRESS))._paused;
  let CompoundV1Status = (await pausingManagerMain.callStatic.checkMarketStatus(COMPOUND_V1_MARKET_ID, ZERO_ADDRESS))
    ._paused;
  let GenericStatus = (await pausingManagerMain.callStatic.checkMarketStatus(GENERIC_MARKET_ID, ZERO_ADDRESS))._paused;
  console.log(`status AaveV2:${AaveV2Status} CompoundV1:${CompoundV1Status} Generic:${GenericStatus}`);
}

async function checkAllLiqV1Paused() {
  console.log('Liquidity Mining V1 pause status');
  for (let addr of LIQ_V1_ADDRESSES) {
    console.log(`status ${addr}: ${(await pausingManagerLiqV1.callStatic.checkLiqMiningStatus(addr))._paused}`);
  }
}

async function checkAllLiqV2Paused() {
  console.log('Liquidity Mining V2 pause status');
  for (let addr of LIQ_V2_ADDRESSES) {
    console.log(`status ${addr}: ${(await pausingManagerLiqV2.callStatic.checkLiqMiningStatus(addr))._paused}`);
  }
}

async function checkAll() {
  await checkAllForgePaused();
  await checkAllMarketPaused();
  await checkAllLiqV1Paused();
  await checkAllLiqV2Paused();
}

ETH_SOURCE = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';
PAUSING_MANAGER_MAIN_ADDR = '0x0EF44218209D7d64737dD36f179d5e448df3EEd4';
PAUSING_MANAGER_LIQ_V1 = '0xea2575F82C881b223208FA53982e6e09aB55CcDa';
PAUSING_MANAGER_LIQ_V2 = '0x4dc6b6374e812E029937129a156Eec6344cDE8D1';

LONG_ADDR = '0xA338cC7070F8efe4ae2EBf71e819F96FEFCb128e';
GOVERNANCE_ADDR = '0x8119ec16f0573b7dac7c0cb94eb504fb32456ee1';
AAVE_V2_FORGE_ID = ethers.utils.formatBytes32String('AaveV2');
COMPOUND_V1_FORGE_ID = ethers.utils.formatBytes32String('CompoundV2');
COMPOUND_V2_FORGE_ID = ethers.utils.formatBytes32String('CompoundV2Upgraded');
SUSHISWAP_SIMPLE_FORGE_ID = ethers.utils.formatBytes32String('SushiswapSimple');
SUSHISWAP_COMPLEX_FORGE_ID = ethers.utils.formatBytes32String('SushiswapComplex');
COMPOUND_V1_MARKET_ID = ethers.utils.formatBytes32String('Compound');
AAVE_V2_MARKET_ID = ethers.utils.formatBytes32String('Aave');
GENERIC_MARKET_ID = ethers.utils.formatBytes32String('Generic');
ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
RANDOM_ADDRESS = '0x0000000000000000000000000000000000000123';
USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
LIQ_V1_ADDRESSES = [
  '0x6f40A68E99645C60F14b497E75aE024777d61726',
  '0x5B1C59Eb6872f88a92469751a034B9B5ADA9A73F',
  '0xA78029ab5235B9A83EC45eD036042Db26c6E4300',
  '0x0F3BCcBfEF1dC227f33A11d7a51cD02DEaD208c8',
];

LIQ_V2_ADDRESSES = [
  '0xFb0e378b3eD6D7F8b73230644D945E28fd7F7b03',
  '0x07C87cfE096c417212eAB4152d365F0F7dC6FCe4',
  '0x071dc669Be57C1b3053F746Db20cb3Bf54383aeA',
  '0xa660c9aAa46b696Df01768E1D2d88CE2d5293778',
  '0x529c513DDE7968E19E79e38Ff94D36e4C3c21Eb7',
  '0x309d8Cf8f7C3340b50ff0ef457075A3c5792203f',
];
pauseData = [
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x43023df241617665563200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x43023df2436f6d706f756e645632000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x920be2d341617665000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x920be2d3436f6d706f756e640000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0xea2575F82C881b223208FA53982e6e09aB55CcDa',
    '0xace8fcf10000000000000000000000006f40a68e99645c60f14b497e75ae024777d617260000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0xea2575F82C881b223208FA53982e6e09aB55CcDa',
    '0xace8fcf10000000000000000000000005b1c59eb6872f88a92469751a034b9b5ada9a73f0000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x43023df253757368697377617053696d706c6500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x43023df2537573686973776170436f6d706c6578000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x0EF44218209D7d64737dD36f179d5e448df3EEd4',
    '0x920be2d347656e65726963000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0xea2575F82C881b223208FA53982e6e09aB55CcDa',
    '0xace8fcf10000000000000000000000000f3bccbfef1dc227f33a11d7a51cd02dead208c80000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0xea2575F82C881b223208FA53982e6e09aB55CcDa',
    '0xace8fcf1000000000000000000000000a78029ab5235b9a83ec45ed036042db26c6e43000000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf1000000000000000000000000529c513dde7968e19e79e38ff94d36e4c3c21eb70000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf1000000000000000000000000309d8cf8f7c3340b50ff0ef457075a3c5792203f0000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf1000000000000000000000000071dc669be57c1b3053f746db20cb3bf54383aea0000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf1000000000000000000000000a660c9aaa46b696df01768e1d2d88ce2d52937780000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf100000000000000000000000007c87cfe096c417212eab4152d365f0f7dc6fce40000000000000000000000000000000000000000000000000000000000000001',
  ],
  [
    '0x4dc6b6374e812E029937129a156Eec6344cDE8D1',
    '0xace8fcf1000000000000000000000000fb0e378b3ed6d7f8b73230644d945e28fd7f7b030000000000000000000000000000000000000000000000000000000000000001',
  ],
];

// async function main() {
//   console.log(pauseData[0].length);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });
