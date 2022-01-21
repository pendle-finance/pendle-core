import { PendleEnv } from '../index';
import { sendAndWaitForTransaction } from '../helpers';

export async function doInfinityApproveWrapper(
  env: PendleEnv,
  approvalData: {
    token: string;
    to: string;
  }[]
) {
  await sendAndWaitForTransaction(env.pendleWrapper.infinityApprove, 'infinityApprove for wrapper', [approvalData]);
}

export async function addToWhitelist(env: PendleEnv, contracts: string[]) {
  await sendAndWaitForTransaction(env.pendleWhitelist.connect(env.deployer).addToWhitelist, 'add contract whitelist', [
    contracts,
  ]);
}
