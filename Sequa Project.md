# Sequa_project.md

**Follow a proven AI trading agent in one tap. Sequa mirrors its moves to your wallet, you keep custody, and the agent's track record is on-chain and impossible to fake.**

- **Hackathon:** Mantle Turing Test Hackathon 2026, Phase 2 (AI Awakening)
- **Primary track:** Consumer & Viral DApps
- **Prize stack targeted:** Consumer & Viral, Best UI/UX, Community Voting, 20 Project Deployment Award
- **Deadline:** June 15, 2026. Current runway: ~9 days, shared with the Sui Overflow build (deadline June 16). Treat attention as split; see Phase Plan for what is non-negotiable.
- **Frontend spec:** lives in the separate `Sequa_prompt.md`. This is the build where the interface *is* the product, so that file carries the most weight of any in this project.

---

## 1. One-paragraph positioning

Sequa is the Latin *sequi*, "to follow," and following is the whole product. Today copy-trading runs on screenshots and trust; a stranger claims a return and you believe them or you don't. Sequa replaces the screenshot with proof. Top AI trading agents register an ERC-8004 identity, their entire performance history is recorded on Mantle where it cannot be edited or faked, and any user can mirror one in a single tap: a follower agent copies the source's trades to the user's own non-custodial wallet, scaled to their capital. The agent's reputation is a portable on-chain credential that travels with it across the ecosystem, and a beautiful, shareable performance card turns every good run into a post. The depth is verifiable reputation; the surface is a consumer app people actually want to share. That combination is exactly what wins Consumer & Viral, Community Voting, and Best UI/UX at once.

---

## 2. What we are building (scope)

A working system with four parts:

1. **Source registry and verifiable performance (on-chain).** AI trading agents register an ERC-8004 identity. Their trades and resulting performance are recorded on Mantle, producing a track record nobody can fabricate.
2. **Mirror engine (off-chain orchestration + on-chain execution).** When a user follows a source, the engine replicates the source's trades into the user's own wallet or personal vault, scaled to the user's capital, non-custodially.
3. **ERC-8004 identity and portable reputation.** Every source and follower agent holds an identity NFT; sources accrue reputation from verified performance and follower count. Reputation is the durable, portable asset.
4. **Viral surface (frontend).** The leaderboard, the agent profile, the one-tap mirror flow, and the shareable performance card. Full spec in `Sequa_prompt.md`; this is where the prizes are won.

**Trading venue at demo time:** keep it constrained. Source agents trade a small fixed set of Mantle pairs (e.g. mETH, USDC, and one or two majors) on a Mantle DEX route. Do not attempt arbitrary-strategy mirroring; a fixed, well-behaved strategy set is the difference between a demo that works on stream and one that does not. Confirm the venue and pairs in Phase 0.

---

## 3. Architecture

```
                    +---------------------------------+
                    |         Frontend (Next.js)      |
                    |  leaderboard - agent card -     |  <-- Sequa_prompt.md owns this
                    |  one-tap mirror - share-to-X    |
                    +----------------+----------------+
                                     | reads / triggers follow
                                     v
   +----------------------+   mirror(sourceId)   +---------------------------+
   |   Mirror engine      | <------------------- |   FollowRegistry.sol      |
   |   (off-chain orch.)  |                      |   (Mantle Network)        |
   |                      |   trade signal       +-------------+-------------+
   |  - watch source      | -------------------> |  SourceRegistry.sol       |
   |  - scale to capital  |   executes follow    |  (perf recorded on-chain) |
   |  - execute on Mantle |                      +-------------+-------------+
   +----------+-----------+                                    | references
              |                                                v
              | non-custodial exec                +---------------------------+
              v                                    |  ERC-8004 Identity NFT    |
   +----------------------+                        |  ERC-8004 Reputation rec  |
   |  User wallet / vault  |  user keeps custody   +---------------------------+
   +----------------------+
```

### 3.1 Smart contracts (Solidity, deploy to Mantle)

- **`SourceRegistry.sol`** — registers source agents and records verifiable performance.
  - `registerSource(uint256 agentId, string strategyMeta)` — ties a source to its ERC-8004 identity.
  - `recordSignal(uint256 agentId, bytes signal)` — the source agent's trade decision, written on-chain. This is the inference-on-chain event the mirror engine and the deployment award both depend on. Emits `SignalRecorded`.
  - `performance(uint256 agentId) view` — the on-chain track record the performance card reads.
