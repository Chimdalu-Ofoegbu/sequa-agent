---
phase: 01-source-signals
plan: 05
subsystem: agent
tags: [typescript, node20, viem, anthropic-sdk, poll-loop, reconciler, healthz, noise-bot, fail-closed]

# Dependency graph
requires:
  - phase: 01-source-signals (01-03)
    provides: "pure decideSignals + narrateSignalSafe + fallbackThesis + signalFidelity/bannedPhrases guardrails + Signal/PortfolioState types"
  - phase: 01-source-signals (01-04)
    provides: "recordSignalThenSwap + ensureApprovals (hot path), quote + PriceSeriesBuffer, encodeSignal/decodeSignal/matchKey (shared codec D-40), viem clients/abis"
provides:
  - "agent/src/index.ts — the 30s poll loop runtime: await recordSignalThenSwap (HOT PATH) then void narrateAndStore (NEVER awaited); cooldown (D-06) + daily cap (D-10) + pause (D-11) + pair-order (D-16) enforced; pre-publish fidelity+banned guardrails; structured logs (AI-SPEC §4/§7)"
  - "agent/src/config.ts — assertConfig() FAIL-CLOSED boot guard (W3): throws on unset/zero agentId (positive int, Pitfall 6), sourceRegistry/swapRouter/quoterV2, 4 token addresses, OPERATOR_PRIVATE_KEY + strategy constants single source of truth"
  - "agent/src/store/thesisStore.ts — writeThesis -> theses/<agentId>/<signalId>.json + debounced git commit+push via GITHUB_PAT (D-09/D-37); never throws (off hot path)"
  - "agent/src/health.ts — GET /healthz -> {lastTickAt,lastSignalAt,fallbackRate,paused} (D-38)"
  - "agent/scripts/reconcile.ts — reconciler CLI + --assert PHASE 1 ACCEPTANCE GATE (D-40): pure classify() over {matched,invalidated,orphan}, exits non-zero on orphan>0; imports the shared codec"
  - "agent/scripts/noiseBot.ts — ambient noise bot on a SEPARATE NOISE_BOT EOA (D-24): real exactInputSingle swaps, never records signals, Math.random pair/amount/timing"
