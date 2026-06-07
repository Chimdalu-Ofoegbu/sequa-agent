---
phase: 00-lock
plan: 02
subsystem: source-registry
tags: [solidity, foundry, openzeppelin, source-registry, signal-recording, erc-8004, d-07, d-08, d-09]
dependency_graph:
  requires:
    - 00-01 (foundry-toolchain-pinned, openzeppelin-v5.0.2-importable)
  provides:
    - source-registry-contract
    - signalrecorded-event-shape-locked
    - source-owner-gated-recordsignal
    - reentrancy-guarded-state-changers
  affects:
    - 00-04 (deploy script needs SourceRegistry ABI + bytecode)
    - 00-05 (e2e recordSignal → mirror flow targets this contract)
    - Phase 1 (live ERC-8004 register() call wires into registerSource)
    - Phase 2 (mirror engine indexes SignalRecorded via on-chain event topic)
    - Phase 4 (agent card reads performance(agentId) view)
tech_stack:
  added: []
  patterns:
    - Custom error reverts (`SourceAlreadyRegistered`, `SourceNotRegistered`, `NotSourceOwner`) — gas-efficient and selector-asserted in tests
    - `unchecked { s.signalCount += 1; }` — overflow non-credible at uint256 (T-00-SR-06 accepted)
    - `vm.expectEmit(true, true, false, true, address(registry))` — exact topic + data match for event shape lock
    - `vm.recordLogs` + `abi.decode(logs[0].data, (bytes, uint64))` for opaque-bytes round-trip assertion
key_files:
  created:
    - src/SourceRegistry.sol
    - test/SourceRegistry.t.sol
  modified: []
decisions:
  - "Constructor uses Ownable(msg.sender) (OZ v5 mandatory initialOwner arg — matches plan's locked spec)"
  - "Bytes signal payload is intentionally opaque to the contract; D-07 ABI-encoding convention is the off-chain mirror engine's contract, not the on-chain contract's"
  - "Both state-changers carry nonReentrant even though Phase 0 has no external calls — defensive baseline for Phase 1/2 router integration (D-09)"
  - "Custom errors with parameters (agentId, caller) — tested via abi.encodeWithSelector, not string match (no silent passes on wrong revert)"
metrics:
  duration_seconds: ~360
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
  completed_date: "2026-06-07"
commits:
  - hash: ea83452
    type: feat
    subject: "implement skeleton SourceRegistry contract"
  - hash: fe7228d
    type: test
    subject: "add SourceRegistry test suite (6 tests)"
---

# Phase 0 Plan 02: SourceRegistry + Test Suite Summary

**One-liner:** Skeleton `SourceRegistry.sol` (74 lines) implementing REQ-01 with the locked `SignalRecorded(agentId, signalId, bytes signal, uint64 timestamp)` event shape per D-07, the source-owner write gate per D-08, and ReentrancyGuard per D-09 — plus a 6-test Foundry suite that asserts the event topic structure verbatim, asserts the bytes-payload is preserved opaquely, and asserts all three custom-error reverts by selector (no string matching).

## What Was Built

### `src/SourceRegistry.sol` (74 lines)

Final interface — these signatures are LOCKED for Phase 1 and Phase 2 consumers:

```solidity
// Inheritance
contract SourceRegistry is Ownable, ReentrancyGuard {}

// Storage
struct Source {
    address owner;
    string strategyMeta;
    uint256 signalCount;
    uint64 lastSignalAt;
    bool registered;
}
mapping(uint256 agentId => Source) public sources;

// Events (LOCKED — Phase 2 mirror engine indexes against these topics)
event SourceRegistered(uint256 indexed agentId, address indexed owner, string strategyMeta);
event SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp);

// Custom errors (asserted by selector in tests, not by string)
error SourceAlreadyRegistered(uint256 agentId);
error SourceNotRegistered(uint256 agentId);
error NotSourceOwner(uint256 agentId, address caller);

// Constructor
constructor() Ownable(msg.sender) {}

// External surface
function registerSource(uint256 agentId, string calldata strategyMeta) external nonReentrant;
function recordSignal(uint256 agentId, bytes calldata signal) external nonReentrant returns (uint256 signalId);
function performance(uint256 agentId) external view returns (uint256 signalCount, uint64 lastSignalAt);
```

**Behavioral guarantees (each tested):**