- **`FollowRegistry.sol`** — the follow graph and the user-facing trigger.
  - `mirror(uint256 sourceId, uint256 capital, address executor)` — a user starts following a source; records the follow on-chain and authorizes the executor to replicate trades into the user's wallet/vault. This is the public, on-chain AI-driven function that satisfies the 20 Project Deployment Award.
  - `unmirror(uint256 sourceId)` — stop following.
  - `followersOf(uint256 sourceId) view` and `following(address user) view`.
- **ERC-8004 integration** — use the canonical Identity Registry (ERC-721) to mint each agent's identity, and the Reputation Registry to accrue source reputation from verified performance and follower count. Confirm in Phase 0 whether canonical ERC-8004 registries are deployed on Mantle; if not, deploy the references and document it.
- **Non-custodial execution** — the user's funds never leave their control. The mirror executes via a delegated executor with a scoped, revocable allowance into the user's own wallet or a personal vault they own. This is both a design principle and the answer to the regulatory-optics risk: Sequa never takes custody.

### 3.2 Mirror engine (off-chain orchestration)

Pipeline:

1. **Watch.** Listen for `SignalRecorded` from registered sources.
2. **Scale.** For each follower of that source, scale the trade to the follower's committed capital and risk cap.
3. **Execute.** Submit the scaled trade through the follower's scoped executor on the Mantle DEX route, non-custodially.
4. **Attribute.** Record the mirrored execution so the follower's results and the source's follower count and reputation update on-chain.

Keep the source strategies simple and deterministic enough that mirroring is faithful and explainable. The credibility of the whole product rests on "what the source did is exactly what happened in your wallet, and you can verify it."

### 3.3 Tech stack

- Contracts: Solidity, Foundry, deployed and verified on Mantle.
- Mirror engine: TypeScript service with a `SignalRecorded` listener, the scaling logic, and the executor calls.
- Frontend: Next.js (see `Sequa_prompt.md`), with dynamic share-card image generation for X.
- Source agents: a small set of autonomous trading agents (Claude-driven decision logic) trading the fixed Mantle pair set.

---

## 4. How this scores

- **Technical Depth (30%).** On-chain signal recording, a non-custodial mirror execution path, scaled replication, ERC-8004 identity and reputation. Real depth under a consumer skin; this is what separates Sequa from a pure UI toy and keeps it credible with the institutional panel.
- **Innovation (25%).** Copy-trading where the thing you copy is an autonomous on-chain agent with portable, verifiable reputation, not a human's claimed PnL. The screenshot-to-proof shift is the novel paradigm.
- **Mantle Ecosystem (25%).** Agents trade Mantle-native assets on Mantle venues; performance and reputation live on Mantle; the follow graph is a Mantle-native social primitive other apps can read.
- **Product Completeness (20%).** A polished, runnable consumer app with a real follow flow and a share loop. This is Sequa's strongest axis.

**Consumer & Viral / Community Voting:** the shareable performance card is the engine. It must be screenshot-perfect, because Community Voting happens on X and the card is what gets posted. Design the card as the product's logo-in-motion.

**Best UI/UX:** this is the most winnable side prize in the whole hackathon for this project. `Sequa_prompt.md` is written to take it.

---

## 5. The verifiability anchor (the thing that makes it not a toy)

The single most important credibility move: a source agent's track record cannot be faked because every signal and every result is on-chain. Build the demo around proving this. Show a source agent's card, then show that its claimed performance reconciles exactly to its on-chain signal history, with a "verified on Mantle" state a viewer can check. The viral surface is the hook; on-chain verifiability is why it deserves to win a track and not just a popularity vote.

---

## 6. Demo centerpiece: the one-tap follow loop

1. Open the leaderboard; a top agent's card stands out, marked verified-on-chain.
2. Open the agent: its strategy personality, recent moves, verified track record, follower count, ERC-8004 reputation.
3. One tap to mirror; set capital and a risk cap; confirm the non-custodial, revocable authorization.
4. The source fires a signal live; the follower wallet executes the same trade, scaled, in view.
5. Generate and share the performance card to X.

Steps 1, 3, and 5 are the on-camera moments that win Best UI/UX and Community Voting. Step 4 is the on-chain AI function that wins the deployment award.

---

## 7. Phase plan (9 days, split attention with Sui Overflow)

Front-load the deployment bar so the **20 Project Deployment Award** (first-come, first-served, only 20 spots) is locked early.

