---
phase: 01-source-signals
plan: 04
subsystem: infra
tags: [viem, mantle-sepolia, uniswap-v3, quoterv2, erc-8004, abi-codec, hot-path, typescript]

# Dependency graph
requires:
  - phase: 01-source-signals (01-01)
    provides: "Live venue (factory/swapRouter/quoterV2/NPM) + 4 mock tokens + 3 seeded pools + addresses.json single source of truth (chain 5003, fee=3000)"
  - phase: 01-source-signals (01-02)
    provides: "Extended SourceRegistry ABI surface (recordSignal/invalidateSignal/signalAt/performance + SignalRecorded/SignalDecoded/SignalInvalidated events + selectors/topics)"
  - phase: 01-source-signals (01-03)
    provides: "agent/ TS workspace (ESM/strict) + Signal type + the D-07 5-field tuple convention the chain codec mirrors"
provides:
  - "agent/src/chain/reconcile-shared.ts — the SHARED 5-field signal-tuple codec (encodeSignal/decodeSignal/matchKey) written ONCE (D-40), byte-identical to Solidity abi.encode (cast-fixture asserted)"
  - "agent/src/chain/recordSignal.ts — recordSignalThenSwap hot path (2-tx: recordSignal 5-field tuple -> exactInputSingle 8-field router struct), invalidate-on-revert (D-30), ensureApprovals max-approve (D-29)"
  - "agent/src/chain/quote.ts — QuoterV2 spot read via simulateContract only (non-view, Pitfall 2) + PriceSeriesBuffer (D-02 replay)"
  - "agent/src/chain/clients.ts — viem public/wallet clients + runtime addresses.json loader (requireSourceRegistry/requireAgentId throw, never hard-code, W2)"
  - "agent/src/chain/abis.ts — minimal typed ABIs (SourceRegistry, 8-field SwapRouter struct, QuoterV2, IdentityRegistry+Transfer, ERC20)"
  - "agent/scripts/registerIdentity.ts — one-shot ERC-8004 mint + registerSource capturing agentId from the mint event (NOT 1); BUILT + type-checked, live mint DEFERRED to Plan 06"
affects: [01-05 (poll-loop + reconciler import these chain exports), 01-06 (live ERC-8004 mint + SourceRegistry redeploy run registerIdentity), 02-mirror-execution (shares the 5-field codec)]

# Tech tracking
tech-stack:
  added:
    - "viem@2.52.2 (exact-pin, RESEARCH Standard Stack — clients, ABI codec, simulateContract, event decode)"
    - "dotenv@^16 (direct dep; runtime .env load for OPERATOR_PRIVATE_KEY)"
  patterns:
    - "Runtime address resolution: every venue/registry/agentId read from addresses.json at call time; requireSourceRegistry/requireAgentId throw rather than fall back to a stale dev address (W2)"
    - "Single-source ABI codec (D-40): the 5-field tuple encode/decode lives once in reconcile-shared.ts, imported by both runtime and the reconciler; cast-fixture byte-equality guards the wire format"
    - "5-field signal tuple kept DISTINCT from the 8-field UniV3 router struct — the router struct is derived at swap time, never conflated (anti-conflation header is the gate)"
    - "QuoterV2 read exclusively via simulateContract (non-view); no view/static read of the quoter appears in quote.ts"
    - "Secrets read lazily (only when a wallet/key function is called) so module import stays offline — the test/eval gates load the chain layer with no key present"

key-files:
  created:
    - agent/src/chain/clients.ts
    - agent/src/chain/abis.ts
    - agent/src/chain/reconcile-shared.ts
    - agent/src/chain/quote.ts
    - agent/src/chain/recordSignal.ts
    - agent/scripts/registerIdentity.ts
    - agent/test/reconcileShared.test.ts
  modified:
    - agent/package.json
    - agent/package-lock.json
    - agent/tsconfig.json

