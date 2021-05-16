import { runTest } from './common-test/aave-xyt-interest-common-test';
describe('aaveV1-xyt-interest', function () {
  runTest(true);
});
describe('aaveV2-xyt-interest', function () {
  runTest(false);
});
