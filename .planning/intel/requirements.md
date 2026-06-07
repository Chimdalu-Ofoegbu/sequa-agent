# Requirements (PRD Intel)

Synthesized from `Sequa Project.md` (PRD, precedence 2). Where a requirement collides with a higher-precedence ADR (e.g., venue confirmation, executor pattern, ERC-8004 registries), the ADR wins; the PRD's "open Phase 0 item" is closed and the answer is recorded in `decisions.md`.

---

## REQ-source-registry — On-chain source registry and verifiable performance
- source: `Sequa Project.md` §2, §3.1
- description: AI trading agents register an ERC-8004 identity. Their trades and resulting performance are recorded on Mantle, producing a track record nobody can fabricate.
- acceptance criteria:
  - `SourceRegistry.sol` deployed to Mantle, verified on Mantle Explorer.
  - `registerSource(uint256 agentId, string strategyMeta)` ties a source to its ERC-8004 identity (see DEC-004).
  - `recordSignal(uint256 agentId, bytes signal)` writes the source's trade decision on-chain; emits `SignalRecorded`.
  - `performance(uint256 agentId) view` returns the on-chain track record the performance card reads.
- scope: Smart contracts, source agent integration.

---

## REQ-follow-registry — On-chain follow graph and one-tap mirror trigger
- source: `Sequa Project.md` §2, §3.1
- description: The follow graph and the user-facing trigger that authorizes the executor to replicate trades non-custodially.
- acceptance criteria:
  - `FollowRegistry.sol` deployed to Mantle, verified on Mantle Explorer.
  - `mirror(uint256 sourceId, uint256 capital, address executor)` records the follow on-chain and authorizes the executor.
  - `unmirror(uint256 sourceId)` stops following.
  - `followersOf(uint256 sourceId) view` and `following(address user) view` return the graph.
  - The `recordSignal → mirror → execute` path is the AI-callable on-chain function satisfying the 20 Project Deployment Award.
- scope: Smart contracts, follow graph.

---

## REQ-mirror-engine — Off-chain orchestration of mirrored trades
- source: `Sequa Project.md` §3.2
- description: Pipeline that watches source signals, scales to follower capital, executes via scoped executor, and attributes the result on-chain.
- acceptance criteria:
  - Watch: TypeScript service listens for `SignalRecorded` from registered sources.
  - Scale: For each follower, scale the trade to committed capital and risk cap.
  - Execute: Submit the scaled trade through the follower's scoped executor on FusionX V3 (see DEC-001, DEC-003).
  - Attribute: Record the mirrored execution so the follower's results and source reputation update on-chain.
  - Faithful replication over breadth — source strategies remain simple and deterministic.
- scope: Mirror engine (Node/TypeScript service).

---

## REQ-non-custodial-execution — User funds never leave user custody
- source: `Sequa Project.md` §3.1, §10
- description: Mirror executes via delegated executor with scoped, revocable allowance into the user's own wallet. Sequa never takes custody.
- acceptance criteria:
  - Scoped per-token allowance, kill switch, slippage bounds, whitelisted router (see DEC-003).
  - One-tap revocation: `approve(executor, 0)`.
  - UI explicitly states "Sequa never holds your funds; you can revoke anytime."
  - Pattern selection: scoped ERC-20 allowance — vault path is in scope cut line #3.
- scope: Executor contract, frontend authorization flow, custody story.

---

