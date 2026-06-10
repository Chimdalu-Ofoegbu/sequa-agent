---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-06-10T20:41:11.284Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 11
  completed_plans: 7
  percent: 64
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
Plan: 03 complete (Wave 1) — greenfield agent/ workspace: pure MA-crossover core + Claude narration + eval harness

- **Phase 1 — Source + signals — In progress** (Plans 01-02 + 01-03 complete): 01-02 extended SourceRegistry; 01-03 built the `agent/` TypeScript cores (pure deterministic strategy + off-hot-path narration + offline eval gate), file-disjoint from 01-01/01-02 in Wave 1. Plan 05 wires the cores into the poll loop.
- **Phase**: 0 — Lock — Complete
- **Plans**: 5 plans across 4 waves (00-01 → 00-02/03 → 00-04 → 00-05) — all complete
- **Status**: Complete (5/5 plans; 3 of 3 official Technical Deployment criteria cleared; submission packet `.planning/phases/00-lock/DEPLOYMENT.md` ready for Phase 5 paste-into-DoraHacks)
- **Progress**: `[█░░░░░░░░░░░░░░░░░░░] 1/6 phases complete`
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
| 1 | Source + signals | Ready to plan | Yes |
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

- **Last session**: Executed Plan 01-03 (2026-06-10) — stood up the greenfield `agent/` TypeScript workspace: pure replay-deterministic MA-crossover core (`decideSignals`, D-02/D-03/D-05/D-13..D-16), off-hot-path Claude narration (`narrateSignalSafe` never throws/blocks — validate→retry→fallback; locked `claude-haiku-4-5`/120/0.7, client timeout 8000/maxRetries 2), and an eval harness (12 labeled fixtures + signalFidelity + bannedPhrases + thesisSchema + promptfooconfig; `eval:unit` is the always-on offline gate). 66 tests green, no live API call. TDD commits — Task 1: `369adee` (test RED) → `124220c` (feat GREEN); Task 2: `1be7ad9` (test RED) → `27f033d` (feat GREEN); Task 3: `6f9fba4` (feat). 4 auto-fixed deviations (test fixtures + mock hoist + fidelity idiom + promptfoo config), all documented in `01-03-SUMMARY.md`.
- **Stopped at**: Plan 01-03 complete + committed; `01-03-SUMMARY.md` written + self-check PASSED. The strategy + narration + guardrail interfaces are exported for Plan 05 to wire into the poll loop (`recordSignal → swap` + fire-and-store narration + `/healthz`).
- **Key Phase 1 decisions locked** (see `01-CONTEXT.md` for all 42):
  - Deterministic momentum/breakout rule (short 5 / long 20 MA @ 30s poll, 3–5 min cooldown) + Claude per-signal thesis; single confident-momentum-trader persona.
  - All 3 locked pairs; fixed-fraction USDC sizing; ~20 signals/day soft cap.
  - 4 mock ERC20s (6/18 decimals) + 3 full-range FusionX V3 Sepolia pools @ 0.30%, ~5k each, mainnet-like prices; ambient-noise bot keeps MAs crossing.
  - **SourceRegistry REDEPLOY** in Phase 1: add `invalidateSignal`, `signalAt`, typed decoded event; re-verify; update `DEPLOYMENT.md` (Phase 5 cites Phase 1 address).
  - **ERC-8004 identity mint pulled up to Phase 1** (Phase 3 keeps only reputation accrual). Single operator EOA; `recordSignal`-then-swap real execution.
  - Reconciler CLI = Phase 1 acceptance gate (100% non-invalidated signals matched). Always-on VPS, booted at smoke-pass for a multi-day track record. Sepolia-only.
- **Next action**: `/gsd-plan-phase 1` — Source + signals. Then `/clear` first. 5 days of buffer remaining to 2026-06-15.
