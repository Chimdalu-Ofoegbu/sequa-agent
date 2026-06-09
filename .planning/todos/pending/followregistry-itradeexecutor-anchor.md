---
title: Resolve FollowRegistry unused-import lint by wiring ITradeExecutor into mirror() surface
created: 2026-06-08
created_in_phase: 0
resolves_phase: 2
priority: low
type: cleanup
source: phase-0-verification anti-pattern scan (info-level)
---

## What

`src/FollowRegistry.sol` imports `ITradeExecutor` (line 6) but never uses the type in its body — `mirror()` takes `address executor` instead of `ITradeExecutor executor`. `forge build` emits an info-level `unused-import` lint note.

## Why deferred to Phase 2

The import is an **intentional type-graph anchor**, not an oversight (per Plan 00-03 AC8 and the NatSpec at FollowRegistry.sol:13-15). Resolving it now would require:

- **Path B** (strengthen the type usage with a constant like `bytes4 constant TRADE_EXECUTOR_INTERFACE_ID = type(ITradeExecutor).interfaceId;`) — changes deployed bytecode, forces FollowRegistry redeploy + re-verify + manifest edits + Wave 4 re-run of the e2e proof txs. Bad trade for an `info`-level lint.
- **Path C** (delete the import) — abandons the documented design intent.

Phase 2 ships `SequaExecutor.sol`, the live implementer of `ITradeExecutor`. At that point `FollowRegistry.mirror()` upgrades from `address executor` to either `ITradeExecutor executor` (typed param) or calls `ITradeExecutor(executor).executeTrade(...)` directly. Either path uses the import legitimately — lint resolves naturally with no rework cost.

## Resolution criteria

- `forge build` runs clean with no `unused-import` note on `src/FollowRegistry.sol`
- Either the `mirror()` signature is updated to take `ITradeExecutor`, OR the contract body invokes `ITradeExecutor(executor).executeTrade(...)` at least once

## References

- `src/FollowRegistry.sol:6` — the import line
- `src/FollowRegistry.sol:13-15` — the NatSpec documenting Phase 2 intent
- `.planning/phases/00-lock/00-03-PLAN.md` AC8 — original requirement that authorized the import
- `.planning/phases/00-lock/00-VERIFICATION.md` — anti-pattern scan that flagged this as info-level
