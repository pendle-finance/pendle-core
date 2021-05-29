import { runTest } from './common-test/liquidity-mining-lp-interest-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidityMining-lp-interest', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidityMining-lp-interest', function () {
  runTest(Mode.COMPOUND);
});
