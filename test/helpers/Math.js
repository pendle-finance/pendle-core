const BN = web3.utils.BN;
const {constants} = require('./Constants');

function getTokenAmount(tokenSymbol, amount) {
  const multipliers = {
    USDT: new BN(1000000),
  };

  // console.log(`multiplier = ${multipliers[tokenSymbol]}, amount = ${amount}`);
  return multipliers[tokenSymbol].mul(new BN(amount));
}

module.exports = {getTokenAmount};
