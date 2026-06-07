---
phase: 00-lock
plan: 03
subsystem: follow-registry
tags: [foundry, openzeppelin, follow-graph, reentrancy-guard, swap-and-pop, trade-executor-interface]
dependency_graph:
  requires:
    - 00-01 (foundry-toolchain-pinned, openzeppelin-v5.0.2-importable, itradeexecutor-interface)
  provides:
    - follow-registry-skeleton
    - mirrored-event-stream
    - unmirrored-event-stream
    - follow-graph-views (followersOf, following, followState)
  affects:
    - 00-04 (deploy script needs FollowRegistry artifact)
    - 00-05 (e2e test needs recordSignal → mirror narrative — mirror() is the second half)
    - phase-2-mirror-engine (consumes Mirrored event stream; reads followersOf per signal)
    - phase-2-sequa-executor (typed executor parameter slot prepared via ITradeExecutor import)
    - phase-4-ui (your-follows view consumes `following(user)`; verified-on-chain badge consumes the event stream)
tech_stack:
  added:
    - src/FollowRegistry.sol (Solidity 0.8.24, Ownable + ReentrancyGuard inheritance)
    - test/FollowRegistry.t.sol (forge-std Test fixture, 7 tests)
  patterns:
    - Swap-and-pop array bookkeeping with stored followerIndex + followingIndex per Follow record (O(1) unmirror)
    - Custom error reverts (ZeroCapital, ZeroExecutor, AlreadyFollowing, NotFollowing) — gas-cheap + structured payload
    - vm.expectEmit topic+data matching and vm.expectRevert with `abi.encodeWithSelector` for payload-bearing errors
    - Re-declaration of contract events at the test-contract level (required by forge-std for topic matching)
key_files:
  created:
    - src/FollowRegistry.sol
    - test/FollowRegistry.t.sol
  modified: []
decisions:
  - "Stored executor as `address` (not `ITradeExecutor`) in the Follow struct + mirror parameter — keeps Phase 0 testing wallet-friendly while still importing ITradeExecutor to wire the surface into the contract type graph for Phase 2 SequaExecutor migration (DEC-003)"
  - "Custom-error reverts (vs require-string) — selectors are smaller, structured payloads (sourceId, follower) are testable via abi.encodeWithSelector, and Solidity 0.8.4+ idiom"
  - "Full `delete _follows[sourceId][msg.sender]` on unmirror (vs flipping active=false in place) — honest follow-graph state; the swap-and-pop bookkeeping zeroes followerIndex + followingIndex implicitly, so the re-mirror path reseats them cleanly"
  - "Re-declared Mirrored + Unmirrored events at the test contract level — required by forge-std vm.expectEmit topic-matching pattern; event signatures are identical to the contract's"
metrics:
  duration_seconds: 273
  tasks_completed: 2
  files_created: 2
  files_modified: 0
  commits: 2
  completed_date: "2026-06-07"
commits:
  - hash: 8db682f
    type: feat
    subject: "implement FollowRegistry skeleton with typed executor surface"
  - hash: 648d6be
    type: test
    subject: "add FollowRegistry suite — 7 tests, swap-and-pop invariant"
---

# Phase 0 Plan 03: FollowRegistry Skeleton + Test Suite Summary

**One-liner:** Skeleton `FollowRegistry.sol` (mirror / unmirror / followersOf / following / followState) with swap-and-pop O(1) graph bookkeeping, ReentrancyGuard on both writes, capital-griefing + zero-executor rejects, and a 7-test Foundry suite that proves the load-bearing swap-and-pop invariant under a mixed mirror/unmirror workload.

## What Was Built

### Contract Surface (src/FollowRegistry.sol — 144 lines, 2,781 bytes deployed)

**Events**

```solidity
event Mirrored(uint256 indexed sourceId, address indexed follower, uint256 capital, address executor);
event Unmirrored(uint256 indexed sourceId, address indexed follower);
```

Indexed sourceId + indexed follower in both events gives the Phase 2 mirror engine an indexable (eth_getLogs topic-filterable) stream and the Phase 4 verified-on-chain badge an irrefutable timeline (T-00-FR-06 repudiation mitigation).