key-decisions:
  - "addresses.json sourceRegistry + agentId modeled as OPTIONAL in RuntimeAddresses; consumers call requireSourceRegistry/requireAgentId which throw a clear error until Plan 06 / registerIdentity fill them (never a silent stale fallback)"
  - "Canonical ERC-8004 IdentityRegistry read from env-or-default (ERC8004_IDENTITY_REGISTRY || 0x8004A818…) — the ONE immutable protocol address, kept out of the hot path so recordSignal.ts has zero 0x address literal"
  - "tsconfig include extended with scripts/** so registerIdentity.ts is type-checked by tsc --noEmit (it was outside the original src/test/eval include)"
  - "matchKey lowercases addresses so a log-derived (lowercase) swap address joins a checksummed runtime address; amountIn is bigint so the reconciler join key is exact"

patterns-established:
  - "Pattern: chain-layer functions take a ChainContext (clients + runtime addresses + agentId) — no module-level singletons holding chain addresses, so Plan 05 wires one context from addresses.json"
  - "Pattern: hot path returns signalId on success / null after on-chain invalidateSignal on swap revert — the off-path narration fires only after this returns"

requirements-completed: [REQ-01, REQ-06]

# Metrics
duration: 75min
completed: 2026-06-11
---

# Phase 1 Plan 04: Chain Layer Summary

**The viem chain bridge between the deployed venue/registry (Plans 01/02) and the agent runtime (Plan 05): a write-once 5-field signal codec (byte-identical to on-chain abi.encode), the 2-tx recordSignal→swap hot path with invalidate-on-revert, the QuoterV2 simulate-only price read, and a built-but-deferred ERC-8004 mint script that captures the real agentId from the mint event.**

## Performance

- **Duration:** ~75 min
- **Started:** 2026-06-11T00:38:36Z (session start)
- **Completed:** 2026-06-11
- **Tasks:** 3 (Task 1 TDD RED→GREEN; Task 2 auto; Task 3 built + deferred)
- **Files created:** 7 (+ 3 modified)

## Accomplishments

- **Shared 5-field signal codec (D-40), Task 1.** `reconcile-shared.ts` exports `encodeSignal` / `decodeSignal` / `matchKey` — the ONE definition of the D-07 `(tokenIn, tokenOut, amountIn, minAmountOut, fee)` wire format, imported by both the runtime hot path and (Plan 05) the reconciler. A vitest gate proves it round-trips AND is byte-for-byte identical to a `forge cast abi-encode "f(address,address,uint256,uint256,uint24)"` fixture, so the bytes `recordSignal` stores are exactly what the on-chain `SignalDecoded` / `decodeSignalTuple` re-decode. The file carries the mandatory anti-conflation header ("5-FIELD … NOT the 8-field router struct").
- **QuoterV2 price read via simulateContract only (Pitfall 2), Task 1.** `quote.ts` reads the spot quote with viem `simulateContract` (the non-view path) and never a view/static read of the quoter — `grep -c readContract quote.ts` = 0. Ships a `PriceSeriesBuffer` the caller owns for replay determinism (D-02).
- **recordSignal→swap hot path (D-25/D-29/D-30), Task 2.** `recordSignalThenSwap` runs the 2-tx flow from the operator EOA: `recordSignal(agentId, encoded5FieldTuple)` → decode `signalId` from `SignalRecorded` → `exactInputSingle` with the **8-field** router struct DERIVED from the 5-field tuple (`recipient=operator`, `deadline=now+120`, `amountOutMinimum=minAmountOut` as the slippage bound T-1-12, `sqrtPriceLimitX96=0`). On swap revert it calls `invalidateSignal` (inside the catch) and returns `null` — we don't hide misses. `ensureApprovals` does the one-time `approve(SwapRouter, type(uint256).max)` per token, idempotent.
- **ERC-8004 mint + registerSource, Task 3 (BUILT, live mint DEFERRED to Plan 06).** `registerIdentity.ts` implements the full RESEARCH Pattern 5: `register(AGENT_URI)` → capture the agentId from the `Transfer(0x0→owner, tokenId)` mint log (NOT assumed 1 — Pitfall 6) → assert `ownerOf(agentId)==operator` + `getAgentWallet` → `registerSource(agentId, strategyMeta)` → persist agentId to addresses.json + agent/.env. It type-checks (`tsc --noEmit` clean) but was NOT run — no on-chain write was performed (there is no AGENT_URI yet; Plan 06 publishes it).
- **No hard-coded addresses (W2).** Every venue/registry address and the agentId are read at runtime from addresses.json; `requireSourceRegistry`/`requireAgentId` throw until Plan 06 / the mint fill them. `grep -nE "0x[a-fA-F0-9]{40}" recordSignal.ts` is empty.

