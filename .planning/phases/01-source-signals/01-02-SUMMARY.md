---
phase: 01-source-signals
plan: 02
subsystem: contracts
tags: [solidity, foundry, source-registry, abi-events, erc-8004, mantle]

# Dependency graph
requires:
  - phase: 00-lock
    provides: SourceRegistry Phase 0 skeleton (registerSource/recordSignal/performance), DeployPhase0 script shell, SourceRegistry test suite, FollowRegistry
provides:
  - "SourceRegistry.invalidateSignal(agentId, signalId, reason) — owner-gated honesty marker (D-30)"
  - "SourceRegistry.signalAt(agentId, signalId) view returning persisted raw signal bytes (D-33)"
  - "SourceRegistry.invalidated(agentId, signalId) public bool getter for the reconciler"
  - "Typed SignalDecoded event emitted alongside the unchanged SignalRecorded (additive, D-33)"
  - "SignalInvalidated event for reconciler exclusion of invalidated signals"
  - "script/DeploySourceRegistryV1.s.sol — redeploy script (compiles; NOT broadcast in this plan)"
affects: [01-source-signals reconciler (Plan 05), 01-source-signals live redeploy + smoke (Plan 06), 02-mirror-execution, 04-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Defensive guarded ABI-decode via external self-call + try/catch (recordSignal stays opaque, never reverts on malformed bytes)"
    - "Additive event evolution: new typed event emitted alongside a frozen legacy event (listener stability)"

key-files:
  created:
    - script/DeploySourceRegistryV1.s.sol
  modified:
    - src/SourceRegistry.sol
    - test/SourceRegistry.t.sol

key-decisions:
  - "Guarded decode uses an external `this.decodeSignalTuple(...)` + try/catch — abi.decode reverts cannot be caught inline, so the only safe way to keep recordSignal non-reverting on non-conforming bytes (D-07 opacity, T-1-05) is an external call boundary."
  - "Reworded the deploy-script NatSpec to avoid the literal token `FollowRegistry` so the D-31 acceptance gate `grep -c FollowRegistry == 0` holds while preserving the 'follow-side registry untouched' intent."

patterns-established:
  - "Defensive guarded decode: external pure helper + try/catch so a malformed opaque payload skips the typed emit but still records."
  - "Additive ABI evolution: SignalRecorded frozen byte-for-byte; SignalDecoded added alongside (topic0 of SignalRecorded unchanged from Phase 0)."

requirements-completed: [REQ-01]

# Metrics
duration: ~22min
completed: 2026-06-10
---

# Phase 1 Plan 02: SourceRegistry Extension Summary

**Extended SourceRegistry with `invalidateSignal` (D-30), `signalAt` (D-33), and a typed `SignalDecoded` event emitted alongside the byte-for-byte-unchanged `SignalRecorded`, plus a redeploy script — all 12 tests green, no on-chain broadcast.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-10T19:34Z
- **Completed:** 2026-06-10T19:56:27Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- Added the on-chain track-record surface the reconciler (Plan 05) and the Phase 2 mirror engine consume: `invalidateSignal`, `signalAt`, `invalidated` getter, `SignalDecoded` + `SignalInvalidated` events.
- Preserved the `SignalRecorded` event signature byte-for-byte (verified: topic0 unchanged) — Phase 2 listener stability held.
- `recordSignal` now persists raw bytes and emits a typed decode alongside the legacy event, while a malformed/opaque payload still records without reverting (D-07 opacity, threat T-1-05).
- 6 new tests (12 total) cover round-trip, typed-emit topic, invalidation flag+emit, both revert paths, and the opaque-still-records guarantee. All Phase 0 tests preserved.
- Redeploy script `DeploySourceRegistryV1.s.sol` compiles and deploys ONLY SourceRegistry (D-31); not broadcast (live redeploy deferred to Plan 06).

## New ABI Surface (for the reconciler + Phase 2 engine)

### Function selectors
| Selector | Signature | Notes |
|----------|-----------|-------|
| `0x5c9e8f46` | `recordSignal(uint256,bytes)` | UNCHANGED selector; now also persists bytes + emits SignalDecoded |
| `0xdc77a8d3` | `invalidateSignal(uint256,uint256,string)` | NEW — owner-gated + nonReentrant (D-30) |
| `0x2cdad545` | `signalAt(uint256,uint256)` | NEW — view, returns persisted raw bytes (D-33) |
| `0xb942559a` | `invalidated(uint256,uint256)` | NEW — public mapping getter (bool) for the reconciler |
| `0xf1878377` | `performance(uint256)` | UNCHANGED — returns (uint256 signalCount, uint64 lastSignalAt); no on-chain PnL (D-32) |

### Event topic0 hashes
| topic0 | Event | Status |
|--------|-------|--------|
| `0x7891497d451a0f147598b8343c1af23636dde3dd80b83907d55ee3102b141c24` | `SignalRecorded(uint256,uint256,bytes,uint64)` | **UNCHANGED from Phase 0** — Phase 2 listener stability (RESEARCH A4) |
| `0x605d1bf9fac90c3cbec0b5b0f62c9de7d06e6a770fa62d629a8f51a6689e0414` | `SignalDecoded(uint256,uint256,address,address,uint256,uint256,uint24)` | NEW — additive; indexed `agentId, signalId, tokenIn` |
| `0xc27e4ee08ac2f8c3abd108eb6df99a1ee70a6d79d1e451fcb7f0c2f4b2f04988` | `SignalInvalidated(uint256,uint256,string,uint64)` | NEW — indexed `agentId, signalId` |

**SignalRecorded backward-compatibility CONFIRMED:** the event declaration is byte-for-byte identical to Phase 0 and its topic0 hash matches the unchanged signature `SignalRecorded(uint256,uint256,bytes,uint64)`. Any Phase 0 / Phase 2 listener decoding the legacy event continues to work against the redeployed (new-address) contract without changes. `SignalDecoded` is strictly additive — it is emitted ALONGSIDE, never in place of, `SignalRecorded`.

The reconciler (Plan 05) walks `SignalRecorded` + `SignalInvalidated` and excludes invalidated signals from the match-rate gate; the Phase 2 mirror engine can index `SignalDecoded` on `tokenIn` without ABI-decoding bytes in each handler.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SourceRegistry — invalidateSignal, signalAt, typed SignalDecoded, persisted bytes** — `119bba8` (feat)
2. **Task 2: Extend tests + add redeploy script** — `7f95872` (test)

_Note: Both tasks are `tdd="true"`. The contract implementation (Task 1) and the formal test suite (Task 2) are split by the plan's task boundaries; the GREEN gate is the 12-passing-test run after Task 2. See TDD Gate Compliance below._

**Plan metadata:** committed separately (this SUMMARY + STATE/ROADMAP updates).

## Files Created/Modified
- `src/SourceRegistry.sol` — Added `_signalData` + `invalidated` mappings, `SignalDecoded` + `SignalInvalidated` events, `invalidateSignal`, `signalAt`, external `decodeSignalTuple` helper; extended `recordSignal` to persist bytes + emit the guarded typed event. `performance()` and `SignalRecorded` left unchanged.
- `test/SourceRegistry.t.sol` — Mirrored the two new events; added 6 tests (signalAt round-trip, typed-decode topic, invalidate flag+emit, non-owner revert, unregistered revert, opaque-still-records).
- `script/DeploySourceRegistryV1.s.sol` — NEW redeploy script (env-key + broadcast shell copied from DeployPhase0); deploys only SourceRegistry (D-31).

## Decisions Made
- **External guarded decode (Task 1):** `abi.decode` reverts cannot be caught inline in Solidity, so the defensive decode that must not revert `recordSignal` on non-conforming bytes is implemented as `try this.decodeSignalTuple(signal) { emit } catch {}`. The helper is `external pure`, exposes no privileged surface, and is gated behind a `signal.length >= 160` (5 ABI words) pre-check to skip the external call for obviously-short payloads.
- **`performance()` and `SignalRecorded` deliberately untouched** to satisfy D-32 (no on-chain PnL) and Phase 2 listener stability (RESEARCH A4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded deploy-script NatSpec to satisfy the D-31 grep gate**
- **Found during:** Task 2 (redeploy script)
- **Issue:** The acceptance criterion `grep -c "FollowRegistry" script/DeploySourceRegistryV1.s.sol` must return `0`, but the initial NatSpec comment used the literal word "FollowRegistry" while explaining that it is intentionally not redeployed — this made the literal-token grep return `1`.
- **Fix:** Reworded the comment to "the follow-side registry is intentionally left untouched" so the D-31 intent is preserved without the literal token.
- **Files modified:** script/DeploySourceRegistryV1.s.sol
- **Verification:** `grep -c "FollowRegistry"` now returns `0`; script still compiles (`forge build` exit 0).
- **Committed in:** 7f95872 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — documentation-only).
**Impact on plan:** No functional change; only a comment reword to satisfy a literal acceptance gate. No scope creep.

## TDD Gate Compliance

Plan tasks are `tdd="true"` but split contract (Task 1) from formal tests (Task 2) per the plan's explicit task boundaries. The conventional RED-before-GREEN single-commit ordering is therefore not present in git history: Task 1 is a `feat` commit (contract, verified against the preserved Phase 0 tests staying green), Task 2 is a `test` commit (6 new tests, all GREEN). No standalone failing-test (RED) commit exists because the plan assigned all named tests to Task 2 after the implementation. The GREEN gate (12/12 tests passing) is satisfied and verified. This ordering follows the plan's task decomposition exactly.

## Issues Encountered
- The bundled `gsd-sdk` CLI on PATH does not recognize the dot-namespaced query handlers (`state.load`, `state.advance-plan`, etc.) used by the SDK execution protocol, and `@gsd-build/sdk` is not installed under `node_modules`. STATE.md / ROADMAP.md updates were therefore applied directly via Edit rather than via SDK query handlers. All git commits used normal `git commit` (hooks on, no `--no-verify`).

## Threat Surface
All three threat-register dispositions for this plan are mitigated and test-covered:
- **T-1-03 (Tampering, unauthorized invalidate):** `NotSourceOwner` gate carried verbatim into `invalidateSignal` — `test_invalidateSignal_revertsForNonOwner`.
- **T-1-04 (Tampering, reentrancy):** `nonReentrant` on `invalidateSignal` (and unchanged on `recordSignal`).
- **T-1-05 (DoS, malformed bytes revert recordSignal):** guarded external decode — `test_recordSignal_opaquePayloadStillRecords` proves a non-conforming payload still records and signalCount advances.

No new security surface introduced beyond the plan's threat model.

## User Setup Required
None - no external service configuration required. (No `--broadcast` was run; the live redeploy + verify + manifest update is Plan 06.)

## Next Phase Readiness
- Extended SourceRegistry source + redeploy script ready. **Plan 06** runs the actual on-chain redeploy + verify + `deployments/sepolia.json` / `DEPLOYMENT.md` update (new address — Phase 0 agentId 1 does NOT carry over).
- The ABI surface table above is the contract the **reconciler (Plan 05)** and **Phase 2 mirror engine** build against.
- File-disjoint from the other Wave 1 plans (no SequaConstants / lib touch) — clean parallel merge.

## Self-Check: PASSED

- FOUND: src/SourceRegistry.sol
- FOUND: test/SourceRegistry.t.sol
- FOUND: script/DeploySourceRegistryV1.s.sol
- FOUND commit: 119bba8 (Task 1)
- FOUND commit: 7f95872 (Task 2)
- forge build: exit 0 (clean; only pre-existing out-of-scope FollowRegistry unused-import lint note)
- forge test --match-contract SourceRegistryTest: 12 passed, 0 failed, 0 skipped
- No on-chain broadcast performed.

---
*Phase: 01-source-signals*
*Completed: 2026-06-10*