**Functions**

| Function | Mutability | Guards | Reverts |
|----------|------------|--------|---------|
| `mirror(uint256 sourceId, uint256 capital, address executor)` | external nonReentrant | nonReentrant | ZeroCapital, ZeroExecutor, AlreadyFollowing(sourceId, follower) |
| `unmirror(uint256 sourceId)` | external nonReentrant | nonReentrant | NotFollowing(sourceId, follower) |
| `followersOf(uint256 sourceId)` | external view | — | — |
| `following(address user)` | external view | — | — |
| `followState(uint256 sourceId, address follower)` | external view | — | — (returns capital, executor, mirroredAt, active) |

**Custom errors**

```solidity
error ZeroCapital();
error ZeroExecutor();
error AlreadyFollowing(uint256 sourceId, address follower);
error NotFollowing(uint256 sourceId, address follower);
```

`AlreadyFollowing` and `NotFollowing` carry the (sourceId, follower) payload so off-chain consumers (Phase 4 UI) can localize error messaging without re-decoding tx revert reasons.

**Inheritance**

```
FollowRegistry is Ownable, ReentrancyGuard
```

- `Ownable(msg.sender)` ctor — OZ v5 idiom; no privileged Phase 0 functions, inherited solely for migration hooks (T-00-FR-07 accept).
- `ReentrancyGuard` — D-09 defensive baseline; `nonReentrant` applied to `mirror` and `unmirror` (T-00-FR-02 mitigation). Comment-stripped grep count = 2 (matches plan acceptance criterion 7).

**ITradeExecutor import**

```solidity
import {ITradeExecutor} from "./interfaces/ITradeExecutor.sol";
```

Surfaces the DEC-003 executor migration architecture in the contract's type graph for Phase 2. Phase 0 stores executor as `address` (kept wallet-friendly so the Plan 05 e2e test can pass a test EOA), but the import is the visible Phase 2 anchor — judges and downstream agents reading the source see exactly where SequaExecutor plugs in. `forge build` emits a `note[unused-import]` (informational, not a warning; exit 0 unaffected); this is intentional per the plan's acceptance criterion 8.

### Swap-and-Pop Bookkeeping (the load-bearing invariant)

Each `Follow` carries `followerIndex` and `followingIndex` — the position of `msg.sender` within `_followers[sourceId]` and the position of `sourceId` within `_following[msg.sender]`, respectively. On `unmirror`, the contract:

1. Reads `idx = f.followerIndex` and the last element of `_followers[sourceId]`.
2. If `idx != last`, moves the last element into position `idx` AND updates that moved follower's stored `followerIndex` to `idx` (the line `_follows[sourceId][moved].followerIndex = idx;` — the bookkeeping-critical write).
3. Pops the now-duplicated tail.
4. Repeats the same dance for `_following[msg.sender]`.
5. `delete _follows[sourceId][msg.sender]` — full clear, no stale `active=true` bit.

Without step 2's stored-index update, a subsequent unmirror by the moved follower would target the wrong array slot and corrupt the graph. Test 7 (`test_followGraphConsistency_afterMultipleMirrorsAndUnmirrors`) exercises exactly this path: bob unmirrors from a middle index in a 3-follower array, carol gets swapped in, then bob re-mirrors and the contract must correctly reseat carol's index. All seven tests pass — the swap-and-pop bookkeeping is verified correct.

### Test Suite (test/FollowRegistry.t.sol — 7 tests, all pass)

