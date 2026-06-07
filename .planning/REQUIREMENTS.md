# REQUIREMENTS: Sequa

> v1 requirement set extracted from `Sequa Project.md` (PRD) and reconciled against the 6 LOCKED ADR decisions in `intel/decisions.md`. Where a PRD open item collided with the ADR, the ADR wins. All requirements are v1 (in scope for the 2026-06-15 submission) unless explicitly deferred.

**Total v1 requirements:** 14

**Categories:**

- **ONCHAIN** (4) — registries, executor, ERC-8004 surface
- **OFFCHAIN** (2) — mirror engine, source agents
- **FRONTEND** (5) — five mandatory screens + share moment
- **DELIVERY** (3) — deployment award, DoraHacks submission, viral asset

---

## ONCHAIN

### REQ-01: SourceRegistry — verifiable source agents and on-chain track record
- id: REQ-source-registry
- source: `Sequa Project.md` §2, §3.1
- category: ONCHAIN
- description: AI trading agents register an ERC-8004 identity. Their trades and resulting performance are recorded on Mantle, producing a track record nobody can fabricate.
- acceptance criteria:
  - `SourceRegistry.sol` deployed to Mantle, verified on Mantle Explorer.
  - `registerSource(uint256 agentId, string strategyMeta)` ties a source to its ERC-8004 identity (see DEC-004).
  - `recordSignal(uint256 agentId, bytes signal)` writes the source's trade decision on-chain; emits `SignalRecorded`.
  - `performance(uint256 agentId) view` returns the on-chain track record the performance card reads.

### REQ-02: FollowRegistry — on-chain follow graph and one-tap mirror trigger
- id: REQ-follow-registry
- source: `Sequa Project.md` §2, §3.1
- category: ONCHAIN
- description: The follow graph and the user-facing trigger that authorizes the executor to replicate trades non-custodially.
- acceptance criteria:
  - `FollowRegistry.sol` deployed to Mantle, verified on Mantle Explorer.
  - `mirror(uint256 sourceId, uint256 capital, address executor)` records the follow on-chain and authorizes the executor.
  - `unmirror(uint256 sourceId)` stops following.
  - `followersOf(uint256 sourceId) view` and `following(address user) view` return the graph.
  - The `recordSignal → mirror → execute` path is the AI-callable on-chain function satisfying the 20 Project Deployment Award.

### REQ-03: Non-custodial execution — user funds never leave user custody
- id: REQ-non-custodial-execution
- source: `Sequa Project.md` §3.1, §10
- category: ONCHAIN
- description: Mirror executes via delegated executor with scoped, revocable allowance into the user's own wallet. Sequa never takes custody.
- acceptance criteria:
  - Scoped per-token allowance, kill switch, slippage bounds, whitelisted router (see DEC-003).
  - One-tap revocation: `approve(executor, 0)`.
  - UI explicitly states "Sequa never holds your funds; you can revoke anytime."
  - Pattern: scoped ERC-20 allowance via `SequaExecutor.sol` (DEC-003). Personal-vault path is in scope cut line #3.

