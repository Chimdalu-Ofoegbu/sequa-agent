---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-06-08T04:10:58.907Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
  percent: 80
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
- **Current focus**: Phase 0 — ready to plan.

## Current Position

Phase: 00 (lock) — EXECUTING
Plan: 4 of 5 (complete — wave 3 closed; next: wave 4 = 00-05 e2e test + deployment packet)

- **Phase**: 0 — Lock
- **Plans**: 5 plans across 4 waves (00-01 → 00-02/03 → 00-04 → 00-05)
- **Status**: In Progress (4/5 plans complete; REQ-12 "deployed AND verified on Mantle Explorer" technical bar cleared)
- **Progress**: `[████████░░] 80%`
- **Last activity**: Plan 00-04 completed (2026-06-08) — SourceRegistry + FollowRegistry deployed and verified on Mantle Sepolia.
  - SourceRegistry: `0x97a724ca8d70aee206b8d56925a735511d3cd5c8` — [verified](https://sepolia.mantlescan.xyz/address/0x97a724ca8d70aee206b8d56925a735511d3cd5c8#code)
  - FollowRegistry: `0x8d5593076161321af5433742f7514172f2786aec` — [verified](https://sepolia.mantlescan.xyz/address/0x8d5593076161321af5433742f7514172f2786aec#code)

## Phase Status Overview

| Phase | Name | Status | Non-negotiable |
|---|---|---|---|
| 0 | Lock | Ready to execute (5 plans, 4 waves) | Yes |
| 1 | Source + signals | Not planned | Yes |
| 2 | Mirror execution | Not planned | Yes |
| 3 | ERC-8004 + reputation | Not planned | No (first to cut) |
| 4 | Frontend wire-up + share card | Not planned | Yes |
| 5 | Ship | Not planned | Yes |

## Performance Metrics

- **Requirements covered**: 14/14 mapped to phases.
- **ADR decisions locked**: 6/6 (DEC-001 venue, DEC-002 pair set, DEC-003 executor pattern, DEC-004 ERC-8004 deployments, DEC-005 ERC-8004 surface, DEC-006 prize + panel + dates).
- **SPEC constraints active**: 13.
- **Conflicts**: 0 blockers, 0 warnings, 5 INFO auto-resolved.

## Accumulated Context

### Decisions (locked, do not re-litigate)

- DEC-001 — FusionX V3 is the sole DEX venue.
- DEC-002 — Three USDC-quoted pairs only: WMNT/USDC, mETH/USDC, WETH/USDC.
- DEC-003 — Non-custodial executor pattern is scoped ERC-20 allowance + `SequaExecutor.sol` behind an `ITradeExecutor` interface. ERC-4337 session keys, personal vault, and Safe module are rejected for this timeline.
- DEC-004 — Use canonical Mantle ERC-8004 deployments. Skip ValidationRegistry. Self-feedback is impossible by construction. `clientAddresses[]` allowlist strategy must be resolved in Phase 3 planning.
- DEC-005 — Minimum ERC-8004 interface surface only: IdentityRegistry `register`/`getAgentWallet`/`ownerOf` + ReputationRegistry `giveFeedback`/`getSummary`.
- DEC-006 — Prize stack targeted: Consumer & Viral + Best UI/UX + Community Voting + 20 Project Deployment Award. Judging panel and key dates locked.

### Pre-existing assets (factor into planning)

- Full UI already built in Claude Design — Phase 4 is wire-up + Open Graph export, NOT greenfield.
- Phase 0 strategic groundwork already complete (venue, pair set, executor pattern, ERC-8004 status). Only the skeleton-contract deploy + verify remains for Day 1.

### Active todos

- Phase 0 execution: `/gsd-execute-phase 0` — 5 plans, 4 waves, ends with DEPLOYMENT.md packet committed.
- Capture Sepolia deployment addresses + tx hashes from Phase 0 deploy into a deployment manifest for the DoraHacks submission packet (will be `.planning/phases/00-lock/DEPLOYMENT.md`).
- Confirm the deployment-award fine print directly on the DoraHacks portal before submitting (DEC-006).

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

- **Last session**: Initial planning skeleton generation (2026-06-07).
- **Generated artifacts**:
  - `.planning/PROJECT.md` (with 6 locked ADR decisions)
  - `.planning/REQUIREMENTS.md` (14 v1 requirements + traceability)
  - `.planning/ROADMAP.md` (6 phases, scope cuts pre-encoded)
  - `.planning/STATE.md` (this file)
- **Inputs preserved**:
  - `.planning/intel/SYNTHESIS.md`
  - `.planning/intel/decisions.md`
  - `.planning/intel/requirements.md`
  - `.planning/intel/constraints.md`
  - `.planning/intel/context.md`
  - `.planning/INGEST-CONFLICTS.md`
- **Next action**: `/gsd-execute-phase 0` — execute the 5 Phase 0 plans (Wave 1: scaffold + interfaces + constants; Wave 2: SourceRegistry + FollowRegistry contracts in parallel; Wave 3: deploy + verify on Mantle Sepolia; Wave 4: end-to-end `recordSignal → mirror` test tx + DEPLOYMENT.md packet). Target completion: end of Day 1 (2026-06-08) to clear the 20 Project Deployment Award technical bar with maximum buffer.
