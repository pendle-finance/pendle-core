import { runTest } from './liquidity-mining-rewards-common-test';
import { Mode } from './fixtures/TestEnv';
describe('compound-liquidity-mining-rewards', function () {
  runTest(Mode.COMPOUND);
});
