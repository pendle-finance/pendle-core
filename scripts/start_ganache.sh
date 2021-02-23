usdt_owner="0xC6CDE7C39eB2f0F0095F41570af89eFC2C1Ea828"
some_other_address="0x000DE7C39eB2f0F0095F41570af89eFC2C1Ea000"
addresses=$usdt_owner

command="./node_modules/.bin/ganache-cli --fork https://eth-mainnet.alchemyapi.io/v2/$ALCHEMY_KEY --secure --unlock $addresses -u 0 -u 1 -u 2 --networkId 1 --gasLimit 12500000"
echo "Running $command"
$command
