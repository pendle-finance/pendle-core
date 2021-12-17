// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "../interfaces/IPendleRetroactiveDistribution.sol";

struct UserAmount {
    address user;
    uint256 amount;
}

contract PendleRetroactiveDistribution is
    ReentrancyGuard,
    Ownable,
    IPendleRetroactiveDistribution
{
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    address public constant ETH_ADDRESS = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // token => user => amount
    mapping(address => mapping(address => uint256)) public available;

    constructor() Ownable() {}

    function distribute(bytes32 rewardType, address token, UserAmount[] calldata data) external payable onlyOwner {
        uint256 total = 0;
        for (uint256 i = 0; i < data.length; i++) {
            available[token][data[i].user] = available[token][data[i].user].add(data[i].amount);
            total = total.add(data[i].amount);
        }
        _pullToken(token, total);
        emit DistributeReward(rewardType, token, total);
    }

    function unDistribute(bytes32 rewardType, address token, UserAmount[] calldata data) external onlyOwner {
        uint256 total = 0;
        for (uint256 i = 0; i < data.length; i++) {
            available[token][data[i].user] = available[token][data[i].user].sub(data[i].amount);
            total = total.add(data[i].amount);
        }
        _pushToken(token, total, msg.sender);
        emit UndistributeReward(rewardType, token, total);
    }

    function redeem(address[] calldata tokens, address payable forAddr)
        external
        override
        nonReentrant
        returns (uint256[] memory amounts)
    {
        uint256 len = tokens.length;
        amounts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            amounts[i] = available[tokens[i]][forAddr];
            if (amounts[i] == 0) continue;
            available[tokens[i]][forAddr] = 0;
            _pushToken(tokens[i], amounts[i], forAddr);
            emit RedeemReward(msg.sender, tokens[i], amounts[i]);
        }
    }

    function _pullToken(address token, uint256 amount) internal {
        if (token == ETH_ADDRESS) require(msg.value == amount, "ETH_AMOUNT_MISMATCH");
        else IERC20(token).transferFrom(msg.sender, address(this), amount);
    }

    function _pushToken(
        address token,
        uint256 amount,
        address payable to
    ) internal {
        if (token == ETH_ADDRESS) Address.sendValue(to, amount);
        else IERC20(token).transfer(to, amount);
    }
}
