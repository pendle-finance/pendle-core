const LendingPoolCore = artifacts.require("LendingPoolCore");

async function getContracts() {
  return {
    lendingPoolCore: await LendingPoolCore.at("0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3")
  };
}

module.exports = { getContracts }
