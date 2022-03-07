// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "../periphery/BoringOwnable.sol";
import "../libraries/TokenUtilsLib.sol";

contract PendleIncentiveData is BoringOwnable {
    using SafeMath for uint256;

    struct IncentiveData {
        uint32 epochBegin;
        uint32 epochEnd;
        uint192 total;
        // sum 256 bits
    }

    mapping(address => IncentiveData[]) public incentives;

    event IncentivesUpdate(
        address indexed token,
        uint256 indexed epochId,
        IncentiveData totalIncentives
    );

    constructor() BoringOwnable() {}

    function addNewData(address[] calldata tokens, IncentiveData[] calldata data)
        external
        onlyOwner
    {
        uint256 length = tokens.length;
        require(length == data.length, "ARRAY_LENGTH_MISMATCH");
        for (uint256 i = 0; i < length; i++) {
            incentives[tokens[i]].push(data[i]);
            emit IncentivesUpdate(tokens[i], incentives[tokens[i]].length.sub(1), data[i]);
        }
    }

    function overwriteData(
        address token,
        uint256 index,
        IncentiveData calldata newData
    ) external onlyOwner {
        require(index < incentives[token].length, "INVALID_INDEX");

        incentives[token][index] = newData;
        emit IncentivesUpdate(token, index, newData);
    }

    function getCurrentData(address[] calldata tokens)
        external
        view
        returns (IncentiveData[] memory data)
    {
        data = new IncentiveData[](tokens.length);
        for (uint256 id = 0; id < tokens.length; id++) {
            uint256 len = incentives[tokens[id]].length;
            require(len != 0, "NO_DATA_FOR_TOKEN");

            for (uint256 i = len - 1; ; i--) {
                IncentiveData memory curData = incentives[tokens[id]][i];
                if (curData.epochBegin <= block.timestamp && block.timestamp <= curData.epochEnd) {
                    data[id] = curData;
                    break;
                }
                if (i == 0) break;
            }
        }
    }

    function getLatestEpochId(address[] calldata tokens)
        external
        view
        returns (uint256[] memory res)
    {
        res = new uint256[](tokens.length);
        for (uint256 id = 0; id < tokens.length; id++) {
            res[id] = incentives[tokens[id]].length.sub(1);
        }
    }
}
