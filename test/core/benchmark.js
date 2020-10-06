const Benchmark = artifacts.require("Benchmark");

contract('Benchmark', function (accounts) {
  describe('test deploy', async function () {
    it('Contract can deploy', async function () {
      const benchmark = await Benchmark.new(accounts[0]);
    });
  });
});
