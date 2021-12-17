// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./MathLib.sol";
import "./TokenUtilsLib.sol";

struct PairUints {
    uint256 uintA;
    uint256 uintB;
}

struct PairTokens {
    address tokenA;
    address tokenB;
}

struct PairTokenUints {
    PairTokens tokens;
    PairUints uints;
}

library PairTokensLib {
    using SafeMath for uint256;
    using Math for uint256;
    using TokenUtils for IERC20;

    address internal constant ZERO = address(0);

    function verify(PairTokens memory a) internal pure {
        if (a.tokenA != ZERO) require(a.tokenA != a.tokenB, "DUPLICATED_TOKENS");
    }

    function safeTransferFrom(
        PairTokens memory tokens,
        address from,
        address to,
        PairUints memory amounts
    ) internal {
        if (tokens.tokenA != ZERO && amounts.uintA != 0)
            IERC20(tokens.tokenA).safeTransferFrom(from, to, amounts.uintA);
        if (tokens.tokenB != ZERO && amounts.uintB != 0)
            IERC20(tokens.tokenB).safeTransferFrom(from, to, amounts.uintB);
    }

    function safeTransfer(
        PairTokens memory tokens,
        address to,
        PairUints memory amounts
    ) internal {
        if (tokens.tokenA != ZERO && amounts.uintA != 0)
            IERC20(tokens.tokenA).safeTransfer(to, amounts.uintA);
        if (tokens.tokenB != ZERO && amounts.uintB != 0)
            IERC20(tokens.tokenB).safeTransfer(to, amounts.uintB);
    }

    function infinityApprove(PairTokens memory tokens, address to) internal {
        if (tokens.tokenA != ZERO) IERC20(tokens.tokenA).safeApprove(to, type(uint256).max);
        if (tokens.tokenB != ZERO) IERC20(tokens.tokenB).safeApprove(to, type(uint256).max);
    }

    function allowance(PairTokens memory tokens, address spender)
        internal
        view
        returns (PairUints memory res)
    {
        if (tokens.tokenA != ZERO)
            res.uintA = IERC20(tokens.tokenA).allowance(address(this), spender);
        if (tokens.tokenB != ZERO)
            res.uintB = IERC20(tokens.tokenB).allowance(address(this), spender);
    }

    function balanceOf(PairTokens memory tokens, address account)
        internal
        view
        returns (PairUints memory balances)
    {
        if (tokens.tokenA != ZERO) balances.uintA = IERC20(tokens.tokenA).balanceOf(account);
        if (tokens.tokenB != ZERO) balances.uintB = IERC20(tokens.tokenB).balanceOf(account);
    }

    function add(PairUints memory a, PairUints memory b)
        internal
        pure
        returns (PairUints memory res)
    {
        res.uintA = a.uintA.add(b.uintA);
        res.uintB = a.uintB.add(b.uintB);
    }

    function sub(PairUints memory a, PairUints memory b)
        internal
        pure
        returns (PairUints memory res)
    {
        res.uintA = a.uintA.sub(b.uintA);
        res.uintB = a.uintB.sub(b.uintB);
    }

    function eq(PairUints memory a, PairUints memory b) internal pure returns (bool) {
        return a.uintA == b.uintA && a.uintB == b.uintB;
    }

    function eq(PairTokens memory a, PairTokens memory b) internal pure returns (bool) {
        return a.tokenA == b.tokenA && a.tokenB == b.tokenB;
    }

    function min(PairUints memory a, PairUints memory b) internal pure returns (PairUints memory) {
        return PairUints(Math.min(a.uintA, b.uintA), Math.min(a.uintB, b.uintB));
    }

    function mul(PairUints memory a, uint256 b) internal pure returns (PairUints memory res) {
        res.uintA = a.uintA.mul(b);
        res.uintB = a.uintB.mul(b);
    }

    function div(PairUints memory a, uint256 b) internal pure returns (PairUints memory res) {
        res.uintA = a.uintA.div(b);
        res.uintB = a.uintB.div(b);
    }

    function allZero(PairUints memory a) internal pure returns (bool) {
        return a.uintA == 0 && a.uintB == 0;
    }

    function allZero(PairTokens memory a) internal pure returns (bool) {
        return a.tokenA == ZERO && a.tokenB == ZERO;
    }

    function contains(PairTokens memory tokens, address _token) internal pure returns (bool) {
        if (_token == ZERO) return false;
        return (_token == tokens.tokenA || _token == tokens.tokenB);
    }

    function toArr(PairTokens memory tokens) internal pure returns (address[] memory res) {
        res = new address[](2);
        res[0] = tokens.tokenA;
        res[1] = tokens.tokenB;
    }

    function add(PairTokenUints memory a, PairTokenUints memory b)
        internal
        pure
        returns (PairTokenUints memory res)
    {
        require(eq(a.tokens, b.tokens), "PAIR_MISMATCH");
        res.tokens = a.tokens;
        res.uints = add(a.uints, b.uints);
    }

    function mul(PairTokenUints memory a, uint256 b)
        internal
        pure
        returns (PairTokenUints memory res)
    {
        res.tokens = a.tokens;
        res.uints = mul(a.uints, b);
    }

    function div(PairTokenUints memory a, uint256 b)
        internal
        pure
        returns (PairTokenUints memory res)
    {
        res.tokens = a.tokens;
        res.uints = div(a.uints, b);
    }
}
