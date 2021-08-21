import { BigNumber as BN } from 'ethers';
import { TestEnv } from '../../fixtures';
import {
  addMarketLiquidityDual,
  approxBigNumber,
  bootstrapMarket,
  consts,
  randomNumber,
  setTimeNextBlock,
  swapExactInTokenToXyt,
  swapExactInXytToToken,
} from '../../helpers';

export async function MultiExpiryMarketTest(environments: TestEnv[], wallets: any) {
  const [alice, bob, charlie, dave] = wallets;
  let nMarket = environments.length;
  const env0 = environments[0];

  const amount = BN.from(10 ** 9);
  for (let m = 0; m < nMarket; ++m) {
    await bootstrapMarket(environments[m], dave, amount, amount);
  }

  let currentTime = (await env0.testToken.getTime(consts.HG)).sub(env0.T0);

  async function checkOutcome(outcomes: any) {
    for (let i = 0; i + 1 < nMarket; ++i) {
      for (let j = 0; j < outcomes[i].length; ++j) {
        approxBigNumber(outcomes[i][j], outcomes[i + 1][j], BN.from(10), false);
      }
    }
    console.log('Checked', outcomes[0].length, 'actions!');
  }

  async function doMarketActions(env: TestEnv, scenario: number[][]) {
    const amount = BN.from(10 ** 6);
    let actors = [alice, bob];
    let actions = [swapExactInXytToToken, swapExactInTokenToXyt, addMarketLiquidityDual];

    let outcome = [];
    for (let i = 0; i < scenario.length; ++i) {
      let [x, y] = scenario[i];
      outcome.push(await actions[y](env, actors[x], amount));
      outcome.push(await actions[y](env, charlie, amount));
    }
    return outcome;
  }

  async function generateRandomScenario(nActions: number) {
    let scenario: number[][] = [];
    for (let i = 0; i < nActions; ++i) {
      /// 2 person alice and bob
      /// 3 actions swapxyt, swaptoken and add_dual
      scenario.push([randomNumber(2), randomNumber(3)]);
    }
    return scenario;
  }

  while (consts.SIX_MONTH.gt(currentTime.add(60).mul(2))) {
    let scenario = await generateRandomScenario(randomNumber(6) + 5);
    let outcomes = [];

    for (let j = 0; j < nMarket; ++j) {
      if (j == 0) currentTime = currentTime.add(60);
      else currentTime = currentTime.mul(2);
      await setTimeNextBlock(env0.T0.add(currentTime));
      outcomes.push(await doMarketActions(environments[j], scenario));
    }
    await checkOutcome(outcomes);
  }
}
