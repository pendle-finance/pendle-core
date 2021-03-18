// SPDX-License-Identifier: agpl-3.0
// The library is copied from Aave: https://github.com/aave/protocol-v2/blob/master/contracts/protocol/libraries/math/WadRayMath.sol
// with the exception of smooth functon

pragma solidity 0.7.6;

import {Errors} from "./AaveErrors.sol";

library WadRayMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant halfWAD = WAD / 2;

    uint256 internal constant RAY = 1e27;
    uint256 internal constant halfRAY = RAY / 2;

    uint256 internal constant WAD_RAY_RATIO = 1e9;

    /**
     * @return One ray, 1e27
     **/
    function ray() internal pure returns (uint256) {
        return RAY;
    }

    /**
     * @return One wad, 1e18
     **/

    function wad() internal pure returns (uint256) {
        return WAD;
    }

    /**
     * @return Half ray, 1e27/2
     **/
    function halfRay() internal pure returns (uint256) {
        return halfRAY;
    }

    /**
     * @return Half ray, 1e18/2
     **/
    function halfWad() internal pure returns (uint256) {
        return halfWAD;
    }

    /**
     * @dev Multiplies two wad, rounding half up to the nearest wad
     * @param a Wad
     * @param b Wad
     * @return The result of a*b, in wad
     **/
    function wadMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) {
            return 0;
        }

        require(a <= (type(uint256).max - halfWAD) / b, Errors.MATH_MULTIPLICATION_OVERFLOW);

        return (a * b + halfWAD) / WAD;
    }

    /**
     * @dev Divides two wad, rounding half up to the nearest wad
     * @param a Wad
     * @param b Wad
     * @return The result of a/b, in wad
     **/
    function wadDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, Errors.MATH_DIVISION_BY_ZERO);
        uint256 halfB = b / 2;

        require(a <= (type(uint256).max - halfB) / WAD, Errors.MATH_MULTIPLICATION_OVERFLOW);

        return (a * WAD + halfB) / b;
    }

    /**
     * @dev Multiplies two ray, rounding half up to the nearest ray
     * @param a Ray
     * @param b Ray
     * @return The result of a*b, in ray
     **/
    function rayMul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0 || b == 0) {
            return 0;
        }

        require(a <= (type(uint256).max - halfRAY) / b, Errors.MATH_MULTIPLICATION_OVERFLOW);

        return (a * b + halfRAY) / RAY;
    }

    /**
     * @dev Divides two ray, rounding half up to the nearest ray
     * @param a Ray
     * @param b Ray
     * @return The result of a/b, in ray
     **/
    function rayDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b != 0, Errors.MATH_DIVISION_BY_ZERO);
        uint256 halfB = b / 2;

        require(a <= (type(uint256).max - halfB) / RAY, Errors.MATH_MULTIPLICATION_OVERFLOW);

        return (a * RAY + halfB) / b;
    }

    /**
     * @dev find the smallest res that rayDiv(dividen,divisor) = rayDiv(res,divisor);
     * @dev the formula used it's the exact reverse of rayDiv's formula
     **/
    function smooth(uint256 dividen, uint256 divisor) internal pure returns (uint256) {
        uint256 rayQuotient = rayDiv(dividen, divisor);
        uint256 halfDivisor = divisor / 2;

        require(
            rayQuotient <= (type(uint256).max - (RAY - 1)) / divisor,
            Errors.MATH_MULTIPLICATION_OVERFLOW
        );
        uint256 res = rayQuotient * divisor + RAY - 1;
        if (res < halfDivisor) {
            res = 0;
        } else {
            res = (res - halfDivisor) / RAY;
        }
        assert(rayDiv(res, divisor) == rayQuotient); // should be deleted when merged
        return res;
    }

    /**
     * @dev Casts ray down to wad
     * @param a Ray
     * @return a casted to wad, rounded half up to the nearest wad
     **/
    function rayToWad(uint256 a) internal pure returns (uint256) {
        uint256 halfRatio = WAD_RAY_RATIO / 2;
        uint256 result = halfRatio + a;
        require(result >= halfRatio, Errors.MATH_ADDITION_OVERFLOW);

        return result / WAD_RAY_RATIO;
    }

    /**
     * @dev Converts wad up to ray
     * @param a Wad
     * @return a converted in ray
     **/
    function wadToRay(uint256 a) internal pure returns (uint256) {
        uint256 result = a * WAD_RAY_RATIO;
        require(result / WAD_RAY_RATIO == a, Errors.MATH_MULTIPLICATION_OVERFLOW);
        return result;
    }
}
