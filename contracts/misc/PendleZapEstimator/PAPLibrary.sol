// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.7.6;
pragma abicoder v2;

import "../../libraries/MathLib.sol";
import "../../libraries/JoeLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// solhint-disable

struct PAPReserves {
    uint256 wavax;
    uint256 pendle;
}

library PAPLib {
    using SafeMath for uint256;
    using Math for uint256;

    address internal constant PAP_ADDR = 0x3acD2FF1c3450bc8a9765AfD8d0DeA8E40822c86;
    address public constant PENDLE = 0xfB98B335551a418cD0737375a2ea0ded62Ea213b;

    // fetches and sorts the reserves for a pair
    function getReserves(
        address factory,
        address tokenA,
        address tokenB,
        PAPReserves memory pap
    ) internal view returns (uint256 reserveA, uint256 reserveB) {
        address pair = JoeLibrary.pairFor(factory, tokenA, tokenB);
        if (pair == PAP_ADDR) {
            return tokenA == PENDLE ? (pap.pendle, pap.wavax) : (pap.wavax, pap.pendle);
        }
        return JoeLibrary.getReserves(factory, tokenA, tokenB);
    }

    // given a pair and amount in for 2 tokens, returns number of LP minted
    function getAmountLpOut(
        PAPReserves memory pap,
        uint256 amountWavax,
        uint256 amountPendle
    ) internal view returns (uint256 lpOut) {
        IJoePair pair = IJoePair(PAP_ADDR);
        uint256 totalSupply = pair.totalSupply();
        return
            Math.min(
                amountWavax.mul(totalSupply) / pap.wavax,
                amountPendle.mul(totalSupply) / pap.pendle
            );
    }

    // given a pair, returns exchange rate
    function getExchangeRate(PAPReserves memory pap) internal view returns (uint256 rate) {
        (uint256 reserve0, uint256 reserve1) = (pap.wavax, pap.pendle);
        uint256 currentK = Math.sqrt(reserve0.mul(reserve1));
        uint256 totalSupply = IJoePair(PAP_ADDR).totalSupply();
        rate = currentK.rdiv(totalSupply);
    }

    function isSwapAvaxToPendle(address[] memory path) internal pure returns (bool) {
        return path.length >= 2 && path[path.length - 1] == PENDLE;
    }

    function isSwapPendleToAvax(address[] memory path) internal pure returns (bool) {
        return path.length == 2 && path[0] == PENDLE;
    }
}
