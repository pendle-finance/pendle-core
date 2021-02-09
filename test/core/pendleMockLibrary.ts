import { Contract, Wallet, providers, BigNumber as BN } from "ethers";
import MockLibrary from "../../build/artifacts/contracts/mock/MockLibrary.sol/MockLibrary.json";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

it("test 1", async () => {
  const wallets = provider.getWallets();
  const [alice, bob] = wallets;
  const mock = await deployContract(alice, MockLibrary);
  await mock.rpowApprox(BN.from(2197099110203), BN.from(549755813888));
  // await mock.rpow(BN.from(2197099110203), BN.from(549755813888));
  // await mock.rpowi(BN.from(2197099110203), BN.from(0));
});