## REQ-erc8004-identity-reputation — Portable on-chain reputation
- source: `Sequa Project.md` §2, §3.1
- description: Every source agent holds an ERC-8004 identity NFT. Sources accrue reputation from verified performance and follower count. Reputation is portable and travels with the agent across the ecosystem.
- acceptance criteria:
  - Use canonical Mantle ERC-8004 registries (see DEC-004 for addresses and integration surface).
  - Follower-driven feedback on each settled trade (`giveFeedback` from the follower's address).
  - UI reads portable reputation via `getSummary()` for the leaderboard and agent card.
  - Self-feedback path must be impossible by construction (see DEC-004 gotchas).
- scope: Smart contracts, mirror engine attribution path, frontend reputation surface.

---

## REQ-leaderboard — Discovery surface (home screen)
- source: `Sequa Project.md` §3, §6; `Sequa UI-UX Prompt.md` §"Core screens 1"
- description: Standings board of verified agents, scannable, competitive, alive.
- acceptance criteria:
  - Each row shows: agent name, avatar, performance tier, headline return, verified-on-chain badge, follower count, sparkline of recent performance.
  - Sort and filter controls.
  - Tapping a row opens the agent profile.
  - Tier color paired with label and figure (never color alone — see SPEC accessibility constraint).
- scope: Frontend (wire-up of existing Claude Design UI to live contract data).

---

## REQ-agent-profile-and-card — Hero performance card + agent profile
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 2"
- description: Per-agent page anchored on the large collectible performance card; the centerpiece of the whole product.
- acceptance criteria:
  - Performance card is the largest, most considered object on the screen.
  - Verified-on-chain badge as a first-class trust element with a path to reconcile claim to on-chain history.
  - Agent strategy personality in plain language (e.g., "patient, trades majors, cuts losses fast").
  - Recent moves rendered as a readable timeline, not a raw trade log.
  - Verified track record reconciled to on-chain history.
  - Follower count and ERC-8004 reputation surfaced as portable credential.
  - Card is self-contained and beautiful out of context (X timeline).
- scope: Frontend (wire-up + visual polish), share-card composition.

---

## REQ-one-tap-mirror-flow — Effortless follow flow
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 3"
- description: A single primary action that mirrors a source, with a reassuring capital/risk step and a transparent non-custodial authorization.
- acceptance criteria:
  - Primary "Mirror" action visible without scrolling on the agent profile.
  - Step to set capital and risk cap (scope cut line #4 may drop risk cap).
  - Non-custodial authorization screen with plain-language custody and revocation copy.
  - Designed loading, success, and error states throughout — no dead ends.
  - Wire to `approve()` on the three tradeable tokens (per DEC-002) then `FollowRegistry.mirror()`.
- scope: Frontend flow, wallet connection, signature/approval handling.

---

## REQ-your-follows — Portfolio of mirrored agents
- source: `Sequa UI-UX Prompt.md` §"Core screens 4"
- description: View showing which agents the user is mirroring and each agent's live contribution to results.
- acceptance criteria:
  - List of followed agents with live contribution to user results.
  - One-tap unfollow (revokes `FollowRegistry` entry and ideally guides allowance revocation).
  - Calm, legible, honest presentation.
- scope: Frontend.

---

## REQ-share-moment — Card export to X
- source: `Sequa Project.md` §6; `Sequa UI-UX Prompt.md` §"Core screens 5", §"Tech constraints"
- description: Generate the performance card as a polished image and hand it to X in one tap with a pre-composed post.
- acceptance criteria:
  - Dynamic Open Graph image generation produces the card server-side.
  - One-tap share with pre-composed X post.
  - Card renders correctly as X media (correct OG dimensions, fonts loaded).
- scope: Frontend, server-side image generation (Next.js OG route).

---

## REQ-source-agents — Autonomous Claude-driven trading agents
- source: `Sequa Project.md` §3.3
- description: A small set of source agents (Claude-driven decision logic) trading the locked Mantle pair set on FusionX V3 and recording signals on-chain.
- acceptance criteria:
  - At minimum one strong, verifiable source agent for the demo (scope cut line #1: drop multiple).
  - Trades only the locked pair set (DEC-002).
  - Calls `SourceRegistry.recordSignal()` for every trade decision.
  - Performance computed from on-chain history only.
- scope: Off-chain agent runtime + Claude integration.

---

## REQ-deployment-award-bar — Clear all checklist items
- source: `Sequa Project.md` §9
- description: First-come-first-served 20 Project Deployment Award; only 20 spots. Phase 0 work front-loads this.
- acceptance criteria:
  - Contracts deployed on Mantle Mainnet or Testnet.
  - Contracts verified on Mantle Explorer.
  - At least one AI-powered function callable on-chain (the `recordSignal → mirror` execution flow).
  - Frontend demo publicly accessible (not localhost).
  - Deployment address in the DoraHacks submission.
  - Demo video ≥ 2 minutes walking the core use case.
- scope: Submission deliverables.

---

## REQ-submission — DoraHacks main submission
- source: `Sequa Project.md` §9
- description: Main hackathon submission package.
- acceptance criteria:
  - Open-source GitHub repo with README (setup, architecture overview, deployed contract address).
  - Runnable demo (publicly accessible frontend).
  - Project pitch.
  - Nominated to Consumer & Viral DApps track.
- scope: Submission deliverables.

---

## REQ-community-voting-asset — Viral X campaign
- source: `Sequa Project.md` §9
- description: Community Voting is decided on X; the performance card is the campaign asset.
- acceptance criteria:
  - Clear, compelling X post built around the shareable performance card.
  - Public demo link a non-technical viewer can try.
- scope: Marketing / launch.

---

## REQ-phase-plan — Compressed phase plan
- source: `Sequa Project.md` §7 (original 9 days) + user-supplied correction (8 days; UI pre-built)
- description: Phase plan front-loads the deployment award so worst-case finish still wins it.
- acceptance criteria (REVISED — see CONFLICTS auto-resolved INFO entries):
  - **Phase 0 — Lock (Day 1, non-negotiable).** ALREADY COMPLETE: trading venue, pair set, executor pattern, ERC-8004 deployments confirmed and recorded in `decisions.md`. Remaining Day 1 work is the skeleton-contract deploy + verify on Mantle testnet.
  - **Phase 1 — Source + signals (Days 2–3, non-negotiable).** One or two source agents trading the fixed pair set, recording signals on-chain, performance computed from on-chain history. Includes the half-day FusionX testnet LP seeding chore (DEC-002).
  - **Phase 2 — Mirror execution (Day 4, non-negotiable).** Non-custodial scaled replication into a follower wallet via `SequaExecutor.sol`. Hardest technical piece; protect the time.
  - **Phase 3 — ERC-8004 + reputation (Day 5, high value).** Mint identities; accrue source reputation from performance + follower count via `giveFeedback`. Resolve the `clientAddresses[]` allowlist decision here (DEC-004 gotcha).
  - **Phase 4 — Frontend wire-up + card (Days 6–7, non-negotiable for Best UI/UX and Community Voting).** SCOPE REDUCED: wire existing Claude Design UI to contracts + mirror engine + Open Graph share-card export. NOT greenfield design/build.
  - **Phase 5 — Ship (Day 8, non-negotiable).** Compressed to one day (was Days 8–9). Record ≥2-minute demo, write README, push repo, complete DoraHacks submission, launch Community Voting X post.
- scope cut lines (apply in this order if time loss to Sui Overflow forces cuts):
  1. Drop multiple source agents; ship one strong, verifiable source.
  2. Drop the live reputation accrual loop; present reputation as a designed view backed by on-chain performance.
  3. Drop personal-vault execution; mirror into the user's wallet directly via scoped allowance (already the default per DEC-003).
  4. Drop risk-cap configuration; mirror at a fixed scale.
  5. Reduce the trading pair set to a single pair (would override part of DEC-002; document explicitly).
- ship-core minimum: one verifiable source agent, on-chain signals, non-custodial mirror into a follower wallet, the leaderboard + agent card + one-tap follow + shareable card.
