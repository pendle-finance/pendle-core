pragma solidity ^0.7.4;

import {UIntUtils} from "./UIntUtils.sol";

pragma experimental ABIEncoderV2;

library Date {
        /*
         *  Date utilities for ethereum contracts
         *
         */
        struct _Date {
                uint16 year;
                uint8 month;
                uint8 day;
        }

        uint constant public DAY_IN_SECONDS = 86400;
        uint constant public YEAR_IN_SECONDS = 31536000;
        uint constant public LEAP_YEAR_IN_SECONDS = 31622400;

        uint16 constant public ORIGIN_YEAR = 1970;

        function isLeapYear(uint16 year) public pure returns (bool) {
                return ((year % 4 == 0) && (year % 100 != 0)) || (year % 400 == 0);
        }

        function leapYearsBefore(uint year) public pure returns (uint) {
                year -= 1;
                return year / 4 - year / 100 + year / 400;
        }

        function getDaysInMonth(uint8 month, uint16 year) public pure returns (uint8) {
                if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
                        return 31;
                }
                else if (month == 4 || month == 6 || month == 9 || month == 11) {
                        return 30;
                }
                else if (isLeapYear(year)) {
                        return 29;
                }
                else {
                        return 28;
                }
        }

        function parseTimestamp(uint timestamp) public pure returns (_Date memory d) {
                uint secondsAccountedFor = 0;
                uint buf;
                uint8 i;

                // Year
                d.year = getYear(timestamp);
                buf = leapYearsBefore(d.year) - leapYearsBefore(ORIGIN_YEAR);

                secondsAccountedFor += LEAP_YEAR_IN_SECONDS * buf;
                secondsAccountedFor += YEAR_IN_SECONDS * (d.year - ORIGIN_YEAR - buf);

                // Month
                uint secondsInMonth;
                for (i = 1; i <= 12; i++) {
                        secondsInMonth = DAY_IN_SECONDS * getDaysInMonth(i, d.year);
                        if (secondsInMonth + secondsAccountedFor > timestamp) {
                                d.month = i;
                                break;
                        }
                        secondsAccountedFor += secondsInMonth;
                }

                // Day
                for (i = 1; i <= getDaysInMonth(d.month, d.year); i++) {
                        if (DAY_IN_SECONDS + secondsAccountedFor > timestamp) {
                                d.day = i;
                                break;
                        }
                        secondsAccountedFor += DAY_IN_SECONDS;
                }
        }

        function getYear(uint timestamp) public pure returns (uint16) {
                uint secondsAccountedFor = 0;
                uint16 year;
                uint numLeapYears;

                // Year
                year = uint16(ORIGIN_YEAR + timestamp / YEAR_IN_SECONDS);
                numLeapYears = leapYearsBefore(year) - leapYearsBefore(ORIGIN_YEAR);

                secondsAccountedFor += LEAP_YEAR_IN_SECONDS * numLeapYears;
                secondsAccountedFor += YEAR_IN_SECONDS * (year - ORIGIN_YEAR - numLeapYears);

                while (secondsAccountedFor > timestamp) {
                        if (isLeapYear(uint16(year - 1))) {
                                secondsAccountedFor -= LEAP_YEAR_IN_SECONDS;
                        }
                        else {
                                secondsAccountedFor -= YEAR_IN_SECONDS;
                        }
                        year -= 1;
                }
                return year;
        }

        function monthName(_Date memory d) private pure returns(string memory) {
          string[12] memory months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
          return months[d.month - 1];
        }

        function toRFC2822String(uint timestamp) public pure returns (string memory s){
                _Date memory d = parseTimestamp(timestamp);
                string memory day = UIntUtils.uintToString(d.day);
                string memory month = monthName(d); 
                string memory year =  UIntUtils.uintToString(d.year); 
                s = string(abi.encodePacked(day, month, year));
        }
}