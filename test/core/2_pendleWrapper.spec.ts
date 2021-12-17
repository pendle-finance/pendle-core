import { checkDisabled, Mode } from '../fixtures/TestEnv';
import { runTest } from './common-test/pendle-wrapper/pendle-wrapper-test';

describe('pendleWrapper-xJoe', function () {
  if (checkDisabled(Mode.XJOE)) return;
  runTest(Mode.XJOE);
});

describe('pendleWrapper-TraderJoe', function () {
  if (checkDisabled(Mode.TRADER_JOE)) return;
  runTest(Mode.TRADER_JOE);
});

describe('pendleWrapper-BENQI', function () {
  if (checkDisabled(Mode.BENQI)) return;
  runTest(Mode.BENQI);
});

describe('pendleWrapper-WONDERLAND', function () {
  if (checkDisabled(Mode.WONDERLAND)) return;
  runTest(Mode.WONDERLAND);
});
