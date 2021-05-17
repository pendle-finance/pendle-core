import { runTest } from './common-test/liquidity-mining-lp-interest-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV1-liquidityMining-lp-interest', function () {
  runTest(Mode.AAVE_V1);
});
describe('compound-liquidityMining-lp-interest', function () {
  runTest(Mode.COMPOUND);
});
