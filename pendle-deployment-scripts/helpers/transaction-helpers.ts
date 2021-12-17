import hre from 'hardhat';

export async function sendAndWaitForTransaction(
  transaction: any,
  transactionDescription: string,
  args: any[]
): Promise<string> {
  const tx = await transaction(...args);
  // console.log({ description: { transactionDescription }, data: tx.data, to: tx.to });
  console.log(`\t\t\t[Broadcasted] transaction: ${transactionDescription}: ${tx.hash}, nonce:${tx.nonce}`);
  await hre.ethers.provider.waitForTransaction(tx.hash);
  console.log(`\t\t\t[Confirmed] transaction: ${transactionDescription}`);
  return tx.hash;
}
