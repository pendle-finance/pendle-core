// SPDX-License-Identifier: GPL-3.0-or-later
/*
 * GNU General internal License v3.0 or later
 * ========================================
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General internal License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General internal License for more details.
 *
 * You should have received a copy of the GNU General internal License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
pragma solidity ^0.7.0;

library ErrorMessages {
    string internal constant BURN_EXCEED_BALANCE = "burn > balance";
    string internal constant BURN_TO_ZERO_ADDR = "burn to zero address";
    string internal constant DEPLOY_FAIL = "Pendle: failed on deploy";
    string internal constant EXCEED_MAX_PERCENT = "Pendle: exceeded max%";
    string internal constant EXISTED_ID = "Pendle: existing id";
    string internal constant EXISTED_MARKET = "Pendle: market already exists";
    string internal constant FACTORY_NOT_FOUND = "Pendle: Factory not found";
    string internal constant FORBIDDEN = "Pendle: forbidden";
    string internal constant FORGE_NOT_EXIST = "Pendle: forge doesn't exist";
    string internal constant HIGH_LP_OUT = "Pendle: high lp out amount";
    string internal constant HIGH_SPOTPRICE_AFTER = "Pendle: high after spotprice";
    string internal constant HIGH_SPOTPRICE_BEFORE = "Pendle: high before spotprice";
    string internal constant HIGH_TOKEN_IN = "Pendle: high token in amount";
    string internal constant HIGH_TOKEN_OUT = "Pendle: high token out amount";
    string internal constant HIGH_XYT_IN = "Pendle: high XYT out amount";
    string internal constant INVALID_DURATION = "Pendle: invalid duration";
    string internal constant INVALID_ID = "Pendle: invalid id";
    string internal constant INVALID_R_VAL = "Pendle: invalid r value";
    string internal constant LOW_SPOTPRICE_AFTER = "Pendle: small after spotprice";
    string internal constant LOW_TOKEN_OUT = "Pendle: low token out amount";
    string internal constant LOW_XYT_OUT = "Pendle: low XYT out amount";
    string internal constant MARKET_NOT_FOUND = "Pendle: market not found";
    string internal constant MATH_ERROR = "Pendle: math error";
    string internal constant MINT_TO_ZERO_ADDR = "mint to zero address";
    string internal constant NEGATIVE_ALLOWANCE = "allowance < 0";
    string internal constant NOT_BOOTSTRAPPED = "Pendle: not bootstrapped";
    string internal constant NOT_ENOUGH_FUND = "Pendle: insufficient funds";
    string internal constant NOT_ENOUGH_OT = "Must have enough OT tokens";
    string internal constant NOT_ENOUGH_XYT = "Must have enough XYT tokens";
    string internal constant NOT_INITIALIZED = "Pendle: not initialized";
    string internal constant NOT_XYT = "Pendle: not XYT";
    string internal constant ONLY_CORE = "Pendle: only core";
    string internal constant ONLY_FORGE = "Pendle: only forge";
    string internal constant ONLY_GOVERNANCE = "Pendle: only governance";
    string internal constant ONLY_MARKET_FACTORY = "Pendle: only market factory";
    string internal constant ONLY_XYT = "Pendle: only XYT";
    string internal constant OWNER_ZERO_ADDR = "owner zero address";
    string internal constant RECEIVER_ZERO_ADDR = "receiver zero address";
    string internal constant SENDER_ZERO_ADDR = "sender zero address";
    string internal constant SIMILAR_TOKEN = "Pendle: similar tokens";
    string internal constant SPENDER_ZERO_ADDR = "spender zero address";
    string internal constant TRANSFER_EXCEED_ALLOWENCE = "transfer > allowance";
    string internal constant TRANSFER_EXCEED_BALANCE = "transfer > balance";
    string internal constant WITHDRAW_FAIL = "Pendle: withdraw failed";
    string internal constant ZERO_BYTES = "Pendle: zero bytes";
    string internal constant ZERO_RATIO = "Pendle: zero ratio";
    string internal constant ZERO_TOKEN = "Pendle: token amount must be greater than zero";
    string internal constant ZERO_TOKEN_IN = "Pendle: zero token in amount";
    string internal constant ZERO_TOKEN_OUT = "Pendle: zero token out amount";
    string internal constant ZERO_XYT = "Pendle: XYT amount must be greater than zero";
    string internal constant ZERO_XYT_IN = "Pendle: zero XYT in amount";
    string internal constant ZERO_XYT_OUT = "Pendle: zero XYT out amount";
    string internal constant ZERO_ADDRESS = "Pendle: zero address";

    /*
    "Pendle: new expiry must be later than old expiry"
    "Pendle: must be after expiry"
*/
}
