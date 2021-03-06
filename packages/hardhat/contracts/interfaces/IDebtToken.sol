// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.10;

// https://docs.aave.com/developers/v/2.0/the-core-protocol/debt-tokens
// Note: Only the interface methods related to this project's code are implemented here.
interface IDebtToken {
    function approveDelegation(address delegatee, uint256 amount) external;
    function borrowAllowance(address fromUser, address toUser) external view returns (uint256);
}
