import { runTest } from '../core/common-test/marketEth-common-test';
import { checkDisabled, Mode } from '../fixtures/TestEnv';

describe('aaveV2-marketEth', function () {
  if (checkDisabled(Mode.AAVE_V2)) return;
  runTest(Mode.AAVE_V2);
});
describe('compound-marketEth', function () {
  if (checkDisabled(Mode.COMPOUND)) return;
  runTest(Mode.COMPOUND);
});