| # | Guarantee | Test | D-ref |
|---|-----------|------|-------|
| 1 | First-write sets owner; subsequent writes from anyone revert with `SourceAlreadyRegistered` | `test_registerSource_setsOwnerAndEmitsEvent` + `test_registerSource_revertsOnDoubleRegister` | D-08 (ownership-steal blocked) |
| 2 | `recordSignal` from non-stored-owner reverts with `NotSourceOwner(agentId, caller)` | `test_recordSignal_revertsForNonOwner` | D-08 (T-00-SR-01 spoofing mitigation) |
| 3 | `recordSignal` on unregistered agent reverts with `SourceNotRegistered` | `test_recordSignal_revertsForUnregisteredAgent` | D-08 |
| 4 | `recordSignal` emits the locked event topic shape; signalId starts at 1 and advances; lastSignalAt = `block.timestamp` | `test_recordSignal_emitsSignalRecordedAndAdvancesPerformance` | D-07 (mirror engine contract) |
| 5 | `signal` bytes are passed through verbatim — no parsing, no validation | `test_recordSignal_payloadShapeIsOpaqueAndPreservedInEvent` | D-07 (opaque bytes) |
| 6 | Both state-changers carry `nonReentrant` (grep-verified count ≥ 2) | Static check (acceptance criterion) | D-09 |

### `test/SourceRegistry.t.sol` (100 lines, 6 tests)

| Test | Gas | Asserts |
|------|-----|---------|
| `test_registerSource_setsOwnerAndEmitsEvent` | 92,116 | Event emit + storage state (owner, registered=true, signalCount=0, lastSignalAt=0) |
| `test_registerSource_revertsOnDoubleRegister` | 93,120 | `vm.expectRevert(abi.encodeWithSelector(SourceAlreadyRegistered.selector, AGENT_ID))` |
| `test_recordSignal_emitsSignalRecordedAndAdvancesPerformance` | 119,262 | Full event shape with FusionX V3 `ExactInputSingleParams`-encoded payload + `vm.warp(1_750_000_000)` timestamp + `performance()` view |
| `test_recordSignal_revertsForNonOwner` | 93,536 | `vm.expectRevert(abi.encodeWithSelector(NotSourceOwner.selector, AGENT_ID, bob))` |
| `test_recordSignal_revertsForUnregisteredAgent` | 18,937 | `vm.expectRevert(abi.encodeWithSelector(SourceNotRegistered.selector, AGENT_ID))` |
| `test_recordSignal_payloadShapeIsOpaqueAndPreservedInEvent` | 116,254 | `vm.recordLogs` + `abi.decode(logs[0].data, (bytes, uint64))` round-trip equality on arbitrary `hex"0102…0a"` |

All six pass; suite runs in ~29ms; forge `--match-contract SourceRegistryTest` exit 0.

### Gas Snapshot (informs Phase 2 mirror-engine gas budgeting)

The hot path for Phase 2 is `recordSignal` with a typical FusionX `ExactInputSingleParams` payload:

| Operation | Gas (with payload) | Notes |
|-----------|-------------------|-------|
| First `registerSource` (cold storage write of full struct) | ~92,116 | One-time per agent |
| `recordSignal` with 5-field ABI-encoded swap payload | ~119,262 | This is what Phase 2 mirror engine spends every signal |
| `recordSignal` with 10-byte opaque payload | ~116,254 | Lower bound — overhead is mostly the event emit + signalCount SLOAD/SSTORE |
| `recordSignal` revert (non-owner, registered agent) | ~93,536 | Storage warm-load + revert |
| `recordSignal` revert (unregistered) | ~18,937 | Cold-storage zero-check + revert (cheap path) |

**Phase 2 takeaway:** Budget ~120k gas per signal recorded on-chain. At Mantle L2 prices (~$0.0001/tx) this is economically free; spamming the event is bounded only by `uint256` `signalCount` (T-00-SR-06 — non-credible). Snapshot file (`.gas-snapshot`) was generated but NOT committed (transient measurement; numbers live here in SUMMARY).

## Deviations from Plan

### None — plan executed exactly as written.

The plan's `<action>` block specified the entire Solidity for both files verbatim; both were committed as written without modification. No Rule 1/2/3 auto-fixes were triggered; no Rule 4 architectural prompts surfaced.

The verification block specified a `jq` dependency for the JSON Success-count assertion — confirmed `jq 1.8.1` is on PATH in the worktree, so the fallback (sed/grep parse) was unnecessary. The exit-code check (Step 1) and the JSON count check (Step 2) both passed cleanly.

## TDD Gate Compliance

Plan declares `tdd="true"` on both tasks (and the GSD docs describe a RED/GREEN/REFACTOR cycle for `type: tdd` PLANS). However, the plan's `type:` frontmatter is `execute` (not `tdd`), and the two tasks are structured as separate concerns: Task 1 ships the contract, Task 2 ships the tests against it.

A strict per-task TDD cycle would have written Task 2's failing tests first, then implemented Task 1, then verified GREEN. Because Task 1 in isolation has no test target inside its own commit (Task 2 doesn't exist yet at Task 1 commit time), the conventional `test(...)` → `feat(...)` commit order is inverted here:

- **`feat(00-02): implement skeleton SourceRegistry contract`** at `ea83452` — Task 1, contract first
- **`test(00-02): add SourceRegistry test suite (6 tests)`** at `fe7228d` — Task 2, tests after

