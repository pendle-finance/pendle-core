import { runTest } from './common-test/aave-market-common-test';
describe('aaveV1-market', function () {
  runTest(true);
});
describe('aaveV2-market', function () {
  runTest(false);
});