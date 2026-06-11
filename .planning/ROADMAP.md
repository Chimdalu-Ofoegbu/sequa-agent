# ROADMAP: Sequa

> Six phases derived from `Sequa Project.md` §7, REVISED to the 8-day runway (today 2026-06-07 → deadline 2026-06-15) and to the Phase 4 scope reduction (existing Claude Design UI is the starting point, not a greenfield build). All revisions trace to auto-resolved INFO entries in `.planning/INGEST-CONFLICTS.md`.
>
> Granularity: standard. Coverage: 14/14 v1 requirements mapped.
>
> Non-negotiable phases: 0, 1, 2, 4, 5. Optional / first to compress: 3.

## Phases

- [x] **Phase 0: Lock** — Deploy skeleton SourceRegistry + FollowRegistry to Mantle Sepolia, verify on Mantle Explorer, wire trivial `recordSignal → mirror` AI-callable function to clear the 20 Project Deployment Award technical bar by end of Day 1. **(Complete 2026-06-08; all 3 of 3 official Technical Deployment criteria cleared.)**
- [ ] **Phase 1: Source + signals** — One verifiable Claude-driven source agent trading the locked FusionX V3 pair set, recording every decision on-chain; performance computed from on-chain history only.
- [ ] **Phase 2: Mirror execution** — `SequaExecutor.sol` plus TypeScript mirror engine that scales source signals to follower capital and executes non-custodially through scoped ERC-20 allowance.
- [ ] **Phase 3: ERC-8004 + reputation** — Mint source identities via canonical Mantle IdentityRegistry; accrue reputation through follower-driven `giveFeedback` on settled trades; resolve `clientAddresses[]` allowlist strategy.
- [ ] **Phase 4: Frontend wire-up + share card** — Export existing Claude Design UI to Next.js, wire to contracts + mirror engine, implement dynamic Open Graph image generation for the share card.
- [ ] **Phase 5: Ship** — Record ≥2-minute demo video, write README, push public repo, complete DoraHacks submission, launch Community Voting X post.

## Phase Details

### Phase 0: Lock
**Goal**: Deployment Award technical bar is cleared by end of Day 1 — verifiable contracts on Mantle, ≥1 AI-callable on-chain function visible on Explorer.
**Status**: Strategy work already complete; only the skeleton-contract deploy + verify remains.
**Depends on**: Nothing (ADR-locked groundwork already done).
**Non-negotiable**: Yes.
**Requirements**:
- REQ-01 SourceRegistry (skeleton)
- REQ-02 FollowRegistry (skeleton — trivial `recordSignal → mirror` path)
- REQ-12 Deployment award bar (technical clearance portion)
**Already locked (no work remaining)**:
- DEC-001 FusionX V3 venue
- DEC-002 3 USDC-quoted pairs (WMNT/mETH/WETH)
- DEC-003 SequaExecutor scoped-allowance pattern
- DEC-004 Canonical ERC-8004 deployments
- DEC-005 ERC-8004 minimum interface surface
- DEC-006 Prize stack + panel + dates
**Remaining Day 1 work**:
  1. Foundry project scaffold; `IIdentityRegistry` + `IReputationRegistry` interfaces from DEC-005 wired in.
  2. Skeleton `SourceRegistry.sol` with `registerSource`, `recordSignal` (emits `SignalRecorded`), `performance` view.
  3. Skeleton `FollowRegistry.sol` with `mirror`, `unmirror`, `followersOf`, `following`.
  4. Deploy both to Mantle Sepolia; verify both on Mantle Explorer.
  5. Trivial end-to-end `recordSignal → mirror` transaction submitted from a test wallet; tx hash captured for the deployment-award submission packet.
**Success Criteria** (what must be TRUE):
  1. `SourceRegistry.sol` and `FollowRegistry.sol` are deployed on Mantle Sepolia with public, verified source on Mantle Explorer. *(REQ-01, REQ-02, REQ-12)*
  2. A test transaction executes the `recordSignal → mirror` path end to end on Sepolia; the tx hash demonstrates an AI-callable on-chain function. *(REQ-02, REQ-12)*
  3. Deployment addresses are captured in `.planning/` notes ready to paste into the DoraHacks submission. *(REQ-12, REQ-13)*
