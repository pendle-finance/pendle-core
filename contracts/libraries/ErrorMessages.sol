// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * GNU General Public License v3.0 or later
 * ========================================
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
pragma solidity ^0.7.0;

library ErrorMessages {
    string public constant BURN_EXCEED_BALANCE = "burn > balance";
    string public constant BURN_TO_ZERO_ADDR = "burn to zero address";
    string public constant DEPLOY_FAIL = "Pendle: failed on deploy";
    string public constant EXCEED_MAX_PERCENT = "Pendle: exceeded max%";
    string public constant EXISTED_ID = "Pendle: existing id";
    string public constant EXISTED_MARKET = "Pendle: market already exists";
    string public constant FACTORY_NOT_FOUND = "Pendle: Factory not found";
    string public constant FORBIDDEN = "Pendle: forbidden";
    string public constant FORGE_NOT_EXIST = "Pendle: forge doesn't exist";
    string public constant HIGH_LP_OUT = "Pendle: high lp out amount";
    string public constant HIGH_SPOTPRICE_AFTER = "Pendle: high after spotprice";
    string public constant HIGH_SPOTPRICE_BEFORE = "Pendle: high before spotprice";
    string public constant HIGH_TOKEN_IN = "Pendle: high token in amount";
    string public constant HIGH_TOKEN_OUT = "Pendle: high token out amount";
    string public constant HIGH_XYT_IN = "Pendle: high XYT out amount";
    string public constant INVALID_DURATION = "Pendle: invalid duration";
    string public constant INVALID_ID = "Pendle: invalid id";
    string public constant INVALID_R_VAL = "Pendle: invalid r value";
    string public constant LOW_SPOTPRICE_AFTER = "Pendle: small after spotprice";
    string public constant LOW_TOKEN_OUT = "Pendle: low token out amount";
    string public constant LOW_XYT_OUT = "Pendle: low XYT out amount";
    string public constant MARKET_NOT_FOUND = "Pendle: market not found";
    string public constant MATH_ERROR = "Pendle: math error";
    string public constant MINT_TO_ZERO_ADDR = "mint to zero address";
    string public constant NEGATIVE_ALLOWANCE = "allowance < 0";
    string public constant NOT_BOOTSTRAPPED = "Pendle: not bootstrapped";
    string public constant NOT_ENOUGH_FUND = "Pendle: insufficient funds";
    string public constant NOT_ENOUGH_OT = "Must have enough OT tokens";
    string public constant NOT_ENOUGH_XYT = "Must have enough XYT tokens";
    string public constant NOT_INITIALIZED = "Pendle: not initialized";
    string public constant NOT_XYT = "Pendle: not XYT";
    string public constant ONLY_CORE = "Pendle: only core";
    string public constant ONLY_FORGE = "Pendle: only forge";
    string public constant ONLY_GOVERNANCE = "Pendle: only governance";
    string public constant ONLY_MARKET_FACTORY = "Pendle: only market factory";
    string public constant ONLY_XYT = "Pendle: only XYT";
    string public constant OWNER_ZERO_ADDR = "owner zero address";
    string public constant RECEIVER_ZERO_ADDR = "receiver zero address";
    string public constant SENDER_ZERO_ADDR = "sender zero address";
    string public constant SIMILAR_TOKEN = "Pendle: similar tokens";
    string public constant SPENDER_ZERO_ADDR = "spender zero address";
    string public constant TRANSFER_EXCEED_ALLOWENCE = "transfer > allowance";
    string public constant TRANSFER_EXCEED_BALANCE = "transfer > balance";
    string public constant WITHDRAW_FAIL = "Pendle: withdraw failed";
    string public constant ZERO_BYTES = "Pendle: zero bytes";
    string public constant ZERO_RATIO = "Pendle: zero ratio";
    string public constant ZERO_TOKEN = "Pendle: token amount must be greater than zero";
    string public constant ZERO_TOKEN_IN = "Pendle: zero token in amount";
    string public constant ZERO_TOKEN_OUT = "Pendle: zero token out amount";
    string public constant ZERO_XYT = "Pendle: XYT amount must be greater than zero";
    string public constant ZERO_XYT_IN = "Pendle: zero XYT in amount";
    string public constant ZERO_XYT_OUT = "Pendle: zero XYT out amount";
    string public constant ZERO_ADDRESS = "Pendle: zero address";

    /*
    "Pendle: new expiry must be later than old expiry"
    "Pendle: must be after expiry"
*/
}
