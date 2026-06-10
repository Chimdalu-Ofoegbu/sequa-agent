// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {SourceRegistry} from "../src/SourceRegistry.sol";

contract SourceRegistryTest is Test {
    SourceRegistry internal registry;
    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);
    uint256 internal constant AGENT_ID = 42;

    // Mirror the events on-test so vm.expectEmit can match topics + data.
    event SourceRegistered(uint256 indexed agentId, address indexed owner, string strategyMeta);
    event SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp);
    // Phase 1 extension events (D-33 typed decode, D-30 invalidation marker).
    event SignalDecoded(
        uint256 indexed agentId,
        uint256 indexed signalId,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint24 fee
    );
    event SignalInvalidated(uint256 indexed agentId, uint256 indexed signalId, string reason, uint64 timestamp);

    function setUp() public {
        registry = new SourceRegistry();
        vm.label(alice, "alice");
        vm.label(bob, "bob");
    }

    function test_registerSource_setsOwnerAndEmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(registry));
        emit SourceRegistered(AGENT_ID, alice, "MA-trend-v1");
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        (address owner_, , uint256 signalCount, uint64 lastSignalAt, bool registered) = registry.sources(AGENT_ID);
        assertEq(owner_, alice);
        assertTrue(registered);
        assertEq(signalCount, 0);
        assertEq(lastSignalAt, uint64(0));
    }

    function test_registerSource_revertsOnDoubleRegister() public {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");
        vm.expectRevert(abi.encodeWithSelector(SourceRegistry.SourceAlreadyRegistered.selector, AGENT_ID));
        vm.prank(bob);
        registry.registerSource(AGENT_ID, "bob-steal");
    }

    function test_recordSignal_emitsSignalRecordedAndAdvancesPerformance() public {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        bytes memory signal = abi.encode(
            address(0x1111111111111111111111111111111111111111), // tokenIn
            address(0x2222222222222222222222222222222222222222), // tokenOut
            uint256(1e18),                                       // amountIn
            uint256(9e17),                                       // minAmountOut
            uint24(3000)                                         // fee
        );

        vm.warp(1_750_000_000);
        vm.expectEmit(true, true, false, true, address(registry));
        emit SignalRecorded(AGENT_ID, 1, signal, uint64(1_750_000_000));

        vm.prank(alice);
        uint256 signalId = registry.recordSignal(AGENT_ID, signal);
        assertEq(signalId, 1);

        (uint256 count, uint64 lastAt) = registry.performance(AGENT_ID);
        assertEq(count, 1);
        assertEq(lastAt, uint64(1_750_000_000));
    }

    function test_recordSignal_revertsForNonOwner() public {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        vm.expectRevert(abi.encodeWithSelector(SourceRegistry.NotSourceOwner.selector, AGENT_ID, bob));
        vm.prank(bob);
        registry.recordSignal(AGENT_ID, hex"deadbeef");
    }

    function test_recordSignal_revertsForUnregisteredAgent() public {
        vm.expectRevert(abi.encodeWithSelector(SourceRegistry.SourceNotRegistered.selector, AGENT_ID));
        vm.prank(alice);
        registry.recordSignal(AGENT_ID, hex"deadbeef");
    }

    function test_recordSignal_payloadShapeIsOpaqueAndPreservedInEvent() public {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        // Arbitrary non-FusionX payload; contract MUST accept and re-emit verbatim (D-07: bytes is opaque).
        bytes memory signal = hex"0102030405060708090a";
        vm.recordLogs();
        vm.prank(alice);
        registry.recordSignal(AGENT_ID, signal);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 1);
        // Decode non-indexed args (signal bytes, timestamp)
        (bytes memory emittedSignal, uint64 ts) = abi.decode(logs[0].data, (bytes, uint64));
        assertEq(emittedSignal, signal);
        assertEq(ts, uint64(block.timestamp));
    }

    // ----------------------------------------------------------------------------------------
    // Phase 1 extension coverage (D-30/D-31/D-33).
    // ----------------------------------------------------------------------------------------

    // The canonical D-07 5-field signal tuple (the universal contract shared with the TS runtime,
    // reconciler, and SignalDecoded event). Fixed token addresses so the indexed tokenIn topic asserts.
    address internal constant FIXTURE_TOKEN_IN = address(0x1111111111111111111111111111111111111111);
    address internal constant FIXTURE_TOKEN_OUT = address(0x2222222222222222222222222222222222222222);

    function _canonicalSignal() internal pure returns (bytes memory) {
        return abi.encode(
            FIXTURE_TOKEN_IN, // tokenIn
            FIXTURE_TOKEN_OUT, // tokenOut
            uint256(1e18), // amountIn
            uint256(9e17), // minAmountOut
            uint24(3000) // fee
        );
    }

    function _registerAndRecord(bytes memory signal) internal returns (uint256 signalId) {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");
        vm.prank(alice);
        signalId = registry.recordSignal(AGENT_ID, signal);
    }

    function test_signalAt_roundTripsBytes() public {
        bytes memory signal = _canonicalSignal();
        _registerAndRecord(signal);
        // signalAt returns the EXACT bytes stored at record time (D-33).
        assertEq(registry.signalAt(AGENT_ID, 1), signal);
    }

    function test_recordSignal_emitsTypedSignalDecoded() public {
        bytes memory signal = _canonicalSignal();
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        // Assert the typed event with the fixture's tokenIn indexed (check all 3 topics + data).
        vm.expectEmit(true, true, true, true, address(registry));
        emit SignalDecoded(AGENT_ID, 1, FIXTURE_TOKEN_IN, FIXTURE_TOKEN_OUT, uint256(1e18), uint256(9e17), uint24(3000));

        vm.prank(alice);
        registry.recordSignal(AGENT_ID, signal);
    }

    function test_invalidateSignal_setsFlagAndEmits() public {
        _registerAndRecord(_canonicalSignal());

        vm.warp(1_750_000_000);
        vm.expectEmit(true, true, false, true, address(registry));
        emit SignalInvalidated(AGENT_ID, 1, "swap reverted", uint64(1_750_000_000));

        vm.prank(alice);
        registry.invalidateSignal(AGENT_ID, 1, "swap reverted");

        assertTrue(registry.invalidated(AGENT_ID, 1));
    }

    function test_invalidateSignal_revertsForNonOwner() public {
        _registerAndRecord(_canonicalSignal());

        vm.expectRevert(abi.encodeWithSelector(SourceRegistry.NotSourceOwner.selector, AGENT_ID, bob));
        vm.prank(bob);
        registry.invalidateSignal(AGENT_ID, 1, "bob-cannot");
    }

    function test_invalidateSignal_revertsForUnregistered() public {
        vm.expectRevert(abi.encodeWithSelector(SourceRegistry.SourceNotRegistered.selector, AGENT_ID));
        vm.prank(alice);
        registry.invalidateSignal(AGENT_ID, 1, "no-such-source");
    }

    function test_recordSignal_opaquePayloadStillRecords() public {
        vm.prank(alice);
        registry.registerSource(AGENT_ID, "MA-trend-v1");

        // The existing opaque-payload fixture: too short to be a 5-field tuple → typed emit skipped,
        // but recordSignal MUST still record (SignalRecorded fires, signalCount advances) without reverting (T-1-05).
        bytes memory signal = hex"0102030405060708090a";
        vm.recordLogs();
        vm.prank(alice);
        uint256 signalId = registry.recordSignal(AGENT_ID, signal);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        // Exactly one event (SignalRecorded) — SignalDecoded skipped for the non-conforming payload.
        assertEq(logs.length, 1);
        assertEq(signalId, 1);

        (uint256 count,) = registry.performance(AGENT_ID);
        assertEq(count, 1);
        // The opaque bytes are still persisted for signalAt regardless of decodability.
        assertEq(registry.signalAt(AGENT_ID, 1), signal);
    }
}