**Deliverables**:
- `contracts/SourceRegistry.sol` (skeleton, verified on Mantle Sepolia)
- `contracts/FollowRegistry.sol` (skeleton, verified on Mantle Sepolia)
- Sepolia deployment manifest (addresses + tx hashes) committed to repo
**Contingency annotations**: None — this phase IS the contingency floor for every other phase. If anything else slips, Phase 0 still guarantees the deployment award.
**Plans**: 5 plans
- [x] 00-01-PLAN.md — Foundry scaffold + IIdentity/IReputation/ITradeExecutor interfaces + SequaConstants address pins (Wave 1)
- [x] 00-02-PLAN.md — SourceRegistry.sol skeleton + Forge test suite (Wave 2)
- [x] 00-03-PLAN.md — FollowRegistry.sol skeleton + Forge test suite (Wave 2)
- [x] 00-04-PLAN.md — Deploy + verify both contracts on Mantle Sepolia (Wave 3, checkpointed)
- [x] 00-05-PLAN.md — End-to-end recordSignal -> mirror test tx + DEPLOYMENT.md manifest (Wave 4, checkpointed)
**UI hint**: no

### Phase 1: Source + signals
**Goal**: At least one verifiable Claude-driven source agent is live on the locked FusionX V3 pair set, recording every trade decision on-chain so its performance is computed from on-chain history only.
**Depends on**: Phase 0.
**Non-negotiable**: Yes.
**Requirements**:
- REQ-01 SourceRegistry (full signal path / `performance` view)
- REQ-06 Source agents
**Scope notes**:
- Trades only the locked pair set (DEC-002): WMNT/USDC, mETH/USDC, WETH/USDC. Single-hop only (CON-fusionx-router).
- Source strategies remain simple and deterministic (faithful replication > breadth — risk mitigation per `intel/context.md`).
- Includes the half-day FusionX Sepolia LP-seeding chore from DEC-002 (testnet liquidity is thin).
**Success Criteria** (what must be TRUE):
  1. At least one source agent runs a Claude-driven decision loop and calls `SourceRegistry.recordSignal()` for every trade it intends to execute. *(REQ-06, REQ-01)*
  2. Source-agent performance is computed from on-chain history only — no off-chain bookkeeping path. *(REQ-01, REQ-06)*
  3. Source-agent executions land on FusionX V3 Sepolia against the three locked USDC-quoted pairs. *(REQ-06)*
  4. `SourceRegistry.performance(agentId)` returns a track record the (future) agent card can read. *(REQ-01, REQ-08 read path)*
**Deliverables**:
- Claude-driven source agent runtime (Node 20+ / TypeScript)
- FusionX Sepolia LP positions seeded for the three locked pairs
- `SourceRegistry.recordSignal` integration verified on at least one live signal
**Contingency annotations**:
- **Scope cut line #1** (from Sequa Project.md §8): drop multiple source agents — ship one strong, verifiable source. This phase already plans for the "one strong agent" floor.
- **Scope cut line #5**: if Phase 1 falls behind, the trading pair set can be reduced to a single pair. This overrides part of DEC-002 and MUST be documented explicitly in `.planning/` if invoked.
**Plans**: 6 plans across 4 waves
- [x] 01-01-PLAN.md — Self-deploy UniV3 fork + 4 mock ERC-20s + seed 3 full-range pools; write back venue/token/pool addresses (Wave 1, D-43)
- [x] 01-02-PLAN.md — Extend + redeploy SourceRegistry (invalidateSignal, signalAt, typed SignalDecoded) + tests (Wave 1)
- [x] 01-03-PLAN.md — Greenfield agent/ workspace: pure MA-crossover core + replay tests + Claude narration + eval harness (Wave 1)
- [x] 01-04-PLAN.md — Chain layer: ERC-8004 mint + registerSource + recordSignal→swap hot path + QuoterV2 quote + shared tuple codec (Wave 2) — chain layer built; live ERC-8004 mint DEFERRED to Plan 06
- [ ] 01-05-PLAN.md — Runtime: 30s poll loop + thesis store + /healthz + reconciler CLI (D-40 gate) + ambient noise bot (Wave 3)
- [ ] 01-06-PLAN.md — Go live: redeploy/verify + mint identity + first live signal + host always-on + reconciler acceptance gate + RUN.md (Wave 4)
**UI hint**: no

