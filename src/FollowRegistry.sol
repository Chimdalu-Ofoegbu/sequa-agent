// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ITradeExecutor} from "./interfaces/ITradeExecutor.sol";

/// @title FollowRegistry
/// @notice Phase 0 skeleton — records the on-chain follow graph and the executor each follower authorized.
/// @dev REQ-02 + CONTEXT.md D-04 (typed executor surface), D-09 (reentrancy).
///      Phase 0 deliberately does NOT validate sourceId against SourceRegistry — the two skeletons are independent.
///      Cross-contract validation, ERC-20 allowance scope, and live executor calls land in Phase 2 (SequaExecutor.sol).
///      The ITradeExecutor import wires the executor surface into this contract's type graph for downstream phases;
///      Phase 0 stores executor as `address` so it remains forward-compatible with EOA-controlled testing wallets
///      and any future ITradeExecutor implementer (DEC-003 migration architecture: SessionKeyExecutor, Safe modules).
///
///      Threat model (per plan §threat_model):
///      - T-00-FR-01 Spoofing: follower IS msg.sender — no spoofing surface.
///      - T-00-FR-02 Reentrancy: nonReentrant on mirror + unmirror (D-09 defensive baseline).
///      - T-00-FR-03 Capital-griefing: capital == 0 reverts ZeroCapital() (honest follow graph).
///      - T-00-FR-04 Malicious executor address: Phase 0 only rejects address(0); Phase 2 SequaExecutor enforces
///        whitelisted router + per-token cap + slippage + kill switch. Phase 4 UI surfaces the official executor.
///      - T-00-FR-05 Follow-graph privacy: graph is public by design (social-discovery primitive per REQ-10).
///      - T-00-FR-06 Repudiation: Mirrored + Unmirrored events with indexed sourceId + indexed follower.
///      - T-00-FR-07 Ownership: Ownable inherited for future migration hooks; no privileged Phase 0 functions.
///      - T-00-FR-08 Unbounded growth: followersOf is a view (no gas limit on eth_call); engine-side pagination
///        is a known Phase 2 concern.
contract FollowRegistry is Ownable, ReentrancyGuard {
    struct Follow {
        uint256 capital;
        address executor;
        uint64 mirroredAt;
        uint256 followerIndex;
        uint256 followingIndex;
        bool active;
    }

    mapping(uint256 sourceId => mapping(address follower => Follow)) internal _follows;
    mapping(uint256 sourceId => address[]) internal _followers;
    mapping(address follower => uint256[]) internal _following;

    event Mirrored(uint256 indexed sourceId, address indexed follower, uint256 capital, address executor);
    event Unmirrored(uint256 indexed sourceId, address indexed follower);

    error ZeroCapital();
    error ZeroExecutor();
    error AlreadyFollowing(uint256 sourceId, address follower);
    error NotFollowing(uint256 sourceId, address follower);

    constructor() Ownable(msg.sender) {}

    /// @notice Authorizes `executor` to mirror trades of `sourceId` for msg.sender at `capital` scale.
    /// @dev Phase 0: records intent only. Phase 2 SequaExecutor enforces the scoped ERC-20 allowance pattern (DEC-003).
    ///      Reverts:
    ///       - ZeroCapital() if capital == 0 (T-00-FR-03 capital-griefing mitigation)
    ///       - ZeroExecutor() if executor == address(0) (Phase 0 baseline; Phase 2 enforces full whitelist)
    ///       - AlreadyFollowing(sourceId, msg.sender) if caller already actively follows sourceId — callers must
    ///         unmirror() first to change capital. Keeps the Mirrored event stream clean (one Mirrored per active edge).
    function mirror(uint256 sourceId, uint256 capital, address executor) external nonReentrant {
        if (capital == 0) revert ZeroCapital();
        if (executor == address(0)) revert ZeroExecutor();
        Follow storage f = _follows[sourceId][msg.sender];
        if (f.active) revert AlreadyFollowing(sourceId, msg.sender);

        uint256 followerIdx = _followers[sourceId].length;
        uint256 followingIdx = _following[msg.sender].length;

        _followers[sourceId].push(msg.sender);
        _following[msg.sender].push(sourceId);

        _follows[sourceId][msg.sender] = Follow({
            capital: capital,
            executor: executor,
            mirroredAt: uint64(block.timestamp),
            followerIndex: followerIdx,
            followingIndex: followingIdx,
            active: true
        });

        emit Mirrored(sourceId, msg.sender, capital, executor);
    }

    /// @notice Removes msg.sender's active follow on `sourceId`. Phase 0: graph state only.
    /// @dev Frontend (Phase 4) MUST also guide the follower to call `approve(executor, 0)` on the locked tokens
    ///      to fully revoke executor authorization (per REQ-03 plain-language custody/revocation copy). On-chain
    ///      this only clears the follow-graph entry; ERC-20 allowance revocation is a separate, follower-driven action.
    ///      Reverts NotFollowing(sourceId, msg.sender) if no active follow exists.
    function unmirror(uint256 sourceId) external nonReentrant {
        Follow storage f = _follows[sourceId][msg.sender];
        if (!f.active) revert NotFollowing(sourceId, msg.sender);

        // Swap-and-pop msg.sender out of _followers[sourceId]
        uint256 idx = f.followerIndex;
        address[] storage arr = _followers[sourceId];
        uint256 last = arr.length - 1;
        if (idx != last) {
            address moved = arr[last];
            arr[idx] = moved;
            _follows[sourceId][moved].followerIndex = idx;
        }
        arr.pop();

        // Swap-and-pop sourceId out of _following[msg.sender]
        uint256 idx2 = f.followingIndex;
        uint256[] storage arr2 = _following[msg.sender];
        uint256 last2 = arr2.length - 1;
        if (idx2 != last2) {
            uint256 moved2 = arr2[last2];
            arr2[idx2] = moved2;
            _follows[moved2][msg.sender].followingIndex = idx2;
        }
        arr2.pop();

        // Full clear — honest follow-graph state.
        delete _follows[sourceId][msg.sender];

        emit Unmirrored(sourceId, msg.sender);
    }

    /// @notice Returns the list of currently-mirroring follower addresses for `sourceId`.
    /// @dev O(n) view; off-chain eth_call has no gas limit. Phase 4 may paginate at 1000+ followers (T-00-FR-08).
    function followersOf(uint256 sourceId) external view returns (address[] memory) {
        return _followers[sourceId];
    }

    /// @notice Returns the list of sourceIds that `user` is currently mirroring.
    function following(address user) external view returns (uint256[] memory) {
        return _following[user];
    }

    /// @notice Returns the raw follow record for a (sourceId, follower) pair.
    /// @return capital The capital scale the follower authorized for this source.
    /// @return executor The executor address the follower authorized (Phase 2 SequaExecutor in production).
    /// @return mirroredAt The block.timestamp (uint64) when the follow was recorded.
    /// @return active Whether the follow is currently active (false after unmirror or never-mirrored).
    function followState(uint256 sourceId, address follower)
        external
        view
        returns (uint256 capital, address executor, uint64 mirroredAt, bool active)
    {
        Follow storage f = _follows[sourceId][follower];
        return (f.capital, f.executor, f.mirroredAt, f.active);
    }
}