affects: [01-06 (live mint + redeploy fills addresses.json.sourceRegistry/agentId so the loop + reconciler go live), 02-mirror-execution (consumes SignalRecorded), 04-frontend (reuses the reconciler classifier behind the Verify badge)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Poll-loop ordering invariant: const signalId = await recordSignalThenSwap(...); if null return; void narrateAndStore(...).catch(...) — narration is fire-and-store, NEVER awaited (AI-SPEC §4 / Pitfall 5)"
    - "Fail-closed boot guard: assertConfig() validates every required on-chain value + the operator key and THROWS at the top of index/reconcile/noiseBot before any chain call (W3 / Pitfall 6 / T-1-13)"
    - "Pure-classifier reconciler: classify(signals, invalidatedIds, swaps) is I/O-free so reconcile.test.ts unit-tests {matched,invalidated,orphan} with fixture arrays — chain reads (getLogs/swap decode) live in separate functions"
    - "Correct ESM entry guard (src/isEntry.ts): compare resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]) so importing a runnable script in a test never executes its main()"
    - "Debounced off-chain thesis push: write JSON immediately, coalesce a window of writes into one git commit+push (commit-flood mitigation, D-37); a push/write failure logs + degrades, never throws (off hot path)"

key-files:
  created:
    - agent/src/config.ts
    - agent/src/store/thesisStore.ts
    - agent/src/health.ts
    - agent/src/index.ts
    - agent/src/isEntry.ts
    - agent/scripts/reconcile.ts
    - agent/scripts/noiseBot.ts
    - agent/test/reconcile.test.ts
  modified:
    - agent/package.json
    - agent/.env.example

key-decisions:
  - "COOLDOWN_MS = 240_000 (4 min) — the midpoint of the D-06 3-5 min band"
  - "Pre-publish guardrails run INSIDE narrateAndStore (off the hot path): signalFidelity then bannedPhrases; any trip substitutes the deterministic fidelity-correct fallbackThesis and increments the fallbackRate counter (AI-SPEC §6)"
  - "thesisStore git push is DEBOUNCED (60s window) + gated on GITHUB_PAT presence — disabled-by-default offline; THESIS_GIT_REMOTE embeds the PAT for a dedicated repo, else the ambient remote is used"
  - "reconcile.ts detects settled swaps by walking the operator EOA's exactInputSingle txs to the SwapRouter over the block range (calldata decode + receipt status === success); matchKey joins them to non-invalidated signals; best-effort ordering check swapBlock >= recordBlock (D-34)"
  - "noiseBot amountOutMinimum = 0 (accept any output) — it is a utility swap, not a tracked trade; both directions of each pair are noise legs so prices move up AND down"

requirements-completed: [REQ-01, REQ-06]

# Metrics
duration: 16min
completed: 2026-06-11
---

# Phase 1 Plan 05: Agent runtime — poll loop, thesis store, /healthz, reconciler, noise bot Summary

**The pieces become a running agent: a 30s poll loop that awaits the on-chain recordSignal→swap hot path then fires Claude narration off-path (never awaited), a fail-closed boot guard, an off-chain thesis store, a /healthz endpoint, the ambient noise bot on a separate EOA, and the reconciler CLI whose `--assert` mode is the Phase 1 acceptance gate (orphan==0) — 81 tests green, `tsc --noEmit` clean, no live chain run (build-only by design).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-11T00:57:26Z
- **Completed:** 2026-06-11T01:13:12Z
- **Tasks:** 3 (all `type=auto`)
- **Files created:** 8 (+ 2 modified)

## Runtime entry points (npm scripts)

| Script | Command | What it does |
|--------|---------|--------------|
| `npm run agent` | `tsx src/index.ts` | The 30s poll loop — the always-on runtime. assertConfig() → ChainContext → ensureApprovals → /healthz → loop. |
| `npm run reconcile` | `tsx scripts/reconcile.ts` | Default: prints the `{matched,invalidated,orphan}` JSON report + a per-signal table. |
| `npm run noise` | `tsx scripts/noiseBot.ts` | The ambient noise bot (separate EOA) — random small swaps every 1-3 min. |

All three call `assertConfig()` FIRST (W3 fail-closed) before any chain call.

## THE PHASE 1 ACCEPTANCE GATE (D-40)

```bash
cd agent && npx tsx scripts/reconcile.ts --assert
# or: npm run reconcile -- --assert
```

Exit code **0** iff every NON-invalidated `SignalRecorded` maps to a settled operator swap (orphan == 0). Exit code **1** if any non-invalidated signal is an orphan. An invalidated-without-swap counts as `invalidated`, NOT orphan (D-30 — "we don't hide misses", but an honest invalidate does not fail the gate). This is run live in Plan 06 once `addresses.json` has the redeployed `sourceRegistry` + the minted `agentId`. Phase 4 reuses the same `classify()` behind the agent-card "Verify" badge.

## The /healthz contract (D-38)

`GET http://<host>:${HEALTH_PORT|8080}/healthz` → 200 JSON:

```json
{ "lastTickAt": "2026-06-11T...Z", "lastSignalAt": "2026-06-11T...Z" | null, "fallbackRate": 0.0, "paused": false }
```

- `lastTickAt` — ISO-8601 of the most recent poll tick (the liveness signal; UptimeRobot alerts if it goes stale > ~2 min, catching a hung loop / silent-VPS-dead before demo day).
- `lastSignalAt` — ISO-8601 of the most recent recorded signal (null until the first).
- `fallbackRate` — fraction of narrations that fell back to `fallbackThesis` (quality signal, AI-SPEC §7).
- `paused` — the agent's own pause flag (D-11). Any non-`/healthz` path returns 404.

## The poll-loop ordering invariant (the whole safety story — AI-SPEC §4 / Pitfall 5)

```typescript
// agent/src/index.ts handleSignal()
const signalId = await recordSignalThenSwap(ctx, {...});   // HOT PATH — AWAITED
if (signalId === null) return;                              // reverted → invalidateSignal already emitted (D-30)
void narrateAndStore(signal, signalId, health).catch(...); // OFF HOT PATH — NEVER awaited (+ belt-and-suspenders .catch)
```

A slow/rate-limited/failed Claude call can never delay or block the next 30s tick or the trade. `narrateAndStore` runs `narrateSignalSafe` (never throws) → pre-publish guardrails (signalFidelity + bannedPhrases, substitute `fallbackThesis` on any trip) → `writeThesis` → one structured stdout log line.

## Cooldown / cap / pause / pair-order enforcement

- **Per-pair cooldown (D-06):** `COOLDOWN_MS = 240_000` (4 min) since the last recorded signal on that pair; a signal within cooldown is skipped.
- **Daily soft cap (D-10):** `DAILY_SOFT_CAP = 20` across all 3 pairs; the window rolls every 24h.
- **Pause flag (D-11):** `health.paused` — the loop bumps `lastTickAt` for liveness then skips all trading.
- **Pair order (D-16):** signals are evaluated + emitted in the fixed `PAIRS` order `[WMNT/USDC, mETH/USDC, WETH/USDC]`.

## Task Commits

1. **Task 1: config fail-closed guard + thesisStore + /healthz + poll loop** — `a50caf0` (feat)
2. **Task 2: reconciler CLI (--assert D-40 gate) + pure-classifier unit test** — `bb864cd` (feat)
3. **Task 3: ambient noise bot (separate EOA, real swaps, no signals)** — `ba28de7` (feat)

**Plan metadata:** see final docs commit.

## Verification

- `cd agent && npx tsc --noEmit` → exit 0 (clean across src/scripts/test/eval).
- `cd agent && npx vitest run` → **81 tests passed** (5 files): strategy.replay 11 + narration 13 + reconcileShared 6 + eval/validators 42 + **reconcile 9 (new)**.
- Task 1 greps: `void narrateAndStore` present (line 159, NOT preceded by `await`); `await recordSignalThenSwap` present; `/healthz` + `lastTickAt`/`lastSignalAt` in health.ts; `theses/<agentId>/<signalId>.json` path in thesisStore.ts; `COOLDOWN_MS`/`DAILY_SOFT_CAP`/`PAIR_ORDER` in config.ts; `throw`/`assertConfig` fail-closed in config.ts.
- Task 2 greps: `reconcile-shared` imported; `orphan` in both the report and the `--assert` branch; `process.exit(1)` under `report.orphan > 0`.
- Task 3 greps: `NOISE_BOT_PRIVATE_KEY` present; **`grep -c "recordSignal" noiseBot.ts` == 0**; `exactInputSingle` present; `Math.random` present.

## Build-only — no live chain run (by design)

Per the plan's `<build_only_no_live_run>`: the code type-checks and the reconcile classifier unit test passes, but the agent / reconciler / noise bot were NOT run against the chain. `assertConfig()` correctly THROWS at boot today because `addresses.json` has no `sourceRegistry`/`agentId` yet (filled in Plan 06's live mint + redeploy) — that is correct fail-closed runtime behavior, not a build failure. `NOISE_BOT_PRIVATE_KEY` is not in `.env` yet (added in Plan 06 hosting); the noise bot reads it at runtime, so the build does not need it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Loose ESM entry-detection wrongly executed reconcile.ts main() during the unit test**
- **Found during:** Task 2 (first run of reconcile.test.ts)
- **Issue:** The initial entry guard used `import.meta.url.includes('reconcile')`, which is TRUE whenever a test imports `scripts/reconcile.ts` — so importing the classifier in `reconcile.test.ts` ran `main()`, which (with no live config) called `process.exit(1)`. All 9 assertions passed but vitest reported 1 process-level error.
- **Fix:** Created `agent/src/isEntry.ts` — the correct ESM check `resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])` — and applied it to both `reconcile.ts` and `index.ts` (replacing the same loose substring heuristic I had written in index.ts).
- **Files modified:** agent/scripts/reconcile.ts, agent/src/index.ts, agent/src/isEntry.ts (new)
- **Verification:** `vitest run test/reconcile.test.ts` → 9/9 green with NO process error; full suite 81/81.
- **Committed in:** `bb864cd` (Task 2 commit)