### Phase 2: Mirror execution
**Goal**: Source signals are mirrored into follower wallets non-custodially at scaled capital through `SequaExecutor.sol` and the TypeScript mirror engine.
**Depends on**: Phase 1.
**Non-negotiable**: Yes — hardest technical piece; protect the time.
**Requirements**:
- REQ-02 FollowRegistry (mirror trigger surface)
- REQ-03 Non-custodial execution
- REQ-05 Mirror engine
**Scope notes**:
- Executor pattern is LOCKED by DEC-003: scoped per-token ERC-20 allowance, whitelisted router (DEC-001 FusionX V3 only), per-user caps, slippage bounds, kill switch.
- Mirror engine is a Node 20+ TypeScript daemon listening for `SignalRecorded` events.
- `ITradeExecutor` interface wrapper preserved for future migration to ERC-4337 session keys or Safe modules (DEC-003).
**Success Criteria** (what must be TRUE):
  1. A follower wallet that has called `approve(executor, cap)` on the locked tokens can be mirrored end-to-end: `SignalRecorded` → mirror engine scales → `SequaExecutor.executeTrade` → FusionX V3 single-hop swap settles in the follower's wallet. *(REQ-02, REQ-03, REQ-05)*
  2. `approve(executor, 0)` from the follower fully revokes Sequa's authorization in one transaction. *(REQ-03)*
  3. `SequaExecutor.sol` enforces: whitelisted router check, per-token cap, slippage bounds, kill switch. *(REQ-03)*
  4. Mirror engine listens for `SignalRecorded` and dispatches scaled executions for every active follower of that source. *(REQ-05)*
  5. The `recordSignal → mirror → execute` path remains the AI-callable on-chain function for the deployment award, now backed by a real source. *(REQ-02, REQ-12)*
**Deliverables**:
- `contracts/SequaExecutor.sol` deployed + verified on Mantle Sepolia
- `contracts/ITradeExecutor.sol` interface (migration architecture per DEC-003)
- Mirror engine daemon (TypeScript) with `SignalRecorded` listener, scaling logic, executor dispatcher
- End-to-end mirror demo transaction captured on Sepolia
**Contingency annotations**:
- **Scope cut line #3**: drop personal-vault execution — already the default per DEC-003, so no architecture change needed if invoked.
- **Scope cut line #4**: drop risk-cap configuration — mirror at a fixed scale. This simplifies the mirror engine and the Phase 4 approval flow.
**Plans**: TBD
**UI hint**: no

