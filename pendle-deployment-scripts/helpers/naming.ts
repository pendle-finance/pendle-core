export function getNameMarket(marketAddr: string) {
  return 'market' + marketAddr.substr(0, 8);
}

export function getNameLiqYT(marketAddr: string) {
  return 'LiqYT' + marketAddr.substr(0, 8);
}

export function getNameLiqOT(OTaddr: string) {
  return 'LiqOT' + OTaddr.substr(0, 8);
}

export function getNameLiqJLP(stakeToken: string) {
  return 'LiqJLP' + stakeToken.substr(0, 8);
}
