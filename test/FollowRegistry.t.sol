// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {FollowRegistry} from "../src/FollowRegistry.sol";

/// @title FollowRegistryTest
/// @notice Phase 0 Plan 03 — proves REQ-02 surface + D-09 reentrancy + capital-griefing reject.
/// @dev Seven tests; the swap-and-pop graph-consistency test is the load-bearing invariant per the plan.
contract FollowRegistryTest is Test {
    FollowRegistry internal registry;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCAA01);
    address internal executor = address(0xEEEEEEEE);

    uint256 internal constant SOURCE_A = 7;
    uint256 internal constant SOURCE_B = 9;

    // Mirrored / Unmirrored events must be re-declared at the test contract level for vm.expectEmit topic-matching.
    event Mirrored(uint256 indexed sourceId, address indexed follower, uint256 capital, address executor);
    event Unmirrored(uint256 indexed sourceId, address indexed follower);

    function setUp() public {
        registry = new FollowRegistry();
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(carol, "carol");
        vm.label(executor, "executor");
    }

    function test_mirror_recordsFollowAndEmitsMirrored() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit Mirrored(SOURCE_A, alice, 1e18, executor);
        vm.prank(alice);
        registry.mirror(SOURCE_A, 1e18, executor);

        (uint256 cap, address exec_,, bool active) = registry.followState(SOURCE_A, alice);
        assertEq(cap, 1e18);
        assertEq(exec_, executor);
        assertTrue(active);

        address[] memory followers = registry.followersOf(SOURCE_A);
        assertEq(followers.length, 1);
        assertEq(followers[0], alice);

        uint256[] memory followingList = registry.following(alice);
        assertEq(followingList.length, 1);
        assertEq(followingList[0], SOURCE_A);
    }

    function test_mirror_revertsOnZeroCapital() public {
        vm.expectRevert(FollowRegistry.ZeroCapital.selector);
        vm.prank(alice);
        registry.mirror(SOURCE_A, 0, executor);
    }

    function test_mirror_revertsOnZeroExecutor() public {
        vm.expectRevert(FollowRegistry.ZeroExecutor.selector);
        vm.prank(alice);
        registry.mirror(SOURCE_A, 1e18, address(0));
    }

    function test_mirror_revertsOnAlreadyFollowing() public {
        vm.prank(alice);
        registry.mirror(SOURCE_A, 1e18, executor);

        vm.expectRevert(abi.encodeWithSelector(FollowRegistry.AlreadyFollowing.selector, SOURCE_A, alice));
        vm.prank(alice);
        registry.mirror(SOURCE_A, 2e18, executor);
    }

    function test_unmirror_clearsFollowAndEmitsUnmirrored() public {
        vm.prank(alice);
        registry.mirror(SOURCE_A, 1e18, executor);

        vm.expectEmit(true, true, false, false, address(registry));
        emit Unmirrored(SOURCE_A, alice);
        vm.prank(alice);
        registry.unmirror(SOURCE_A);

        (,,, bool active) = registry.followState(SOURCE_A, alice);
        assertFalse(active);
        assertEq(registry.followersOf(SOURCE_A).length, 0);
        assertEq(registry.following(alice).length, 0);
    }

    function test_unmirror_revertsWhenNotFollowing() public {
        vm.expectRevert(abi.encodeWithSelector(FollowRegistry.NotFollowing.selector, SOURCE_A, alice));
        vm.prank(alice);
        registry.unmirror(SOURCE_A);
    }

    /// @notice Load-bearing invariant: swap-and-pop bookkeeping holds under a mixed workload.
    /// @dev alice mirrors A; bob mirrors A; carol mirrors A; alice mirrors B.
    ///      Then bob unmirrors A — middle index, forces a swap-and-pop with carol.
    ///      Final shape:
    ///        _followers[A] = [alice, carol]  (bob popped from index 1; carol moved to index 1)
    ///        _followers[B] = [alice]
    ///        _following[alice] = [A, B]
    ///        _following[bob]   = []
    ///        _following[carol] = [A]
    ///      Then bob re-mirrors A and we assert the count grows back to 3 — proves the deleted Follow
    ///      record was fully cleared (active == false) so re-mirror does not collide with AlreadyFollowing.
    function test_followGraphConsistency_afterMultipleMirrorsAndUnmirrors() public {
        vm.prank(alice);
        registry.mirror(SOURCE_A, 1e18, executor);
        vm.prank(bob);
        registry.mirror(SOURCE_A, 2e18, executor);
        vm.prank(carol);
        registry.mirror(SOURCE_A, 3e18, executor);
        vm.prank(alice);
        registry.mirror(SOURCE_B, 4e18, executor);

        vm.prank(bob);
        registry.unmirror(SOURCE_A);

        // followersOf(A) is [alice, carol] after swap-and-pop of index 1 (bob) with last (carol)
        address[] memory followersA = registry.followersOf(SOURCE_A);
        assertEq(followersA.length, 2);
        assertEq(followersA[0], alice);
        assertEq(followersA[1], carol);

        // followersOf(B) is [alice]
        address[] memory followersB = registry.followersOf(SOURCE_B);
        assertEq(followersB.length, 1);
        assertEq(followersB[0], alice);

        // following(alice) is [A, B] — alice never unmirrored either source
        uint256[] memory followingAlice = registry.following(alice);
        assertEq(followingAlice.length, 2);
        assertEq(followingAlice[0], SOURCE_A);
        assertEq(followingAlice[1], SOURCE_B);

        // following(bob) is empty
        assertEq(registry.following(bob).length, 0);

        // following(carol) is [A]
        uint256[] memory followingCarol = registry.following(carol);
        assertEq(followingCarol.length, 1);
        assertEq(followingCarol[0], SOURCE_A);

        // Re-mirror by bob succeeds — proves delete fully cleared the prior Follow record
        vm.prank(bob);
        registry.mirror(SOURCE_A, 5e18, executor);
        assertEq(registry.followersOf(SOURCE_A).length, 3);
    }
}
