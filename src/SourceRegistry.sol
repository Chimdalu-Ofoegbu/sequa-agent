// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SourceRegistry
/// @notice Phase 0 skeleton — registers source agents and records their on-chain trade signals.
/// @dev REQ-01 + CONTEXT.md D-07 (signal shape), D-08 (access control), D-09 (reentrancy).
///      Phase 1 wires the live ERC-8004 IIdentityRegistry.register() call against
///      0x8004A818BFB912233c491871b3d84c89A494BD9e on Mantle Sepolia.
contract SourceRegistry is Ownable, ReentrancyGuard {
    struct Source {
        address owner;
        string strategyMeta;
        uint256 signalCount;
        uint64 lastSignalAt;
        bool registered;
    }

    mapping(uint256 agentId => Source) public sources;

    event SourceRegistered(uint256 indexed agentId, address indexed owner, string strategyMeta);
    event SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp);

    error SourceAlreadyRegistered(uint256 agentId);
    error SourceNotRegistered(uint256 agentId);
    error NotSourceOwner(uint256 agentId, address caller);

    constructor() Ownable(msg.sender) {}

    /// @notice Register a source agent. Caller becomes the source owner; gates all future recordSignal calls.
    /// @dev D-08: ownership of agentId is set on first registration and cannot be changed in Phase 0.
    function registerSource(uint256 agentId, string calldata strategyMeta) external nonReentrant {
        if (sources[agentId].registered) revert SourceAlreadyRegistered(agentId);
        sources[agentId] = Source({
            owner: msg.sender,
            strategyMeta: strategyMeta,
            signalCount: 0,
            lastSignalAt: 0,
            registered: true
        });
        emit SourceRegistered(agentId, msg.sender, strategyMeta);
    }

    /// @notice Record a trade signal for a source. Gated by msg.sender == sources[agentId].owner (D-08).
    /// @dev `signal` is opaque to the contract; Phase 2 mirror engine ABI-decodes per D-07 convention:
    ///      (address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee).
    function recordSignal(uint256 agentId, bytes calldata signal)
        external
        nonReentrant
        returns (uint256 signalId)
    {
        Source storage s = sources[agentId];
        if (!s.registered) revert SourceNotRegistered(agentId);
        if (s.owner != msg.sender) revert NotSourceOwner(agentId, msg.sender);

        unchecked { s.signalCount += 1; }
        signalId = s.signalCount;
        s.lastSignalAt = uint64(block.timestamp);

        emit SignalRecorded(agentId, signalId, signal, uint64(block.timestamp));
    }

    /// @notice On-chain track-record view consumed by the Phase 4 agent card.
    function performance(uint256 agentId)
        external
        view
        returns (uint256 signalCount, uint64 lastSignalAt)
    {
        Source storage s = sources[agentId];
        return (s.signalCount, s.lastSignalAt);
    }
}
