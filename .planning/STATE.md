---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-06-11T01:14:00.000Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 11
  completed_plans: 9
  percent: 82
---

# STATE: Sequa

## Project Reference

- **Project**: Sequa — Follow a proven AI trading agent in one tap. Mirror its moves to your wallet; you keep custody; the agent's track record is on-chain.
- **Core value**: Verifiable on-chain copy-trading. Every source signal and every settled result is recorded on Mantle. The screenshot is replaced with proof.
- **Hackathon**: Mantle Turing Test Hackathon 2026 (Phase 2 — AI Awakening).
- **Primary track**: Consumer & Viral DApps.
- **Prize stack targeted**: Consumer & Viral ($8.5K) + Best UI/UX ($3K) + Community Voting (2 × $8.5K) + 20 Project Deployment Award ($1K).
- **Deadline**: 2026-06-15.
- **Today**: 2026-06-07 (8-day runway).
- **Current focus**: Phase 1 context gathered (2026-06-10) — `01-CONTEXT.md` captures 42 decisions across 12 gray areas. Ready to run `/gsd-plan-phase 1`.

## Current Position

Phase: 1
Plan: 06 IN PROGRESS (Wave 4) — extended SourceRegistry REDEPLOYED + source-verified at `0x9D23f4b25442D6FBA4529a3FD1F1b3B5B9e3F090` (deploy tx `0x89425595...`; written to addresses.json `sourceRegistry` + sepolia.json + DEPLOYMENT.md as the single source of truth). PAUSED for live-launch prerequisites — operator EOA funding (0 MNT), noise-bot key+funding, GitHub repo+PAT for AGENT_URI + thesis pushes, optional ANTHROPIC_API_KEY, VPS, UptimeRobot. Plans 01-01..01-05 complete. Resume with `/gsd-execute-phase 1` once prerequisites gathered.

