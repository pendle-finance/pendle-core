import { runTest } from './common-test/liquidity-mining-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-liquidity-mining-rewards', function () {
  runTest(Mode.AAVE_V2);
});
describe('compound-liquidity-mining-rewards', function () {
  runTest(Mode.COMPOUND);
});