## Exported chain-layer interface (what Plan 05 imports)

From `agent/src/chain/recordSignal.ts`:
- `recordSignalThenSwap(ctx: ChainContext, signal: SignalParams): Promise<string | null>` — the hot path; await it, then fire narration off-path.
- `ensureApprovals(ctx: ChainContext, tokens: Address[]): Promise<void>` — startup max-approve.
- `MAX_UINT256`, `SWAP_DEADLINE_BUFFER_SECONDS`, and the `ChainContext` / `SignalParams` types.

From `agent/src/chain/quote.ts`:
- `quote(pub, quoterV2, tokenIn, tokenOut, amountIn, fee): Promise<bigint>` — simulate-only spot read.
- `quoteAndRecord(...)` + the `PriceSeriesBuffer` class (D-02 replay buffer).

From `agent/src/chain/reconcile-shared.ts` (also imported by the Plan 05 reconciler — D-40):
- `encodeSignal(tokenIn, tokenOut, amountIn, minAmountOut, fee): Hex`
- `decodeSignal(encoded: Hex): DecodedSignal`
- `matchKey(tokenIn, tokenOut, amountIn): string`

From `agent/src/chain/clients.ts`:
- `makePublicClient`, `makeOperatorWalletClient`, `operatorAccount`, `loadAddresses`, `addressesJsonPath`, `requireSourceRegistry`, `requireAgentId`, `requireOperatorKey`, plus `mantleSepolia` / the `RuntimeAddresses` types.

From `agent/src/chain/abis.ts`:
- `sourceRegistryAbi`, `swapRouterAbi`, `quoterV2Abi`, `identityRegistryAbi`, `erc20Abi`.

## agentId-capture mechanism (Pitfall 6)

`registerIdentity.ts`'s `captureAgentId` scans the `register()` receipt logs for an ERC-721 `Transfer` emitted by the IdentityRegistry whose `from` is the zero address (a mint) and returns its indexed `tokenId` — that tokenId IS the agentId. It is NEVER assumed to be 1 (the canonical Sepolia registry already has 140+ agents; Spike #3 observed the next id at 146). The captured id is asserted to be owned by the operator, then persisted to `addresses.json.agentId` + `agent/.env` (`AGENT_ID=…`) and threaded into `registerSource` and (at runtime) every `recordSignal` via `requireAgentId`.

## Deferred live-mint sequencing into Plan 06

