// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SourceRegistry
/// @notice Registers source agents and records their on-chain trade signals.
/// @dev REQ-01 + CONTEXT.md D-07 (signal shape), D-08 (access control), D-09 (reentrancy).
///      Phase 1 EXTENSION (D-31/D-33): adds invalidateSignal (the "we don't hide misses"
///      honesty marker, D-30), signalAt view (persisted raw bytes, D-33), and a typed
///      SignalDecoded event emitted ALONGSIDE the unchanged SignalRecorded event (additive,
///      RESEARCH A4 — Phase 2 listener stability). recordSignal stays opaque per D-07: a
///      non-conforming payload still records, only the typed emit is skipped. performance()
///      stays minimal (signalCount, lastSignalAt) — no on-chain PnL (D-32). The reconciler
///      (Plan 05) walks SignalRecorded + SignalInvalidated; the Phase 2 mirror engine indexes
///      SignalDecoded without decoding bytes per handler.
contract SourceRegistry is Ownable, ReentrancyGuard {
    struct Source {
        address owner;
        string strategyMeta;
        uint256 signalCount;
        uint64 lastSignalAt;
        bool registered;
    }

    mapping(uint256 agentId => Source) public sources;

    /// @dev Persisted raw signal bytes so signalAt() returns them without a log scan (D-33).
    mapping(uint256 agentId => mapping(uint256 signalId => bytes)) private _signalData;
    /// @dev Owner-set "this signal did not settle as expected" flag (D-30). Public getter for the reconciler.
    mapping(uint256 agentId => mapping(uint256 signalId => bool)) public invalidated;

    event SourceRegistered(uint256 indexed agentId, address indexed owner, string strategyMeta);
    event SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp);
    /// @dev Typed decode of the D-07 5-field tuple, emitted ALONGSIDE SignalRecorded (additive — D-33).
    ///      Indexed on agentId, signalId, tokenIn (3 indexed max — RESEARCH Open Q3).
    event SignalDecoded(
        uint256 indexed agentId,
        uint256 indexed signalId,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    );
    /// @dev Source-owner marks a recorded signal as invalidated (D-30 honesty marker).
    event SignalInvalidated(uint256 indexed agentId, uint256 indexed signalId, string reason, uint64 timestamp);

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
    ///      Phase 1: the raw bytes are persisted for signalAt() and, when the payload conforms to the
    ///      D-07 5-field tuple, the typed SignalDecoded event is emitted ALONGSIDE the unchanged
    ///      SignalRecorded event. Non-conforming bytes still record (SignalRecorded fires, signalCount
    ///      advances); only the typed emit is skipped — recordSignal NEVER reverts on malformed bytes
    ///      (D-07 opacity; threat T-1-05).
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

        // PRESERVE byte-for-byte (RESEARCH A4 — Phase 2 listener stability): emit unchanged first.
        emit SignalRecorded(agentId, signalId, signal, uint64(block.timestamp));

        // D-33: persist the raw bytes so signalAt() returns them without a log scan.
        _signalData[agentId][signalId] = signal;

        // D-33 additive: decode the D-07 5-field tuple and emit the typed event ALONGSIDE.
        // Guard so non-conforming bytes skip the typed emit without reverting (D-07 opacity, T-1-05).
        // 5 ABI words minimum (5 * 32 = 160 bytes); the external-call try/catch catches any decode revert.
        if (signal.length >= 160) {
            try this.decodeSignalTuple(signal) returns (
                address tokenIn,
                address tokenOut,
                uint256 amountIn,
                uint256 minAmountOut,
                uint24 fee
            ) {
                emit SignalDecoded(agentId, signalId, tokenIn, tokenOut, amountIn, minAmountOut, fee);
            } catch {
                // Non-conforming payload — skip the typed emit; the signal is still recorded (D-07).
            }
        }
    }

    /// @notice Mark a recorded signal as invalidated (D-30 honesty marker — "we don't hide misses").
    /// @dev D-08 owner gate copied verbatim from recordSignal; D-09 nonReentrant. The reconciler (Plan 05)
    ///      excludes invalidated signals from the match-rate gate.
    function invalidateSignal(uint256 agentId, uint256 signalId, string calldata reason)
        external
        nonReentrant
    {
        Source storage s = sources[agentId];
        if (!s.registered) revert SourceNotRegistered(agentId);
        if (s.owner != msg.sender) revert NotSourceOwner(agentId, msg.sender);
        invalidated[agentId][signalId] = true;
        emit SignalInvalidated(agentId, signalId, reason, uint64(block.timestamp));
    }

    /// @notice Returns the exact raw signal bytes stored at record time (D-33).
    function signalAt(uint256 agentId, uint256 signalId) external view returns (bytes memory) {
        return _signalData[agentId][signalId];
    }

    /// @notice External decode helper for the defensive guarded decode in recordSignal.
    /// @dev MUST be external so recordSignal can `try this.decodeSignalTuple(...)` and catch the revert
    ///      that a non-conforming payload triggers (abi.decode reverts cannot be caught inline). Pure +
    ///      stateless — exposes no privileged surface; it only re-decodes the D-07 5-field tuple.
    function decodeSignalTuple(bytes calldata signal)
        external
        pure
        returns (address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)
    {
        return abi.decode(signal, (address, address, uint256, uint256, uint24));
    }

    /// @notice On-chain track-record view consumed by the Phase 4 agent card.
    /// @dev D-32: stays minimal — (signalCount, lastSignalAt) only, no on-chain PnL.
    function performance(uint256 agentId)
        external
        view
        returns (uint256 signalCount, uint64 lastSignalAt)
    {
        Source storage s = sources[agentId];
        return (s.signalCount, s.lastSignalAt);
    }
}