- **Phase 0 — Lock (Day 1, non-negotiable).** Confirm the Mantle trading venue, the fixed pair set, and whether ERC-8004 registries are live on Mantle. Deploy skeleton `SourceRegistry` and `FollowRegistry` to Mantle testnet, verify on Mantle Explorer, wire a trivial `recordSignal` to `mirror`. **At end of Day 1 you already meet the deployment-award technical bar.**
- **Phase 1 — Source + signals (Days 2–3, non-negotiable).** One or two source agents trading the fixed pair set, recording signals on-chain, with performance computed from on-chain history.
- **Phase 2 — Mirror execution (Day 4, non-negotiable).** Non-custodial scaled replication into a follower wallet via a scoped executor. This is the hardest technical piece; protect its time.
- **Phase 3 — ERC-8004 + reputation (Day 5, high value).** Mint identities, accrue source reputation from performance and follower count.
- **Phase 4 — Frontend + the card (Days 6–7, non-negotiable for Best UI/UX and Community Voting).** Build per `Sequa_prompt.md`. The leaderboard, the agent card, the one-tap mirror flow, and the share-to-X card must exist.
- **Phase 5 — Ship (Days 8–9, non-negotiable).** Record the 2-minute-plus demo video, write the README (setup, architecture, deployed addresses), push the open-source repo, complete the DoraHacks submission with the deployment address, and launch the Community Voting post on X.

If Sui Overflow consumes more than expected: Phases 0–2, 4, and 5 are the irreducible core. Phase 3 reputation can be shown as a designed, performance-backed view if the live accrual loop runs short.

---

## 8. Pre-planned scope cut lines (in order)

1. Drop multiple source agents; ship one strong, verifiable source.
2. Drop the live reputation accrual loop; present reputation as a view backed by on-chain performance.
3. Drop personal-vault execution; mirror into the user's wallet directly via scoped allowance.
4. Drop risk-cap configuration; mirror at a fixed scale.
5. Reduce the trading pair set to a single pair.

**Ship-core minimum:** one verifiable source agent, on-chain signals, a non-custodial mirror into a follower wallet, the leaderboard plus agent card plus one-tap follow plus shareable card. That is a complete, demoable, viral submission.

---

## 9. Submission checklist

DoraHacks main submission:
- [ ] Open-source GitHub repo with README (setup, architecture overview, deployed contract address)
- [ ] Runnable demo (publicly accessible frontend, not localhost)
- [ ] Project pitch
- [ ] Nominated to Consumer & Viral DApps

20 Project Deployment Award (clear all, first-come):
- [ ] Contracts deployed on Mantle Mainnet or Testnet
- [ ] Contracts verified on Mantle Explorer
- [ ] At least one AI-powered function callable on-chain (the `recordSignal` to `mirror` execution flow)
- [ ] Frontend demo publicly accessible
- [ ] Deployment address in the DoraHacks submission
- [ ] Demo video ≥ 2 minutes walking the core use case

Community Voting:
- [ ] A clear, compelling X post built around the shareable performance card
- [ ] A public demo link a non-technical viewer can try

Best UI/UX:
- [ ] Runnable frontend interface (per `Sequa_prompt.md`)
- [ ] Demo video or public link

---

## 10. Risks and mitigations

- **Copy-trading regulatory optics.** The compliance-aware judges (Hashed, Caladan) may probe this. Mitigation: non-custodial by design, scoped and revocable authorizations, full transparency, and framing as "follow a verifiable strategy," not "we manage your money."
- **Mirror fidelity.** If follower trades drift from the source, the whole premise breaks. Mitigation: constrained, deterministic source strategies and a fixed pair set; faithful replication over breadth.
- **Reads as shallow to the institutional panel.** Mitigation: lead every conversation with on-chain verifiability and portable reputation, not the visuals; the visuals win the side prizes, the verifiability wins the track.
- **Time loss to Sui Overflow.** Mitigation: the front-loaded deployment bar guarantees a worst-case finish still clears the 20 Project Deployment Award and a minimum viable, shareable submission.

---

## 11. Open items to resolve in Phase 0

1. Confirm the Mantle DEX venue and the fixed trading pair set for source agents.
2. Confirm whether canonical ERC-8004 Identity and Reputation registries are deployed on Mantle; if not, plan to deploy references.
3. Confirm the non-custodial executor pattern available on Mantle (scoped allowance or account-abstraction session keys) for safe scaled replication.
4. Confirm the per-track prize allocation if Mantle has published it, to validate Consumer & Viral plus the side-prize stack against the alternatives.
