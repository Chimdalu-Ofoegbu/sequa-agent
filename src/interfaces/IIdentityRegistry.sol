// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IIdentityRegistry
/// @notice ERC-8004 IdentityRegistry minimum surface (DEC-005).
/// @dev Canonical Mantle Sepolia deployment at 0x8004A818BFB912233c491871b3d84c89A494BD9e.
///      Phase 0 declares this surface only; live calls land in Phase 1.
interface IIdentityRegistry {
    function register(string calldata agentURI) external returns (uint256 agentId);
    function getAgentWallet(uint256 agentId) external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address);
}
