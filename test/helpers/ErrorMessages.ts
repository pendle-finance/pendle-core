const prefix = "VM Exception while processing transaction: revert";
export const errMsg = {
  NEGATIVE_ALLOWANCE: prefix + " " + "NEGATIVE_ALLOWANCE",
  BURN_EXCEED_BALANCE: prefix + " " + "BURN_EXCEED_BALANCE",
  TRANSFER_EXCEED_BALANCE: prefix + " " + "TRANSFER_EXCEED_BALANCE",
  TRANSFER_EXCEED_ALLOWANCE: prefix + " " + "TRANSFER_EXCEED_ALLOWANCE",
  BURN_TO_ZERO_ADDR: prefix + " " + "BURN_TO_ZERO_ADDR",
  MINT_TO_ZERO_ADDR: prefix + " " + "MINT_TO_ZERO_ADDR",
  SPENDER_ZERO_ADDR: prefix + " " + "SPENDER_ZERO_ADDR",
  SENDER_ZERO_ADDR: prefix + " " + "SENDER_ZERO_ADDR",
  RECEIVER_ZERO_ADDR: prefix + " " + "RECEIVER_ZERO_ADDR",
  OWNER_ZERO_ADDR: prefix + " " + "OWNER_ZERO_ADDR",
};