The live ERC-8004 mint + `registerSource` is intentionally deferred (the plan's Task 3 is a `checkpoint:human-action`; the orchestrator resolved it as "deferred to Plan 06"). Plan 06 owns the on-chain side:
1. Plan 06 redeploys the extended SourceRegistry (Plan 02's `DeploySourceRegistryV1.s.sol`) and writes the new address into `addresses.json.sourceRegistry` — at which point `requireSourceRegistry` stops throwing.
2. Plan 06 publishes the static GitHub-Pages `AGENT_URI` JSON (D-28) and sets it in `agent/.env`.
3. With a funded operator EOA (Spike #3: ~181k gas budget for the mint), Plan 06 runs `registerIdentity.ts`. The script mints, captures the real agentId from the mint event, asserts ownership, calls `registerSource`, and persists `agentId` to `addresses.json` + `agent/.env`.
4. The Plan 05 runtime then reads `sourceRegistry` + `agentId` at runtime and the hot path goes live.

No on-chain write happened in this plan; `addresses.json` is unchanged (no `agentId` / `sourceRegistry` fields written).

## Task Commits

1. **Task 1: shared codec + quote (TDD)** — `7d48f1f` (test, RED) → `22b47b0` (feat, GREEN)
2. **Task 2: recordSignal-then-swap hot path** — `325c252` (feat)
3. **Task 3: ERC-8004 mint + registerSource one-shot (built, deferred)** — `966b821` (feat)

**Plan metadata:** see final docs commit.

## TDD Gate Compliance

Task 1 is `tdd="true"` and satisfied the RED→GREEN gate in git history: `test(01-04): failing codec test` (`7d48f1f`) was verified failing (the `reconcile-shared` module did not exist — suite failed to load) BEFORE the implementation, then `feat(01-04): chain clients + … codec` (`22b47b0`) turned it green (6/6). No test passed unexpectedly during RED. No REFACTOR commit was needed.

## Files Created/Modified

- `agent/src/chain/clients.ts` — viem public/wallet clients for Mantle Sepolia + the runtime addresses.json loader; `requireSourceRegistry`/`requireAgentId` throw rather than hard-code (W2); secrets read lazily.
- `agent/src/chain/abis.ts` — minimal typed ABIs: SourceRegistry surface, the 8-field SwapRouter `ExactInputSingleParams`, QuoterV2 `quoteExactInputSingle`, IdentityRegistry + the ERC-721 `Transfer` event, ERC20.
- `agent/src/chain/reconcile-shared.ts` — the shared 5-field signal codec (D-40) + `matchKey`; anti-conflation header.
- `agent/src/chain/quote.ts` — QuoterV2 simulate-only read + `PriceSeriesBuffer`.
- `agent/src/chain/recordSignal.ts` — `recordSignalThenSwap` hot path + `ensureApprovals`; invalidate-on-revert.
- `agent/scripts/registerIdentity.ts` — one-shot ERC-8004 mint + registerSource (built; live mint deferred to Plan 06).
- `agent/test/reconcileShared.test.ts` — round-trip + cast-fixture byte-equality + matchKey tests (6).
- `agent/package.json` / `agent/package-lock.json` — pin viem@2.52.2 + dotenv.
- `agent/tsconfig.json` — added `scripts/**` to `include` so the one-shot type-checks.

## Decisions Made

- **Optional `sourceRegistry`/`agentId` in `RuntimeAddresses` with throwing accessors** — the only safe way to honor W2 (no stale dev address) while letting Plan 06 / the mint fill them later. A missing field is a loud error, not a silent wrong-address swap.
- **Canonical IdentityRegistry via env-or-default, kept out of the hot path** — the one immutable protocol address (DEC-004) lives in `registerIdentity.ts` only, so the hot path (`recordSignal.ts`) has zero `0x` address literal and passes the W2 grep gate.
- **`tsconfig include` extended with `scripts/**`** — required so `npx tsc --noEmit` actually type-checks `registerIdentity.ts` (the original include covered only `src`/`test`/`eval`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] viem (and a direct dotenv) were not installed in the agent workspace**
- **Found during:** Task 1 (chain clients/codec need viem; Plan 03 installed only @anthropic-ai/sdk + zod + dev tooling)
- **Issue:** `import … from 'viem'` would not resolve / type-check — viem is the chain layer's core dependency and was absent from `agent/package.json` dependencies (only a transitive dotenv existed).
- **Fix:** `npm install viem@2.52.2 dotenv@^16` (the exact viem version RESEARCH pins). Pinned in `package.json`; lockfile updated.
- **Files modified:** agent/package.json, agent/package-lock.json
- **Verification:** `node -e` confirms viem 2.52.2 + the `encodeAbiParameters`/`decodeAbiParameters` exports; `tsc --noEmit` clean; codec test green.
- **Committed in:** `22b47b0` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] tsconfig did not include scripts/**, so registerIdentity.ts would be skipped by tsc**
- **Found during:** Task 3 (the acceptance gate requires registerIdentity.ts to type-check under `tsc --noEmit`)
- **Issue:** The Plan-03 tsconfig `include` was `["src/**", "test/**", "eval/**"]` — `scripts/registerIdentity.ts` would not be type-checked at all, silently passing the gate without coverage.
- **Fix:** Added `"scripts/**/*.ts"` to `include`.
- **Files modified:** agent/tsconfig.json
- **Verification:** `tsc --noEmit` exit 0 WITH the script in scope.
- **Committed in:** `966b821` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking; one missing core dependency, one toolchain include). No functional/behavioral change beyond enabling the planned work to type-check. No scope creep — both touch files already implied by the plan's `files_modified`.

## Issues Encountered

- **The `grep -c readContract quote.ts` gate flagged documentation comments.** The initial `quote.ts` mentioned `readContract` in explanatory comments ("never readContract"), so the literal grep returned 3 despite there being zero actual calls. Reworded the comments to "view/static read" so the HARD GATE (`grep -c readContract quote.ts == 0`) holds exactly. Functionally unchanged — `simulateContract` is and always was the only quoter call.
- **SDK state handlers unavailable.** As in Plans 02/03, `@gsd-build/sdk` is not installed under `node_modules` and the bundled `gsd-sdk` CLI on PATH does not recognize the dot-namespaced `state.*` query handlers. STATE.md / ROADMAP.md updates were applied directly via Edit (same approach as the prior plans). All commits used normal `git commit` (hooks on, no `--no-verify`).
- **Windows LF→CRLF warnings on `git add`** — benign (no `.gitattributes` enforcing LF; content/tests unaffected).
- **promptfoo dev-tree npm-audit vulnerabilities** — pre-existing, dev-only transitive deps of promptfoo (logged in Plan 03); out of scope (not fixed per the scope boundary).

## User Setup Required

None for this plan's deliverables. The live mint (Plan 06) will require: `OPERATOR_PRIVATE_KEY` (funded operator EOA) and `AGENT_URI` (the GitHub-Pages JSON URL) in `agent/.env`, plus `addresses.json.sourceRegistry` from the Plan 06 redeploy. The offline gates (`tsc --noEmit`, `vitest`) run with no key.

## Known Stubs

None. `requireSourceRegistry` / `requireAgentId` throw clear "filled by Plan 06 / the mint" errors — these are deliberate not-yet-available guards (W2), not stubs that return empty data to a UI. `registerIdentity.ts` is a complete implementation; only its *execution* is deferred (the orchestrator-decided "deferred to Plan 06"), not its code. No UI-facing empty/mock data path exists in this plan.

## Threat Flags

None. No new security surface beyond the plan's `<threat_model>`. The four register dispositions are honored: T-1-01 (key read lazily from gitignored .env, never at import), T-1-12 (`amountOutMinimum = minAmountOut` slippage bound on every swap), T-1-13 (agentId captured from the mint event + `ownerOf==operator` assert), T-1-06 (all venue addresses read from addresses.json, never stale FusionX consts).

## Next Phase Readiness

- **Plan 05 (poll-loop + reconciler):** imports `recordSignalThenSwap` / `ensureApprovals` / `quote` / `PriceSeriesBuffer` / `encodeSignal` / `decodeSignal` / `matchKey` and the `clients.ts` helpers. The reconciler reuses the SAME `reconcile-shared.ts` codec (D-40). Plan 05 builds one `ChainContext` from `loadAddresses()` + `makeOperatorWalletClient()` + `requireAgentId`.
- **Plan 06 (live redeploy + mint):** runs `registerIdentity.ts` after publishing AGENT_URI + redeploying SourceRegistry (writes `addresses.json.sourceRegistry`). Budget ~181k gas for the mint (Spike #3).
- **No blockers.** The offline gates (`tsc --noEmit` clean, `reconcileShared.test` 6/6, full suite 72/72) are green with no live chain and no API key.

## Self-Check: PASSED

Re-verified all acceptance criteria + file/commit existence:
- **Files:** clients.ts, abis.ts, reconcile-shared.ts, quote.ts, recordSignal.ts (agent/src/chain), registerIdentity.ts (agent/scripts), reconcileShared.test.ts (agent/test) — all FOUND on disk.
- **Commits:** `7d48f1f` (RED), `22b47b0` (T1 GREEN), `325c252` (T2), `966b821` (T3) — all FOUND in git log.
- **Gates:** `tsc --noEmit` exit 0; `reconcileShared.test` 6/6 green; full suite 72/72; `grep -c readContract quote.ts` = 0; `simulateContract` present in quote.ts; anti-conflation header present in reconcile-shared.ts; `exactInputSingle` with all 8 fields + `invalidateSignal` in catch + `amountOutMinimum: signal.minAmountOut` + `MAX_UINT256` in recordSignal.ts; `grep -nE "0x[a-fA-F0-9]{40}" recordSignal.ts` empty; registerIdentity captures agentId from the Transfer mint log (not 1).
- **No live mint run:** addresses.json has no `agentId`/`sourceRegistry`; no on-chain write performed.

---
*Phase: 01-source-signals*
*Completed: 2026-06-11*
