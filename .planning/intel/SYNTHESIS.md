# Synthesis Summary

Entry point for `gsd-roadmapper`. Synthesizes 3 classified planning docs for the Sequa project (Mantle Turing Test Hackathon 2026).

## Inputs

- **Mode:** new (no pre-existing `.planning/` context)
- **Docs synthesized:** 3
  - ADR (LOCKED, precedence 0): `PHASE-0-RESEARCH.md`
  - SPEC (precedence 1): `Sequa UI-UX Prompt.md`
  - PRD (precedence 2): `Sequa Project.md`
- **Precedence applied:** `["ADR", "SPEC", "PRD", "DOC"]` (default)
- **Cycle detection:** 1 cycle found (PRD ↔ SPEC mutual companion refs). Benign — distinct content domains, no synthesis loop. Logged as INFO.

## Outputs

| File | Purpose |
|---|---|
| `.planning/intel/decisions.md` | 6 LOCKED decisions from PHASE-0-RESEARCH (DEC-001..DEC-006) |
| `.planning/intel/requirements.md` | 14 requirements derived from PRD (REQ-source-registry..REQ-phase-plan) |
| `.planning/intel/constraints.md` | 13 SPEC constraints (CON-aesthetic..CON-fusionx-router) |
| `.planning/intel/context.md` | Running notes by topic (positioning, runway, risks, scoring, definition of done, etc.) |
| `.planning/INGEST-CONFLICTS.md` | Conflict report — 0 blockers, 0 warnings, 5 INFO |

## Counts

- **Decisions locked:** 6
  - DEC-001 FusionX V3 venue · `PHASE-0-RESEARCH.md` §1
  - DEC-002 3 USDC-quoted pairs (WMNT/mETH/WETH) · `PHASE-0-RESEARCH.md` §2
  - DEC-003 Scoped ERC-20 allowance + SequaExecutor.sol · `PHASE-0-RESEARCH.md` §3
  - DEC-004 Canonical Mantle ERC-8004 deployments · `PHASE-0-RESEARCH.md` §4
  - DEC-005 ERC-8004 minimum interface surface · `PHASE-0-RESEARCH.md` §4
  - DEC-006 Prize stack + panel + dates · `PHASE-0-RESEARCH.md` §5

- **Requirements extracted:** 14
  - On-chain: REQ-source-registry, REQ-follow-registry, REQ-non-custodial-execution, REQ-erc8004-identity-reputation
  - Off-chain: REQ-mirror-engine, REQ-source-agents
  - Frontend: REQ-leaderboard, REQ-agent-profile-and-card, REQ-one-tap-mirror-flow, REQ-your-follows, REQ-share-moment
  - Delivery: REQ-deployment-award-bar, REQ-submission, REQ-community-voting-asset
  - Planning: REQ-phase-plan (revised to 8 days; Phase 4 reduced to wire-up)

- **Constraints:** 13
  - nfr (visual identity / accessibility / motion): 7 — CON-aesthetic, CON-design-tokens, CON-tier-color, CON-ai-interaction, CON-accessibility, CON-motion, CON-anti-patterns
  - nfr (scope completeness): 2 — CON-core-screens, CON-demo-moments
  - protocol (tech stack): 3 — CON-frontend-tech, CON-smart-contract-stack, CON-mirror-engine-stack
  - api-contract: 2 — CON-erc8004-interfaces, CON-fusionx-router

- **Context topics:** 12 (positioning, framing, runway, pre-existing assets, verifiability anchor, demo centerpiece, scoring weights × 2, risks × 3, definition of done, external sources)

- **Conflicts:** 0 blockers · 0 competing variants · 5 auto-resolved (see `.planning/INGEST-CONFLICTS.md`)

## Key signals for the roadmapper

1. **Phase 0 is already substantively complete.** The PRD lists 4 open items (DEX, pair set, ERC-8004 status, executor pattern); all 4 are resolved as LOCKED decisions in `decisions.md`. Day 1 work now compresses to skeleton-contract deploy + verify on Mantle testnet.
2. **8-day plan, not 9-day.** PRD's Phase Plan §7 is out of date. Ship phase compresses from 2 days to 1.
3. **Phase 4 is wire-up, not greenfield.** User has the full UI built in Claude Design. Phase 4 scope = wire existing UI to contracts + mirror engine + Open Graph share-card export. SPEC constraints (CON-aesthetic, CON-tier-color, CON-accessibility, CON-motion, CON-anti-patterns) still apply to the wire-up.
4. **Deployment Award front-loading is non-negotiable.** First-come-first-served, only 20 spots. Phase 0 contract deploy + verify on testnet meets the technical bar at end of Day 1.
5. **One verifiable source agent is the ship-core minimum.** Scope cut line #1.
6. **Mirror fidelity over breadth.** Constrained deterministic source strategies; faithful replication is the whole credibility story.
7. **Non-custodial is the regulatory-optics answer.** Scoped allowance + revocation = "Sequa never holds your funds." Must be explicit in the one-tap flow copy.
8. **The performance card is the highest-leverage asset.** Wins both Best UI/UX (hero object) and Community Voting (X campaign material). OG image generation is mandatory.
9. **Sui Overflow attention split.** Deadline 2026-06-16 (one day after Sequa). Protected phases: 0, 1, 2, 4, 5. Phase 3 (reputation accrual loop) is the first to compress to a designed view per scope cut line #2.

## Status

**READY — safe to route.** No blockers, no competing variants. All ADR decisions, PRD requirements, and SPEC constraints have provenance back to source path. The 5 INFO entries (runway drift, frontend scope reduction, PRD-open-items-now-closed, executor-pattern-locked, benign cross-ref cycle) should be picked up by `gsd-roadmapper` when shaping ROADMAP.md and PROJECT.md.
