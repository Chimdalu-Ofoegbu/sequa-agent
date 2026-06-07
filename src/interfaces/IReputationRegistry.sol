// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IReputationRegistry
/// @notice ERC-8004 ReputationRegistry minimum surface (DEC-005).
/// @dev Canonical Mantle Sepolia deployment at 0x8004B663056A597Dffe9eCcC1965A193B7388713.
///      Phase 0 declares this surface only; follower-driven giveFeedback lands in Phase 3.
interface IReputationRegistry {
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
}
