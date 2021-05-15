import { runTest } from './common-test/aave-lp-interest-common-test';
describe('aaveV1-lp-interest', function () {
  runTest(true);
});
describe('aaveV2-lp-interest', function () {
  runTest(false);
});