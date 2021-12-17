// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IDMMFactory.sol";
import "./UniswapV2Lib.sol";

struct OTPoolsCheckData {
    address sushiPairFactory;
    bytes32 sushiCodeHash;
    address kyberDMMFactory;
}

library OTPoolsLib {
    /// @notice Check if the given address is a Sushi/KyberDmm pool or not
    /// @dev on Avax TraderJoe = Sushi
    function isSushiKyberPool(address addr, OTPoolsCheckData memory args)
        internal
        view
        returns (bool)
    {
        if (isSushiPool(addr, args.sushiPairFactory, args.sushiCodeHash)) return true;
        if (isKyberPool(addr, args.kyberDMMFactory)) return true;
        return false;
    }

    function isSushiPool(
        address addr,
        address pairFactory,
        bytes32 codeHash
    ) internal view returns (bool) {
        (address token0, address token1, bool success) = getToken01(addr);
        if (!success) return false;

        address sushiPool = UniswapV2Library.pairFor(pairFactory, token0, token1, codeHash);
        if (sushiPool == addr) return true;
        return false;
    }

    function isKyberPool(address addr, address pairFactory) internal view returns (bool) {
        if (pairFactory == address(0)) return false;

        (address token0, address token1, bool success) = getToken01(addr);
        if (!success) return false;

        return IDMMFactory(pairFactory).isPool(IERC20(token0), IERC20(token1), addr);
    }

    function getToken01(address addr)
        internal
        view
        returns (
            address token0,
            address token1,
            bool success
        )
    {
        if (!Address.isContract(addr)) return (token0, token1, false);

        IUniswapV2Pair pair = IUniswapV2Pair(addr);
        try pair.token0() returns (address res) {
            token0 = res;
        } catch {
            return (token0, token1, false);
        }

        try pair.token1() returns (address res) {
            token1 = res;
        } catch {
            return (token0, token1, false);
        }

        return (token0, token1, true);
    }
}
