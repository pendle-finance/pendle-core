const prefix = "VM Exception while processing transaction: revert";
export const errMsg = {
  NEGATIVE_ALLOWANCE: prefix + " " + "allowance < 0",
  BURN_EXCEED_BALANCE: prefix + " " + "burn > balance",
  TRANSFER_EXCEED_BALANCE: prefix + " " + "transfer > balance",
  TRANSFER_EXCEED_ALLOWENCE: prefix + " " + "transfer > allowance",
  BURN_TO_ZERO_ADDR: prefix + " " + "burn to zero address",
  MINT_TO_ZERO_ADDR: prefix + " " + "mint to zero address",
  SPENDER_ZERO_ADDR: prefix + " " + "spender zero address",
  SENDER_ZERO_ADDR: prefix + " " + "sender zero address",
  RECEIVER_ZERO_ADDR: prefix + " " + "receiver zero address",
  OWNER_ZERO_ADDR: prefix + " " + "owner zero address",
};
