import { runTest } from './common-test/liquidity-mining-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV1-liquidity-mining-rewards', function () {
  runTest(Mode.AAVE_V1);
});
describe('compound-liquidity-mining-rewards', function () {
  runTest(Mode.COMPOUND);
});
