// import {
//   address,
//   minerStart,
//   minerStop,
//   unlockedAccount,
//   mineBlock
// } from "../helpers";
import { expect } from "chai";
import MockPENDLE from "../../build/artifacts/contracts/mock/MockPENDLE.sol/MockPENDLE.json";
import { Contract, providers, Wallet, BigNumber as BN, utils } from "ethers";
import { errMsg, consts } from "../helpers";

const { waffle } = require("hardhat");
const { provider, deployContract } = waffle;

describe("Comp", () => {
  const wallets: Wallet[] = provider.getWallets();
  const [root, a1, a2, ...accounts] = wallets;

  const name = "Pendle";
  const symbol = "PENDLE";
  const initialSupply = BN.from("188700000000000000000000000");

  let chainId: number;
  let PENDLE: Contract;

  beforeEach(async () => {
    chainId = 1; // await web3.eth.net.getId(); See: https://github.com/trufflesuite/ganache-core/issues/515
    PENDLE = await await deployContract(root, MockPENDLE, [
      root.address,
      root.address,
      root.address,
      root.address,
      root.address,
    ]);
  });

  describe("metadata", () => {
    it("has given name", async () => {
      expect(await PENDLE.name()).to.be.equal(name);
    });

    it("has given symbol", async () => {
      expect(await PENDLE.symbol()).to.be.equal(symbol);
    });
  });

  describe("balanceOf", () => {
    it("grants to initial account", async () => {
      expect(await PENDLE.balanceOf(root.address)).to.be.equal(initialSupply);
    });
  });

  function bytes32(str: string) {
    return utils.formatBytes32String(str);
  }

  describe("delegateBySig", () => {
    const Domain = (comp: any) => ({
      name,
      chainId,
      verifyingContract: comp.address,
    });
    const Types = {
      Delegation: [
        { name: "delegatee", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "expiry", type: "uint256" },
      ],
    };

    it("reverts if the signatory is invalid", async () => {
      const delegatee = root,
        nonce = 0,
        expiry = 0;
      await expect(
        PENDLE.delegateBySig(
          delegatee.address,
          nonce,
          expiry,
          0,
          bytes32("bad"),
          bytes32("bad")
        )
      ).to.be.revertedWith(errMsg.INVALID_SIGNATURE);
    });

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root.address, nonce = 1, expiry = 0;
      const Data = { delegatee: delegatee, nonce: nonce, expiry: expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      await expect(PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith("INVALID_NONCE");
    });

    it('reverts if the signature has expired', async () => {
      const delegatee = root.address, nonce = 0, expiry = 0;
      const Data = { delegatee: delegatee, nonce: nonce, expiry: expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      await expect(PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith("SIGNATURE_EXPIRED");
    });

    it.only('delegates on behalf of the signatory', async () => {
      const delegatee = root.address, nonce = 0, expiry = 10e9;
      const Data = { delegatee: delegatee, nonce: nonce, expiry: expiry };
      const { v, r, s } = utils.splitSignature(await a1._signTypedData(Domain(PENDLE), Types, Data));
      console.log("106", root.address, a1.address);
      expect(await PENDLE.delegates(a1.address)).to.be.equal(consts.ZERO_ADDRESS);
      const tx = await PENDLE.delegateBySig(delegatee, nonce, expiry, v, r, s);
      expect(tx.gasUsed < 80000);
      expect(await PENDLE.delegates(a1.address)).to.be.equal(root.address);
    });
  });
});
