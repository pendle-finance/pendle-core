import { runTest } from './common-test/witdrawal-common-test';
import { Mode } from './fixtures/TestEnv';
describe('aaveV2-withdrawal', function () {
    runTest(Mode.AAVE_V2);
});

describe('compound-withdrawal', function () {
    runTest(Mode.COMPOUND);
});