| # | Test | Gas | What it proves |
|---|------|-----|----------------|
| 1 | `test_mirror_recordsFollowAndEmitsMirrored` | 188,573 | Base mirror() records Follow record, appends both arrays, emits Mirrored with the right topic1/topic2/data shape |
| 2 | `test_mirror_revertsOnZeroCapital` | 18,319 | T-00-FR-03 capital-griefing reject; `vm.expectRevert(ZeroCapital.selector)` |
| 3 | `test_mirror_revertsOnZeroExecutor` | 16,267 | Zero-address executor reject; `vm.expectRevert(ZeroExecutor.selector)` |
| 4 | `test_mirror_revertsOnAlreadyFollowing` | 184,766 | Idempotency via payload-bearing revert; `abi.encodeWithSelector(AlreadyFollowing.selector, SOURCE_A, alice)` |
| 5 | `test_unmirror_clearsFollowAndEmitsUnmirrored` | 154,232 | Unmirror clears follow + zeros both arrays + emits Unmirrored |
| 6 | `test_unmirror_revertsWhenNotFollowing` | 18,909 | Unmirror without a prior mirror reverts with (sourceId, follower) payload |
| 7 | `test_followGraphConsistency_afterMultipleMirrorsAndUnmirrors` | 703,486 | **Load-bearing swap-and-pop invariant** — 3 mirrors + 1 cross-source mirror + 1 middle-index unmirror + 1 re-mirror; asserts the exact end-state of all four arrays |

## Forge --json Schema Confirmation