### REQ-04: ERC-8004 identity + portable reputation
- id: REQ-erc8004-identity-reputation
- source: `Sequa Project.md` §2, §3.1
- category: ONCHAIN
- description: Every source agent holds an ERC-8004 identity NFT. Sources accrue reputation from verified performance and follower count. Reputation is portable and travels with the agent across the ecosystem.
- acceptance criteria:
  - Use canonical Mantle ERC-8004 registries (see DEC-004 addresses; DEC-005 minimum interface).
  - Follower-driven feedback on each settled trade (`giveFeedback` from the follower's address — self-feedback path impossible by construction).
  - UI reads portable reputation via `getSummary()` for the leaderboard and agent card.

---

## OFFCHAIN

### REQ-05: Mirror engine — off-chain orchestration of mirrored trades
- id: REQ-mirror-engine
- source: `Sequa Project.md` §3.2
- category: OFFCHAIN
- description: Pipeline that watches source signals, scales to follower capital, executes via scoped executor, and attributes the result on-chain.
- acceptance criteria:
  - Watch: TypeScript service listens for `SignalRecorded` from registered sources.
  - Scale: For each follower, scale the trade to committed capital and risk cap.
  - Execute: Submit the scaled trade through the follower's scoped executor on FusionX V3 (see DEC-001, DEC-003).
  - Attribute: Record the mirrored execution so the follower's results and source reputation update on-chain.
  - Faithful replication over breadth — source strategies remain simple and deterministic.

### REQ-06: Source agents — Claude-driven autonomous traders
- id: REQ-source-agents
- source: `Sequa Project.md` §3.3
- category: OFFCHAIN
- description: A small set of source agents (Claude-driven decision logic) trading the locked Mantle pair set on FusionX V3 and recording signals on-chain.
- acceptance criteria:
  - At minimum one strong, verifiable source agent for the demo (scope cut line #1: drop multiple).
  - Trades only the locked pair set (DEC-002).
  - Calls `SourceRegistry.recordSignal()` for every trade decision.
  - Performance computed from on-chain history only.

---

## FRONTEND

### REQ-07: Leaderboard — discovery surface (home screen)
- id: REQ-leaderboard
- source: `Sequa Project.md` §3, §6; `Sequa UI-UX Prompt.md` §"Core screens 1"
- category: FRONTEND
- description: Standings board of verified agents, scannable, competitive, alive.
- acceptance criteria:
  - Each row shows: agent name, avatar, performance tier, headline return, verified-on-chain badge, follower count, sparkline of recent performance.
  - Sort and filter controls.
  - Tapping a row opens the agent profile.
  - Tier color paired with label and figure (never color alone — CON-tier-color, CON-accessibility).

### REQ-08: Agent profile + performance card
- id: REQ-agent-profile-and-card
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 2"
- category: FRONTEND
- description: Per-agent page anchored on the large collectible performance card; the centerpiece of the whole product.
- acceptance criteria:
  - Performance card is the largest, most considered object on the screen.
  - Verified-on-chain badge as a first-class trust element with a path to reconcile claim to on-chain history.
  - Agent strategy personality in plain language (e.g., "patient, trades majors, cuts losses fast").
  - Recent moves rendered as a readable timeline, not a raw trade log.
  - Verified track record reconciled to on-chain history.
  - Follower count and ERC-8004 reputation surfaced as portable credential.
  - Card is self-contained and beautiful out of context (X timeline).

### REQ-09: One-tap mirror flow
- id: REQ-one-tap-mirror-flow
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 3"
- category: FRONTEND
- description: A single primary action that mirrors a source, with a reassuring capital/risk step and a transparent non-custodial authorization.
- acceptance criteria:
  - Primary "Mirror" action visible without scrolling on the agent profile.
  - Step to set capital and risk cap (scope cut line #4 may drop risk cap).
  - Non-custodial authorization screen with plain-language custody and revocation copy.
  - Designed loading, success, and error states throughout — no dead ends.
  - Wire to `approve()` on the three tradeable tokens (per DEC-002) then `FollowRegistry.mirror()`.

### REQ-10: Your follows — portfolio of mirrored agents
- id: REQ-your-follows
- source: `Sequa UI-UX Prompt.md` §"Core screens 4"
- category: FRONTEND
- description: View showing which agents the user is mirroring and each agent's live contribution to results.
- acceptance criteria:
  - List of followed agents with live contribution to user results.
  - One-tap unfollow (revokes `FollowRegistry` entry and ideally guides allowance revocation).
  - Calm, legible, honest presentation.

### REQ-11: Share moment — performance card export to X
- id: REQ-share-moment
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 5", §"Tech constraints"
- category: FRONTEND
- description: Generate the performance card as a polished image and hand it to X in one tap with a pre-composed post.
- acceptance criteria:
  - Dynamic Open Graph image generation produces the card server-side.
  - One-tap share with pre-composed X post.
  - Card renders correctly as X media (correct OG dimensions, fonts loaded).

---

## DELIVERY

### REQ-12: 20 Project Deployment Award bar
- id: REQ-deployment-award-bar
- source: `Sequa Project.md` §9
- category: DELIVERY
- description: First-come-first-served Project Deployment Award; only 20 spots. Phase 0 work front-loads this.
- acceptance criteria:
  - Contracts deployed on Mantle Mainnet or Testnet.
  - Contracts verified on Mantle Explorer.
  - At least one AI-powered function callable on-chain (the `recordSignal → mirror` execution flow).
  - Frontend demo publicly accessible (not localhost).
  - Deployment address in the DoraHacks submission.
  - Demo video ≥ 2 minutes walking the core use case.

### REQ-13: DoraHacks submission
- id: REQ-submission
- source: `Sequa Project.md` §9
- category: DELIVERY
- description: Main hackathon submission package.
- acceptance criteria:
  - Open-source GitHub repo with README (setup, architecture overview, deployed contract address).
  - Runnable demo (publicly accessible frontend).
  - Project pitch.
  - Nominated to Consumer & Viral DApps track.

### REQ-14: Community Voting asset — viral X campaign
- id: REQ-community-voting-asset
- source: `Sequa Project.md` §9
- category: DELIVERY
- description: Community Voting is decided on X; the performance card is the campaign asset.
- acceptance criteria:
  - Clear, compelling X post built around the shareable performance card.
  - Public demo link a non-technical viewer can try.

---

## Traceability

Phase mappings derived in `.planning/ROADMAP.md`. Every v1 requirement maps to exactly one phase.

| Requirement | ID | Phase | Status |
|---|---|---|---|
| REQ-01 SourceRegistry | REQ-source-registry | Phase 0 (skeleton) → Phase 1 (signal path) | Pending |
| REQ-02 FollowRegistry | REQ-follow-registry | Phase 0 (skeleton) → Phase 2 (mirror trigger) | Pending |
| REQ-03 Non-custodial execution | REQ-non-custodial-execution | Phase 2 | Pending |
| REQ-04 ERC-8004 reputation | REQ-erc8004-identity-reputation | Phase 3 | Pending |
| REQ-05 Mirror engine | REQ-mirror-engine | Phase 2 | Pending |
| REQ-06 Source agents | REQ-source-agents | Phase 1 | Pending |
| REQ-07 Leaderboard | REQ-leaderboard | Phase 4 | Pending |
| REQ-08 Agent profile + card | REQ-agent-profile-and-card | Phase 4 | Pending |
| REQ-09 One-tap mirror flow | REQ-one-tap-mirror-flow | Phase 4 | Pending |
| REQ-10 Your follows | REQ-your-follows | Phase 4 | Pending |
| REQ-11 Share moment | REQ-share-moment | Phase 4 | Pending |
| REQ-12 Deployment award bar | REQ-deployment-award-bar | Phase 0 (technical bar) + Phase 5 (submission) | Pending |
| REQ-13 DoraHacks submission | REQ-submission | Phase 5 | Pending |
| REQ-14 Community Voting asset | REQ-community-voting-asset | Phase 5 | Pending |

**Coverage:** 14/14 mapped ✓ (REQ-01 and REQ-02 span Phase 0 skeleton deployment for the deployment-award bar and a later phase for full feature surface; REQ-12 spans Phase 0 technical clearance and Phase 5 submission packaging.)

## Scope cut lines (PRD §8)

Apply in this order if time loss to Sui Overflow forces cuts:

1. **Drop multiple source agents** — ship one strong, verifiable source. (Affects REQ-06.)
2. **Drop the live reputation accrual loop** — present reputation as a designed view backed by on-chain performance. (Affects Phase 3 / REQ-04.)
3. **Drop personal-vault execution** — mirror into the user's wallet directly via scoped allowance (already the DEC-003 default). (Affects REQ-03.)
4. **Drop risk-cap configuration** — mirror at a fixed scale. (Affects REQ-09.)
5. **Reduce the trading pair set to a single pair** — would override part of DEC-002; document explicitly. (Affects REQ-06, REQ-09.)

**Ship-core minimum:** one verifiable source agent, on-chain signals, non-custodial mirror into a follower wallet, the leaderboard + agent card + one-tap follow + shareable card.
