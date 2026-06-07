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
}
