import { BigNumber as BN } from "ethers";
import MockMathLibrary from "../../build/artifacts/contracts/mock/MockMathLibrary.sol/MockMathLibrary.json";
import Math from '../../build/artifacts/contracts/libraries/MathLib.sol/Math.json';

const { waffle } = require("hardhat");
const { provider, deployContract, link } = waffle;

it("test 1", async () => {
  const wallets = provider.getWallets();
  const [alice, bob] = wallets;

  let myLibrary = await deployContract(alice, Math, []);
  console.log(await myLibrary.rpow(BN.from(2197099110203), BN.from(549755813888)));
  // await mock.rpow(BN.from(2826053734965), BN.from(549755813888));
  // await mock.rpow(BN.from(2197099110203), BN.from(549755813888));
  // await mock.rpowi(BN.from(2197099110203), BN.from(0));
});
