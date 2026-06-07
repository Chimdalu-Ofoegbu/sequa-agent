// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ITradeExecutor
/// @notice Mirror-side executor interface (DEC-003 migration architecture).
/// @dev FollowRegistry.mirror(...,address executor) types the executor parameter against this surface.
///      Phase 0 declares this interface only; SequaExecutor implementation lands in Phase 2.
interface ITradeExecutor {
    /// @notice Executes a scaled mirrored trade for `follower` from the source's opaque `signal` payload.
    /// @dev `signal` is ABI-encoded (address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)
    ///      per CONTEXT.md D-07 convention; the executor parses + validates against the FusionX V3 router whitelist.
    function executeTrade(address follower, bytes calldata signal) external;

    /// @notice Emergency stop hook required by DEC-003 risk mitigation.
    function kill() external;
}