Schema used (matches Plan 02 Task 2's schema for cross-plan consistency):

```
{
  "<artifact>": {                              // e.g. "test/FollowRegistry.t.sol:FollowRegistryTest"
    "test_results": {
      "<testFn>": {                            // e.g. "test_mirror_revertsOnZeroCapital()"
        "status": "Success" | "Failure",
        ...
      }
    }
  }
}
```

jq path used in plan verification (confirmed pass-counting works):

```
jq '[.[] | .test_results | to_entries[] | select(.value.status == "Success")] | length'
# → 7
```

If a future Foundry release changes the schema, the jq path must be updated but the COUNT == 7 semantic remains; the `forge test` exit-code check (Step 1 of verify) is the version-stable backstop.

## Verification Evidence

- `forge build` → Compiler run successful; exit 0 (1 informational unused-import note on `ITradeExecutor`, intentional per AC8).
- `forge test --match-contract FollowRegistryTest -vvv` → `Suite result: ok. 7 passed; 0 failed; 0 skipped` (exit 0).
- `forge test --match-contract FollowRegistryTest --json` → 7 Success entries, 0 non-Success — counted via the plan-prescribed jq path.
- Acceptance-criteria literal greps (all 10): PASS — see Self-Check below.
- Plan-level verification 4–6: PASS (nonReentrant count ≥ 2, ITradeExecutor import present, capital-griefing reject visible at source line).
- Deployed FollowRegistry runtime size: 2,781 bytes (≈ 11% of EIP-170 limit) — comfortable headroom for Phase 2 to add cross-contract validation calls.

## Forge Gas Snapshot (for Phase 2 mirror-engine cost budgeting)

```
FollowRegistryTest:test_followGraphConsistency_afterMultipleMirrorsAndUnmirrors() (gas: 703,486)
FollowRegistryTest:test_mirror_recordsFollowAndEmitsMirrored()                    (gas: 188,573)
FollowRegistryTest:test_mirror_revertsOnAlreadyFollowing()                        (gas: 184,766)
FollowRegistryTest:test_mirror_revertsOnZeroCapital()                             (gas:  18,319)
FollowRegistryTest:test_mirror_revertsOnZeroExecutor()                            (gas:  16,267)
FollowRegistryTest:test_unmirror_clearsFollowAndEmitsUnmirrored()                 (gas: 154,232)
FollowRegistryTest:test_unmirror_revertsWhenNotFollowing()                        (gas:  18,909)
```

**Implications for Phase 2 mirror engine and Phase 4 UI cost modeling:**

- `mirror()` first call (cold storage + new follower entry + two array pushes + event emit) — ~188k gas including the test harness overhead; the contract-side cost is roughly 130–140k. Reasonable for a one-tap follow flow on Mantle Sepolia (~$0.001 at L2 gas).
- `unmirror()` (warm storage + two array pops + delete) — ~154k including harness, ~100k contract-side. Cheaper than mirror as expected (no event payload data, no new SSTOREs for the cold slots).
- Revert-only paths (`ZeroCapital`, `ZeroExecutor`, `NotFollowing` without prior state) — ~16–19k gas. Cheap enough that adding the reverts has no UX cost.
- The graph-consistency test at 703k gas covers four mirrors + one unmirror + one re-mirror across two sources and three followers — i.e. ~140k per `mirror`/`unmirror` write on average, consistent with the per-call numbers above. No surprise gas in the swap-and-pop path.

## Deviations from Plan

None of the auto-fix or architectural-change rules triggered. The plan was executed exactly as written. Two notes on intentional choices the plan itself dictated:

1. **`ITradeExecutor` import is unused at the Solidity level (Phase 0)** — but the plan's acceptance criterion 8 requires the import line to exist for Phase 2 surface anchoring. `forge build` emits `note[unused-import]` (informational, exit 0). This is the correct Phase 0 end-state; Phase 2 will switch the executor parameter type from `address` to `ITradeExecutor` and consume the import.
2. **Local variable shadowing** — in `test_mirror_recordsFollowAndEmitsMirrored` the plan's pseudocode named the local `uint256[] memory following = registry.following(alice);` which would shadow the contract function name. I renamed it to `followingList` to keep the test free of shadowing warnings. Same semantic; no test-coverage delta.

## TDD Gate Compliance

Plan tasks carry `tdd="true"`, but the plan's `<action>` blocks lay out Task 1 = contract source and Task 2 = test source in that order, with both gated on `forge build` / `forge test` exit 0. The execution followed that explicit ordering — `feat(00-03): ...` (contract) → `test(00-03): ...` (test suite). Both commits trace to the same Plan-03 unit of work. The plan-level TDD-gate sequence (RED → GREEN → REFACTOR) does not apply here because the plan frontmatter declares `type: execute` (Plan 01 of this phase used the same `type: execute`), not `type: tdd`. No REFACTOR commit was needed — the GREEN-state code is the final shape.

## Authentication Gates

None. All work was local: file writes, `forge build`, `forge test`. No RPC calls, no signing, no API keys.

## Known Stubs

None. The FollowRegistry contract implements its full Phase 0 surface (no placeholders, no TODOs in the contract logic). The deferred items — cross-contract validation against SourceRegistry, live executor calls, ERC-20 allowance scoping — are explicitly Phase 2 scope and documented in NatSpec at the contract level, not via stub patterns. The `ITradeExecutor` import is a forward-compatibility anchor, not a stub.

## Threat Flags

None. The plan's `<threat_model>` (T-00-FR-01..T-00-FR-08) covers every trust boundary this contract introduces — follower spoofing (mitigated by `msg.sender`-as-follower), reentrancy (mitigated by `nonReentrant`), capital-griefing (mitigated by `ZeroCapital`), malicious executor (accepted, deferred to Phase 2), follow-graph privacy (accepted by design), repudiation (mitigated by indexed events), Ownable privilege (accepted; no privileged functions), and unbounded array growth (accepted; view-only, off-chain pagination is a Phase 4 concern). No new surface introduced beyond what the plan accounted for.

## Self-Check: PASSED

- FOUND: `src/FollowRegistry.sol` (144 lines, contract `FollowRegistry is Ownable, ReentrancyGuard`)
- FOUND: `test/FollowRegistry.t.sol` (148 lines, 7 test functions)
- FOUND: Commit `8db682f` (Task 1 — FollowRegistry contract)
- FOUND: Commit `648d6be` (Task 2 — test suite)
- VERIFIED: `forge build` exit 0
- VERIFIED: `forge test --match-contract FollowRegistryTest` exit 0 with `7 passed; 0 failed; 0 skipped`
- VERIFIED: `forge test --json` reports exactly 7 Success entries via the plan-prescribed jq path
- VERIFIED: nonReentrant comment-stripped grep count = 2 (matches AC7)
- VERIFIED: `import {ITradeExecutor}` line present (matches AC8)
- VERIFIED: literal `if (capital == 0) revert ZeroCapital();` present (matches AC9 and plan verification step 6)
- VERIFIED: literal `if (executor == address(0)) revert ZeroExecutor();` present (matches AC10)
- VERIFIED: deployed runtime size 2,781 bytes (well below EIP-170 24,576 cap)
- VERIFIED: swap-and-pop graph-consistency test passes — the load-bearing invariant for REQ-02 holds under a mixed workload
