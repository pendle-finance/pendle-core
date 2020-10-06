const Benchmark = artifacts.require("Benchmark");

const DUMMY_ADDRESS = "0xc783df8a850f42e7F7e57013759C285caa701eB6";

contract('Benchmark', function (accounts) {
  describe('test deploy', async function () {
    it('Contract can deploy', async function () {
      console.log(`accounts[0] = ${accounts[0]}`);
      // const benchmark = await Benchmark.new(DUMMY_ADDRESS);
    });
  });
});