This is the order the plan's task list (Task 1 → Task 2) imposes; the plan's `<action>` blocks specify the exact files for each task and the verify block only runs after both exist. The 6 tests all pass on the unchanged Task 1 commit (no implementation changes were needed in Task 2 — confirmed by `forge test` exit 0 against the original `ea83452` contract). So the GREEN gate semantics are satisfied even though the commit type order is inverted. Documented as a TDD-gate compliance note rather than a deviation since this is the order the plan dictated.

## Authentication Gates

None. All work was local: writing two files and running `forge build` + `forge test`. No RPC calls, no signing, no API keys.

## Verification Evidence

```
=== Final verification block ===
1. forge build               → Compiler run successful! (Solc 0.8.24)
2. forge test exit code      → 0
3. forge test --json         → Success: 6, NonSuccess: 0
4. grep -v '^//' src/SourceRegistry.sol | grep -c "nonReentrant"
                             → 2
5. grep "if (s.owner != msg.sender) revert NotSourceOwner" src/SourceRegistry.sol
                             → MATCH (line 60)
```

Pass list (all 6, ordered by suite output):
- `test_recordSignal_emitsSignalRecordedAndAdvancesPerformance()` (gas: 119,262)
- `test_recordSignal_payloadShapeIsOpaqueAndPreservedInEvent()` (gas: 116,254)
- `test_recordSignal_revertsForNonOwner()` (gas: 93,536)
- `test_recordSignal_revertsForUnregisteredAgent()` (gas: 18,937)
- `test_registerSource_revertsOnDoubleRegister()` (gas: 93,120)
- `test_registerSource_setsOwnerAndEmitsEvent()` (gas: 92,116)

## Forge `--json` Schema Confirmed

The plan flagged that the `forge test --json` schema may vary across Foundry versions. Confirmed schema for **forge 1.5.1-stable** is:

```json
{
  "<artifact>:<TestContract>": {
    "test_results": {
      "<testFn>": {
        "status": "Success" | "Failure" | ...,
        "reason": ...
      }
    }
  }
}
```

Top-level keys: `["test/SourceRegistry.t.sol:SourceRegistryTest"]`. Each value contains a `test_results` map. The plan's jq expression `[.[] | .test_results | to_entries[] | select(.value.status == "Success")] | length` works as-written against this schema.

**Phase 1 / Phase 2 reuse note:** This same jq pattern should work for FollowRegistry tests in Plan 03; downstream plans can reuse the verify block verbatim.

## Known Stubs

None. SourceRegistry is a deliberate Phase 0 skeleton, but "skeleton" here means *the integration with the live ERC-8004 IdentityRegistry is deferred to Phase 1* — not that any of this contract's locked surface is stubbed out. Every function listed has real, tested behavior. The intentional Phase-1 wire-in point is documented in the contract NatSpec at the top of the file:

> /// @dev REQ-01 + CONTEXT.md D-07 (signal shape), D-08 (access control), D-09 (reentrancy).
> ///      Phase 1 wires the live ERC-8004 IIdentityRegistry.register() call against
> ///      0x8004A818BFB912233c491871b3d84c89A494BD9e on Mantle Sepolia.

This is a documented Phase-1 hand-off, not a Phase-0 stub.

## Threat Flags

None. The threats this plan introduces (T-00-SR-01 spoofing on `recordSignal`, T-00-SR-02 ownership-steal on second register, T-00-SR-03 reentrancy) are fully enumerated in the plan's `<threat_model>` register and each `mitigate` disposition is implemented + tested (T-00-SR-01 via NotSourceOwner check at line 60 + `test_recordSignal_revertsForNonOwner`; T-00-SR-02 via SourceAlreadyRegistered check at line 35 + `test_registerSource_revertsOnDoubleRegister`; T-00-SR-03 via `nonReentrant` on both state-changers, count-verified at 2). No new surface beyond the registered threat model.

## Self-Check: PASSED

- FOUND: `src/SourceRegistry.sol` (74 lines, compiles clean under Solc 0.8.24)
- FOUND: `test/SourceRegistry.t.sol` (100 lines, 6 tests pass)
- FOUND: Commit `ea83452` on `worktree-agent-a119621964b03bb80` (Task 1 — feat: SourceRegistry)
- FOUND: Commit `fe7228d` on `worktree-agent-a119621964b03bb80` (Task 2 — test: SourceRegistry suite)
- VERIFIED: `forge test --match-contract SourceRegistryTest` exits 0
- VERIFIED: `forge test --match-contract SourceRegistryTest --json` → 6 Success, 0 non-Success
- VERIFIED: `nonReentrant` appears 2 times in comment-stripped contract source
- VERIFIED: D-08 source-line gate `if (s.owner != msg.sender) revert NotSourceOwner` present
- VERIFIED: `is Ownable, ReentrancyGuard` inheritance present
- VERIFIED: `Ownable(msg.sender)` OZ v5 constructor arg present
- VERIFIED: STATE.md and ROADMAP.md NOT touched in this worktree (orchestrator owns those writes after wave completion)