**2. [Rule 1 - Bug] Stale `cfg.operatorKeyToAddress()` reference in reconcile.ts**
- **Found during:** Task 2 (typecheck)
- **Issue:** A first draft of reconcile.ts derived the operator address via a `declare module` augmentation that added a `operatorKeyToAddress()` method to `AgentConfig` — but that method was never implemented, so it would throw at runtime (and the augmentation was dead weight).
- **Fix:** Derived the operator address cleanly from the existing `operatorAccount(cfg.operatorKey).address` helper (clients.ts, Plan 04); removed the `declare module` block and an unused `require('viem')` hack (replaced with a top-level `decodeFunctionData` import).
- **Files modified:** agent/scripts/reconcile.ts
- **Verification:** `tsc --noEmit` exit 0.
- **Committed in:** `bb864cd` (Task 2 commit)

**3. [Rule 2 - Missing config documentation] .env.example did not document the new runtime secrets**
- **Found during:** Task 3
- **Issue:** The runtime introduces three new env reads (`GITHUB_PAT` for the thesis push D-37, `NOISE_BOT_PRIVATE_KEY` D-24, optional `HEALTH_PORT`/`RECONCILE_FROM_BLOCK`) that the host must set in Plan 06, but `.env.example` only listed `ANTHROPIC_API_KEY` + `OPERATOR_PRIVATE_KEY`. A host filling `.env` from the example would silently miss them.
- **Fix:** Documented all new secrets + the optional toggles (`THESIS_GIT_REMOTE`, `THESIS_GIT_PUSH`) in `.env.example` with their decision references.
- **Files modified:** agent/.env.example
- **Verification:** `.env.example` lists every env var the runtime reads; `.env` stays gitignored.
- **Committed in:** `ba28de7` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (2 Rule 1 bugs both in this plan's own Task 2 code; 1 Rule 2 config-doc completeness). No scope creep — every file is in the plan's `files_modified` set except the small `src/isEntry.ts` helper (an internal entry-guard extracted to fix deviation #1, shared by index/reconcile/noiseBot).

## Threat-model mitigations applied

- **T-1-11 (un-awaited narration crashes the VPS):** `void narrateAndStore(...).catch(...)` — the belt-and-suspenders `.catch` plus `narrateSignalSafe` never throwing; `/healthz lastTickAt` detects a hung loop. The poll loop also wraps each tick in try/catch so one bad tick never kills the process.
- **T-1-14 (GITHUB_PAT leak):** the PAT is read from env, never logged; thesis push stages ONLY `theses/` (never `git add .`); pushing is gated on PAT presence.
- **T-1-15 (signal flood drains pools):** per-pair cooldown (D-06) + daily soft cap (D-10) + pause flag (D-11) all enforced in the loop before a signal is recorded.
- **T-1-07 (bad thesis on the card):** signalFidelity + bannedPhrases run pre-publish inside narrateAndStore; any trip substitutes the deterministic fidelity-correct `fallbackThesis`.

## Known Stubs

None. Every module is a complete implementation: the poll loop reads the live portfolio + spot quotes and routes real signals; the reconciler walks real logs/txs (the classifier is pure + fully tested); the noise bot does real swaps + mints. The agent does not boot today ONLY because `assertConfig()` fail-closes on the unset `sourceRegistry`/`agentId` — that is correct runtime behavior (filled by Plan 06's live mint/redeploy), not a stub returning empty data. No UI-facing empty/mock data path exists in this plan.

## Threat Flags

None. The new surfaces are all within the plan's `<threat_model>`: the /healthz HTTP endpoint (read-only liveness JSON, no auth surface beyond a public health probe — intended for UptimeRobot), the thesis git push (T-1-14, mitigated), and the noise-bot EOA→pools path (T-1-15/D-24, separate key). No new auth path, no new trust-boundary schema change beyond the registered dispositions.

## Next Phase Readiness

- **Plan 06 (live redeploy + mint):** redeploys the extended SourceRegistry → writes `addresses.json.sourceRegistry`; publishes AGENT_URI + runs `registerIdentity.ts` → writes `addresses.json.agentId`; sets `OPERATOR_PRIVATE_KEY`/`NOISE_BOT_PRIVATE_KEY`/`GITHUB_PAT`/`ANTHROPIC_API_KEY` in `agent/.env`. At that point `assertConfig()` stops throwing and `npm run agent` / `npm run noise` / `npm run reconcile --assert` all go live. The `--assert` gate is the Phase 1 success criterion.
- **No blockers.** The offline gates (`tsc --noEmit` clean, `vitest run` 81/81) are green with no live chain and no API key.

## Self-Check: PASSED

All 8 created files verified present on disk (src/config.ts, src/store/thesisStore.ts, src/health.ts, src/index.ts, src/isEntry.ts, scripts/reconcile.ts, scripts/noiseBot.ts, test/reconcile.test.ts) plus the 2 modified (package.json, .env.example). All 3 task commits verified in git log (a50caf0, bb864cd, ba28de7). Final gates re-run green: `tsc --noEmit` exit 0; `vitest run` 81/81; all Task 1/2/3 acceptance greps confirmed (incl. `grep -c "recordSignal" noiseBot.ts` == 0 and `void narrateAndStore` not preceded by `await`).

---
*Phase: 01-source-signals*
*Completed: 2026-06-11*
