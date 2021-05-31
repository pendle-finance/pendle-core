import { runTest } from './common-test/liquidity-emmergency-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV1-liquidityMining-emergency', function () {
  runTest(Mode.AAVE_V1);
});
describe('compound-liquidityMining-emergency', function () {
  runTest(Mode.COMPOUND);
});
