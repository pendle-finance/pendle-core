import { runTest } from './common-test/aave-forge-fee-common-test';
describe('aaveV1-forge-fee', function () {
  runTest(true);
});
describe('aaveV2-forge-fee', function () {
  runTest(false);
});