- **Phase 1 — Source + signals — In progress** (Plans 01-01 .. 01-05 complete; only 01-06 go-live remains): 01-01 live venue + mocks + pools; 01-02 extended SourceRegistry; 01-03 built the `agent/` TypeScript cores (pure strategy + narration + eval); 01-04 built the chain bridge (`agent/src/chain/*` + `agent/scripts/registerIdentity.ts`) — the 5-field codec (D-40), QuoterV2 simulate read, the 2-tx hot path, the ERC-8004 mint one-shot (live mint DEFERRED to Plan 06); 01-05 assembled the runtime — `agent/src/index.ts` 30s poll loop (await recordSignalThenSwap then void narrateAndStore, NEVER awaited), `config.ts` fail-closed `assertConfig()` (W3), `store/thesisStore.ts` (D-09/D-37), `health.ts` /healthz (D-38), `scripts/reconcile.ts` (--assert D-40 acceptance gate, pure classifier), `scripts/noiseBot.ts` (separate EOA, D-24). Build-only: tsc clean + 81 tests green, no live chain run. Plan 06 has REDEPLOYED + verified the extended SourceRegistry (`0x9D23f4b25442D6FBA4529a3FD1F1b3B5B9e3F090`) and written it to addresses.json; the remaining 01-06 steps — publish AGENT_URI, live ERC-8004 mint + registerSource (so `assertConfig()` stops throwing), first live recordSignal→swap, `reconcile.ts --assert` orphan==0 acceptance gate (D-40), and always-on VPS hosting + UptimeRobot — are PAUSED pending live-launch prerequisites.
- **Phase**: 0 — Lock — Complete
- **Plans**: 5 plans across 4 waves (00-01 → 00-02/03 → 00-04 → 00-05) — all complete
- **Status**: Complete (5/5 plans; 3 of 3 official Technical Deployment criteria cleared; submission packet `.planning/phases/00-lock/DEPLOYMENT.md` ready for Phase 5 paste-into-DoraHacks)
- **Progress**: `[████████████████░░░░] 9/11 plans complete (1/6 phases)`
- **Last activity**: Plan 00-05 completed (2026-06-08) — end-to-end `registerSource → recordSignal → mirror` tx sequence submitted live on Mantle Sepolia from independent deployer + follower EOAs; DEPLOYMENT.md packet committed.
  - SourceRegistry: `0x97a724ca8d70aee206b8d56925a735511d3cd5c8` — [verified](https://sepolia.mantlescan.xyz/address/0x97a724ca8d70aee206b8d56925a735511d3cd5c8#code)
  - FollowRegistry: `0x8d5593076161321af5433742f7514172f2786aec` — [verified](https://sepolia.mantlescan.xyz/address/0x8d5593076161321af5433742f7514172f2786aec#code)
  - registerSource tx: [`0x0ebb8ba0...`](https://sepolia.mantlescan.xyz/tx/0x0ebb8ba06db5a30521c06adc08ba7a9cad0777fbf892ee3d32a5063c63c468c0)
  - recordSignal tx (AI-callable on-chain function): [`0x58eda28a...`](https://sepolia.mantlescan.xyz/tx/0x58eda28ab912bbeb29d3329e546f00914919f62f4d1f9b2f56bbc9fb7eba4e1e)
  - mirror tx (from follower `0xeC31...B615`): [`0x23bed06b...`](https://sepolia.mantlescan.xyz/tx/0x23bed06b125f90a62ed6f2072952eda239f219612627bb43a07679d927c331d2)

## Phase Status Overview

| Phase | Name | Status | Non-negotiable |
|---|---|---|---|
| 0 | Lock | Complete (2026-06-08) — 5/5 plans, 4/4 waves | Yes |
| 1 | Source + signals | In progress (5/6 plans: 01-05 runtime complete; 06 redeploy/mint go-live remains) | Yes |
| 2 | Mirror execution | Not planned | Yes |
| 3 | ERC-8004 + reputation | Not planned | No (first to cut) |
| 4 | Frontend wire-up + share card | Not planned | Yes |
| 5 | Ship | Not planned | Yes |

## Performance Metrics

- **Requirements covered**: 14/14 mapped to phases (REQ-01 completed in Plan 01-02).
- **ADR decisions locked**: 6/6 (DEC-001 venue, DEC-002 pair set, DEC-003 executor pattern, DEC-004 ERC-8004 deployments, DEC-005 ERC-8004 surface, DEC-006 prize + panel + dates).
- **SPEC constraints active**: 13.
- **Conflicts**: 0 blockers, 0 warnings, 5 INFO auto-resolved.

### Plan execution metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|---|---|---|---|---|---|
| 1 | 02 | ~22 min | 2 | 3 | 2026-06-10 |
| 1 | 03 | 33 min | 3 | 29 | 2026-06-10 |
| 1 | 04 | ~75 min | 3 | 10 | 2026-06-11 |
| 1 | 05 | ~16 min | 3 | 10 | 2026-06-11 |

## Accumulated Context

### Decisions (locked, do not re-litigate)

- DEC-001 — FusionX V3 is the sole DEX venue.
- DEC-002 — Three USDC-quoted pairs only: WMNT/USDC, mETH/USDC, WETH/USDC.
- DEC-003 — Non-custodial executor pattern is scoped ERC-20 allowance + `SequaExecutor.sol` behind an `ITradeExecutor` interface. ERC-4337 session keys, personal vault, and Safe module are rejected for this timeline.
- DEC-004 — Use canonical Mantle ERC-8004 deployments. Skip ValidationRegistry. Self-feedback is impossible by construction. `clientAddresses[]` allowlist strategy must be resolved in Phase 3 planning.
- DEC-005 — Minimum ERC-8004 interface surface only: IdentityRegistry `register`/`getAgentWallet`/`ownerOf` + ReputationRegistry `giveFeedback`/`getSummary`.
- DEC-006 — Prize stack targeted: Consumer & Viral + Best UI/UX + Community Voting + 20 Project Deployment Award. Judging panel and key dates locked.

### Phase 1 execution decisions (Plan 01-03)

- `agent/` strategy core (`src/strategy/maCrossover.ts`) is PURE — only the types import, no network/fs/clock; identical inputs → identical `Signal[]` (mirror-fidelity premise, D-01). Exports `decideSignals` + `decideSignalsDetailed` + `DEFAULT_STRATEGY_CONFIG`.
- BUY sizing = 0.30 of available USDC (D-07 band); SELL flat-sells the holding. `minUsdc` floor = 100 for the D-13 skip. Crossover detected on the final tick vs the prior tick.
- `narrateSignalSafe` (the ONLY runtime entry) never throws/blocks — validate → one retry → deterministic fidelity-correct `fallbackThesis`. Locked params: `claude-haiku-4-5`, max_tokens 120, temperature 0.7; client timeout 8000, maxRetries 2.
- `eval:unit` (vitest over labeled fixtures + signalFidelity/bannedPhrases/thesisSchema) is the always-on offline CI gate — no `ANTHROPIC_API_KEY`. `eval:prompt`/`eval:ci` add the live promptfoo regression.
- REQ-06 remains Pending: Plan 01-03 built the off-chain cores; REQ-06's on-chain acceptance (real recorded signals, reconciler 100%) completes in Plan 05/06.

### Phase 1 execution decisions (Plan 01-04)

- The chain layer (`agent/src/chain/*`) reads EVERY venue/registry address + the agentId from `addresses.json` AT RUNTIME (W2). `requireSourceRegistry`/`requireAgentId` THROW rather than fall back to a stale dev address — Plan 06 fills `sourceRegistry`; `registerIdentity.ts` fills `agentId` at mint. `recordSignal.ts` has zero `0x` address literal.
- The D-07 5-field signal codec (`encodeSignal`/`decodeSignal`/`matchKey`) lives ONCE in `reconcile-shared.ts` (D-40), imported by both the runtime hot path and (Plan 05) the reconciler. A `cast abi-encode` fixture asserts byte-equality with the on-chain `abi.encode` — the 5-field tuple is kept distinct from the 8-field UniV3 router struct (derived at swap time).
- QuoterV2 is read EXCLUSIVELY via viem `simulateContract` (non-view, Pitfall 2) — no view/static read of the quoter in `quote.ts`.
- Hot path `recordSignalThenSwap`: 2-tx (recordSignal → exactInputSingle) from the operator EOA; `amountOutMinimum = minAmountOut` (slippage bound, T-1-12); on swap revert → `invalidateSignal` then return null (D-30). `ensureApprovals` = one-time idempotent `approve(SwapRouter, type(uint256).max)` per token (D-29).
- ERC-8004 mint: `registerIdentity.ts` captures the agentId from the `Transfer(0x0→owner)` mint log (NOT 1 — Pitfall 6), asserts `ownerOf==operator`, calls `registerSource`, persists agentId. BUILT + type-checked; the LIVE MINT is DEFERRED to Plan 06 (needs published AGENT_URI + redeployed SourceRegistry) — NOT run in this plan, no on-chain write.
- Pinned `viem@2.52.2` + `dotenv` as direct agent deps; extended tsconfig `include` with `scripts/**`.

### Phase 1 execution decisions (Plan 01-05)

- The runtime poll loop (`agent/src/index.ts`) enforces THE ordering invariant (AI-SPEC §4 / Pitfall 5): `const signalId = await recordSignalThenSwap(...)` (HOT PATH, awaited) → `if null return` → `void narrateAndStore(...).catch(...)` (NEVER awaited, belt-and-suspenders .catch). A slow/failed Claude can never delay the next 30s tick or the trade. Narration runs `narrateSignalSafe` → pre-publish guardrails (signalFidelity + bannedPhrases, substitute `fallbackThesis` on a trip) → `writeThesis` → one structured log line.
- `config.ts` `assertConfig()` is the W3 FAIL-CLOSED boot guard: throws on unset/zero agentId (positive int, Pitfall 6/T-1-13), sourceRegistry/swapRouter/quoterV2, the 4 token addresses, and OPERATOR_PRIVATE_KEY — invoked at the top of index/reconcile/noiseBot. Strategy constants live here as the single source of truth: pollMs 30_000, cooldownMs 240_000 (D-06 4-min midpoint), dailySoftCap 20 (D-10), buyFraction 0.30 (D-07), pairOrder [WMNT,mETH,WETH] (D-16), pause flag (D-11).
- `scripts/reconcile.ts` is BOTH the deliverable and the Phase 1 acceptance gate (D-40): walks SignalRecorded + SignalInvalidated, matches each non-invalidated signal to the operator's settled exactInputSingle swaps via the SHARED `matchKey` codec (imported from reconcile-shared.ts, not reimplemented); `--assert` exits non-zero on any orphan (orphan==0 to pass). An invalidated-without-swap counts `invalidated`, not orphan (D-30). The classifier `classify()` is PURE — unit-tested with fixture arrays (reconcile.test.ts, 9 tests).
- `store/thesisStore.ts` writes `theses/<agentId>/<signalId>.json` then DEBOUNCED git commit+push via GITHUB_PAT (D-37, commit-flood mitigation); `health.ts` /healthz → {lastTickAt,lastSignalAt,fallbackRate,paused} (D-38); `scripts/noiseBot.ts` uses a SEPARATE NOISE_BOT EOA (D-24), does real swaps, never records signals (grep -c recordSignal == 0), Math.random pair/amount/timing, mints via the public MockERC20 mint at startup.
- `src/isEntry.ts` is the correct ESM entry guard (resolve(argv[1]) compare) so importing a runnable script in a test never executes its main() — fixed a Rule-1 bug where a loose substring check ran reconcile.ts's main() during the unit test.
- Build-only by design: `tsc --noEmit` clean + 81 tests green; the agent/reconciler/noise bot were NOT run live (assertConfig() correctly fail-closes on the unset sourceRegistry/agentId until Plan 06's mint/redeploy). npm scripts added: `agent` (tsx src/index.ts), `reconcile` (tsx scripts/reconcile.ts), `noise` (tsx scripts/noiseBot.ts).

### Pre-existing assets (factor into planning)

- Full UI already built in Claude Design — Phase 4 is wire-up + Open Graph export, NOT greenfield.
- Phase 0 strategic groundwork already complete (venue, pair set, executor pattern, ERC-8004 status). Only the skeleton-contract deploy + verify remains for Day 1.

### Active todos

- Phase 1 planning: `/gsd-plan-phase 1` — Source + signals (one verifiable Claude-driven source agent on the locked FusionX V3 pair set, recording every decision on-chain).
- Carry the `.planning/phases/00-lock/DEPLOYMENT.md` paragraph forward to the DoraHacks submission packet (Phase 5).
- Re-confirm the deployment-award fine print on the DoraHacks portal at submission time (DEC-006); current Phase 0 packet matches the 7-item fine print verbatim as of 2026-06-08.

### Blockers

None.

### Risks (carry through every phase)

- **Mirror fidelity** — if follower trades drift from the source, the whole premise breaks. Mitigation: constrained deterministic source strategies + fixed pair set (DEC-002).
- **Regulatory optics** — copy-trading reads as money-management to compliance-aware judges (Hashed, Caladan). Mitigation: lead with non-custodial-by-design + scoped/revocable authorization + framing as "follow a verifiable strategy," not "we manage your money."
- **Sui Overflow attention split** — deadline 2026-06-16, one day after Sequa. Protect non-negotiable phases (0, 1, 2, 4, 5); Phase 3 is the designated absorber if attention drifts.
- **Shallow-to-institutional-panel perception** — mitigation: lead every conversation with on-chain verifiability and portable reputation; visuals win the side prizes, verifiability wins the track.

### Scope cut lines (apply in order if forced)

1. Drop multiple source agents → ship one strong verifiable source.
2. Drop the live reputation accrual loop → present reputation as designed view backed by on-chain performance.
3. Drop personal-vault execution → already the default per DEC-003.
4. Drop risk-cap configuration → mirror at fixed scale.
5. Reduce pair set to a single pair → overrides part of DEC-002, document explicitly.

### Ship-core minimum

One verifiable source agent + on-chain signals + non-custodial mirror into a follower wallet + leaderboard + agent card + one-tap follow + shareable card.

## Session Continuity

- **Last session**: Executed Plan 01-05 (2026-06-11) — assembled the full agent runtime in `agent/src/` + `agent/scripts/`: `config.ts` (W3 fail-closed `assertConfig()` + locked strategy constants), `store/thesisStore.ts` (theses/<agentId>/<signalId>.json + debounced PAT push, D-09/D-37), `health.ts` (/healthz → {lastTickAt,lastSignalAt,fallbackRate,paused}, D-38), `index.ts` (the 30s poll loop — await recordSignalThenSwap HOT PATH then void narrateAndStore NEVER awaited, cooldown/cap/pause/pair-order enforced, pre-publish guardrails, structured logs), `isEntry.ts` (correct ESM entry guard), `scripts/reconcile.ts` (pure classifier + --assert D-40 acceptance gate, imports the shared codec), `scripts/noiseBot.ts` (separate NOISE_BOT EOA, real swaps, never records signals, Math.random). Commits — Task 1: `a50caf0` (feat); Task 2: `bb864cd` (feat); Task 3: `ba28de7` (feat). 3 auto-fixed deviations (2 Rule-1 bugs in this plan's own Task 2 code: loose entry guard ran main() in the test, stale operatorKeyToAddress ref; 1 Rule-2: documented new .env secrets). `tsc --noEmit` clean; reconcile.test 9/9; full suite 81/81. Build-only — no live chain run (assertConfig fail-closes until Plan 06). Documented in `01-05-SUMMARY.md`.
- **Stopped at**: Plan 01-05 complete + committed; `01-05-SUMMARY.md` written + self-check PASSED. The runtime is built and type-checks; the Phase 1 acceptance-gate command is `cd agent && npx tsx scripts/reconcile.ts --assert` (run live in Plan 06). Plan 06 redeploys SourceRegistry (writes `addresses.json.sourceRegistry`) + runs `registerIdentity.ts` (the live mint → writes `addresses.json.agentId`) + sets the agent/.env secrets, at which point `assertConfig()` stops throwing and `npm run agent` / `npm run noise` / `npm run reconcile -- --assert` go live.
- **Key Phase 1 decisions locked** (see `01-CONTEXT.md` for all 42):
  - Deterministic momentum/breakout rule (short 5 / long 20 MA @ 30s poll, 3–5 min cooldown) + Claude per-signal thesis; single confident-momentum-trader persona.
  - All 3 locked pairs; fixed-fraction USDC sizing; ~20 signals/day soft cap.
  - 4 mock ERC20s (6/18 decimals) + 3 full-range FusionX V3 Sepolia pools @ 0.30%, ~5k each, mainnet-like prices; ambient-noise bot keeps MAs crossing.
  - **SourceRegistry REDEPLOY** in Phase 1: add `invalidateSignal`, `signalAt`, typed decoded event; re-verify; update `DEPLOYMENT.md` (Phase 5 cites Phase 1 address).
  - **ERC-8004 identity mint pulled up to Phase 1** (Phase 3 keeps only reputation accrual). Single operator EOA; `recordSignal`-then-swap real execution.
  - Reconciler CLI = Phase 1 acceptance gate (100% non-invalidated signals matched). Always-on VPS, booted at smoke-pass for a multi-day track record. Sepolia-only.
- **Next action**: Execute Plan 01-06 (go live — redeploy + verify the extended SourceRegistry → write `addresses.json.sourceRegistry`; publish AGENT_URI + run `registerIdentity.ts` (live ERC-8004 mint) → write `addresses.json.agentId`; set OPERATOR_PRIVATE_KEY/NOISE_BOT_PRIVATE_KEY/GITHUB_PAT/ANTHROPIC_API_KEY in agent/.env; first live signal; host always-on; run the `reconcile.ts --assert` acceptance gate; write RUN.md). At that point assertConfig() stops throwing and the Plan 05 runtime goes live. 4 days of buffer remaining to 2026-06-15.
