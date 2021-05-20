import { runTest } from './common-test/aave-router-common-test';
describe('aaveV1-router', function () {
  runTest(true);
});
describe('aaveV2-router', function () {
  runTest(false);
});
