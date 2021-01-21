const shell = require('shelljs');

module.exports = {
  skipFiles: ['core/PendleTreasury.sol', 'core/PendleGovernance.sol', 'periphery/Timelock.sol', 'tokens/WETH9.sol', 'tokens/PDL.sol'],
  onCompileComplete: async function (_config) {
    await run("typechain");
  },
  // We need to do this because solcover generates bespoke artifacts.
  onIstanbulComplete: async function (_config) {
    shell.rm("-rf", "./artifacts"); // Or your config.paths.artifacts path
    shell.rm("-rf", "./typechain"); // Or the typechain `outDir` (if removable)
  },
};