### Phase 3: ERC-8004 + reputation
**Goal**: Source agents hold ERC-8004 identities and accrue portable reputation from follower-driven feedback on settled mirrored trades.
**Depends on**: Phase 2 (needs settled trades to call `giveFeedback` on).
**Non-negotiable**: NO — first phase to compress under time pressure (per Sequa Project.md §8 scope cut line #2 and `intel/SYNTHESIS.md` §9).
**Requirements**:
- REQ-04 ERC-8004 identity + portable reputation
**Scope notes**:
- Use canonical Mantle ERC-8004 deployments only (DEC-004 — do NOT redeploy).
- Implement only the DEC-005 minimum surface: IdentityRegistry `register` / `getAgentWallet` / `ownerOf`; ReputationRegistry `giveFeedback` / `getSummary`. No ValidationRegistry in v1.
- **Self-feedback is impossible by construction** (DEC-004 gotcha): `FollowRegistry.giveFeedback` MUST be called from the follower's address, never the source's owner/operators.
- **Must resolve in this phase**: the `clientAddresses[]` allowlist strategy for `getSummary()` — there is no global trust score. Decide: (a) UI curates which followers count, or (b) compute weighting client-side.
**Success Criteria** (what must be TRUE):
  1. Each source agent has an ERC-8004 `agentId` minted against canonical Mantle IdentityRegistry; `ownerOf(agentId) == sourceOwner` gates source-side writes. *(REQ-04, REQ-01)*
  2. On every settled mirrored trade, the follower's address calls `giveFeedback(sourceAgentId, pnlBps, 4, "copy-trade", "settled", ...)` — source operators cannot self-feedback. *(REQ-04)*
  3. A `clientAddresses[]` allowlist strategy is chosen, documented in `.planning/`, and used by `getSummary()` calls from the UI read path. *(REQ-04)*
  4. The agent card and leaderboard can read portable reputation via `getSummary()` and render it as a portable credential. *(REQ-04, REQ-07 / REQ-08 read paths)*
**Deliverables**:
- ERC-8004 identity minting wired into `SourceRegistry.registerSource`
- Settlement path in `FollowRegistry` / mirror engine that calls `giveFeedback` from the follower's address on every settled trade
- `clientAddresses[]` allowlist decision recorded as an inline ADR in `.planning/`
- `getSummary()` read helpers consumed by the frontend
**Contingency annotations**:
- **Scope cut line #2** (PRIMARY contingency, applied first under time pressure): drop the live reputation accrual loop. Present reputation as a designed view backed by on-chain performance — i.e., the UI shows reputation surfaces but they read from `SourceRegistry.performance` rather than from a live `giveFeedback` loop. The ERC-8004 identity mint should still happen (it's cheap and on the verifiability story) but per-trade feedback can be deferred.
- If this entire phase is dropped, REQ-04 collapses to "agents have ERC-8004 identities minted; reputation surface is designed".
**Plans**: TBD
**UI hint**: no

### Phase 4: Frontend wire-up + share card
**Goal**: The existing Claude Design UI is live as a Next.js app on Vercel, wired to contracts + mirror engine, with the performance card exportable as a dynamic Open Graph image for X.
**Depends on**: Phase 2 (mirror execution must be callable from UI). Phase 3 is read-path nice-to-have, not blocker.
**Non-negotiable**: Yes — this phase wins Best UI/UX and Community Voting.
**SCOPE — IMPORTANT**: This is **wire-up, NOT greenfield design/build**. The full UI already exists in Claude Design. Phase 4 work = export to Next.js, wire to contracts + mirror engine, implement dynamic OG image generation. All SPEC constraints (`intel/constraints.md` — CON-aesthetic, CON-tier-color, CON-accessibility, CON-motion, CON-anti-patterns) still apply to the wire-up.
**Requirements**:
- REQ-07 Leaderboard
- REQ-08 Agent profile + performance card
- REQ-09 One-tap mirror flow
- REQ-10 Your follows
- REQ-11 Share moment
**Scope notes**:
- Tech stack (CON-frontend-tech): Next.js 14+, Tailwind core utilities only, dynamic Open Graph image route for the share card. Custom fonts loaded properly (HARD BAN on Inter / Roboto / Arial / system fonts).
- Five mandatory screens (CON-core-screens): leaderboard, agent profile + card, one-tap mirror flow, your follows, share moment.
- Tier color paired with label and figure on every surface that uses it (CON-tier-color, CON-accessibility).
- Designed loading / empty / error states on every async surface (CON-motion).
- Deployed publicly to Vercel — not localhost — to clear REQ-12 frontend bar.
**Success Criteria** (what must be TRUE):
  1. All five mandatory screens are publicly accessible on a Vercel-deployed Next.js build that visually matches the Claude Design source. *(REQ-07, REQ-08, REQ-09, REQ-10, REQ-11, REQ-12)*
  2. Leaderboard reads live source-agent data from `SourceRegistry.performance` and ERC-8004 `getSummary()` (or the Phase-3-contingency designed view); tier color is always paired with label + figure. *(REQ-07, REQ-04)*
  3. Agent profile renders the performance card as the largest object on screen, with a first-class verified-on-chain badge that reconciles to on-chain history. *(REQ-08)*
  4. One-tap mirror flow performs `approve()` on the three locked tokens (DEC-002) then `FollowRegistry.mirror()` with plain-language custody + revocation copy and designed loading/success/error states. *(REQ-09, REQ-03)*
  5. Your-follows view shows mirrored agents with live contribution and one-tap unfollow that triggers `unmirror` and guides allowance revocation. *(REQ-10, REQ-03)*
  6. The share moment generates the performance card via a dynamic OG image route and opens X with a pre-composed post; the OG image renders correctly as X media with custom fonts loaded. *(REQ-11, REQ-14)*
**Deliverables**:
- Next.js 14+ app deployed publicly on Vercel
- Five mandatory screens wired to contracts + mirror engine
- `/api/og/[agentId]` (or equivalent) dynamic Open Graph image route
- Wallet connection + `approve()` + `mirror()` integrated into the one-tap flow
- Visible focus states, plain-language tooltips/glossary for jargon (mirror, non-custodial, risk cap, ERC-8004)
**Contingency annotations**:
- **Scope cut line #4**: drop the risk-cap configuration step from the one-tap flow; mirror at a fixed scale. Frees one screen-state worth of design polish.
- **Scope cut line #2**: if reputation accrual is cut in Phase 3, the agent card and leaderboard read reputation from `SourceRegistry.performance` instead of `getSummary()` — wire-up swap only.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Ship
**Goal**: A submission package that wins the deployment award and is positioned for Consumer & Viral DApps, Best UI/UX, and Community Voting.
**Depends on**: Phases 0, 2, 4 minimum; Phases 1, 3 ideally.
**Non-negotiable**: Yes. **Compressed to one day** (was Days 8â€“9 in PRD §7; revised to Day 8 only per `INGEST-CONFLICTS.md` runway-drift INFO).
**Requirements**:
- REQ-12 Deployment award bar (submission packaging)
- REQ-13 DoraHacks submission
- REQ-14 Community Voting asset
**Scope notes**:
- Demo video must be ≥2 minutes and walk the core use case end-to-end.
- The five on-camera demo moments (CON-demo-moments) anchor the video: leaderboard resolve → collectible card on the agent profile → one-tap follow + confirmation → live mirror side-by-side → share-to-X.
- README must contain setup, architecture overview, and deployed contract addresses.
- DoraHacks submission must be nominated to the Consumer & Viral DApps track.
- The X share-card post is the Community Voting campaign asset.
- **MUST confirm** the deployment-award fine print directly on the DoraHacks portal before submitting (per DEC-006 fine print).
**Success Criteria** (what must be TRUE):
  1. A ≥2-minute demo video is recorded and posted, walking the leaderboard → agent card → one-tap follow → live mirror → share-to-X loop. *(REQ-12, REQ-13)*
  2. A public open-source GitHub repo exists with README (setup + architecture + deployed addresses) and a runnable demo link. *(REQ-13)*
  3. The DoraHacks submission is filed, nominated to the Consumer & Viral DApps track, and includes the deployment address. *(REQ-12, REQ-13)*
  4. A Community Voting X post is launched featuring the dynamically-generated performance card and a public demo link a non-technical viewer can try. *(REQ-14)*
**Deliverables**:
- ≥2-minute demo video (hosted, linked from submission)
- Public GitHub repo + README
- Completed DoraHacks submission with deployment addresses
- Launched X share-card campaign post for Community Voting
**Contingency annotations**:
- If Phase 1 collapsed to scope cut line #1 (one source agent), the demo script still works — one strong verifiable source is the ship-core minimum.
- If Phase 3 was cut, the demo emphasizes verifiable performance from on-chain signal history rather than the live reputation loop.
- The compressed one-day window is itself a contingency: the deployment-award bar was already cleared in Phase 0, so a worst-case Phase 5 still ships the minimum-viable submission.
**Plans**: TBD
**UI hint**: no

---

## Progress

| Phase | Plans Complete | Status | Completed |
|---|---|---|---|
| 0. Lock | 5/5 | Complete | 2026-06-08 |
| 1. Source + signals | 4/6 | In progress (Wave 2 done; 05 poll-loop + 06 go-live remain) | - |
| 2. Mirror execution | 0/0 | Not planned | - |
| 3. ERC-8004 + reputation | 0/0 | Not planned | - |
| 4. Frontend wire-up + share card | 0/0 | Not planned | - |
| 5. Ship | 0/0 | Not planned | - |

## Coverage

✓ 14/14 v1 requirements mapped
✓ No orphaned requirements
✓ Non-negotiable phases (0, 1, 2, 4, 5) clearly marked
✓ Optional phase (3) clearly marked + contingency lines pre-encoded
✓ Scope cut lines from Sequa Project.md §8 annotated on every affected phase
