import { runTest } from './liquidity-mining-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV1-liquidity-mining-rewards', function () {
  runTest(Mode.AAVE_V1);
});
