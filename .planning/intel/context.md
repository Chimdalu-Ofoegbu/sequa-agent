# Context Intel

Running notes from supporting context across all three source documents. Not normative; informs `gsd-roadmapper`.

---

## Topic: Project positioning

> "Sequa is the Latin *sequi*, 'to follow,' and following is the whole product."
- source: `Sequa Project.md` §1

> "Today copy-trading runs on screenshots and trust; a stranger claims a return and you believe them or you don't. Sequa replaces the screenshot with proof."
- source: `Sequa Project.md` §1

> "The depth is verifiable reputation; the surface is a consumer app people actually want to share. That combination is exactly what wins Consumer & Viral, Community Voting, and Best UI/UX at once."
- source: `Sequa Project.md` §1

---

## Topic: Hackathon framing

- Mantle Turing Test Hackathon 2026, Phase 2 (AI Awakening).
- Primary track: Consumer & Viral DApps.
- Prize stack targeted: Consumer & Viral, Best UI/UX, Community Voting, 20 Project Deployment Award.
- Deadline: 2026-06-15 (per project doc and confirmed in research).
- Source attribution: `Sequa Project.md` header; `PHASE-0-RESEARCH.md` §5.

---

## Topic: Runway / attention split

- Original project-doc statement: "~9 days, shared with the Sui Overflow build (deadline June 16)" (`Sequa Project.md` §header).
- Phase 0 research statement (later, more accurate): "Runway: 8 days to deadline (2026-06-15), split attention with Sui Overflow (2026-06-16)" (`PHASE-0-RESEARCH.md` header).
- User-supplied correction (synthesis input): today is 2026-06-07 → 8 days, NOT 9. Phase plan compresses accordingly. See CONFLICTS report INFO bucket and REQ-phase-plan.

---

## Topic: Pre-existing assets

- User has the full UI already built in Claude Design (per user, factored into `PHASE-0-RESEARCH.md` and synthesis input).
- Implication for Phase 4: scope = wire existing UI to contracts + mirror engine + Open Graph share-card export, NOT greenfield design/build.
- This frees roughly half of Phase 4 (originally 2 days for design+build) for additional polish or buffer against Sui Overflow attention drift.

---

## Topic: Verifiability anchor

> "The single most important credibility move: a source agent's track record cannot be faked because every signal and every result is on-chain. Build the demo around proving this. Show a source agent's card, then show that its claimed performance reconciles exactly to its on-chain signal history, with a 'verified on Mantle' state a viewer can check. The viral surface is the hook; on-chain verifiability is why it deserves to win a track and not just a popularity vote."
- source: `Sequa Project.md` §5

---

## Topic: Demo centerpiece (one-tap follow loop)

The five-step on-camera flow that wins the prizes:
1. Open the leaderboard; a top agent's card stands out, marked verified-on-chain.
2. Open the agent: strategy personality, recent moves, verified track record, follower count, ERC-8004 reputation.
3. One tap to mirror; set capital and risk cap; confirm non-custodial revocable authorization.
4. Source fires a signal live; follower wallet executes the same trade, scaled, in view.
5. Generate and share the performance card to X.

> "Steps 1, 3, and 5 are the on-camera moments that win Best UI/UX and Community Voting. Step 4 is the on-chain AI function that wins the deployment award."
- source: `Sequa Project.md` §6

---

## Topic: Scoring weights (Best UI/UX)

From `Sequa UI-UX Prompt.md` §"Design to the two prizes":
- Visual Design (30%) — distinctive committed aesthetic; performance card is hero.
- Interaction & Flow (30%) — one-tap follow is make-or-break.
- AI Interaction Design (25%) — each agent reads as a character.
- Accessibility (15%) — newcomer understands custody + mirror in one screen, no jargon wall.

---

## Topic: Scoring weights (Mantle main track)

From `Sequa Project.md` §4:
- Technical Depth (30%) — on-chain signals, non-custodial mirror, scaled replication, ERC-8004 identity + reputation.
- Innovation (25%) — copy-trading where the copied thing is an autonomous on-chain agent with portable verifiable reputation.
- Mantle Ecosystem (25%) — Mantle-native assets, venues, reputation, follow graph.
- Product Completeness (20%) — polished runnable consumer app with real follow flow and share loop.

---

## Topic: Risks (institutional optics)

> "Copy-trading regulatory optics. The compliance-aware judges (Hashed, Caladan) may probe this. Mitigation: non-custodial by design, scoped and revocable authorizations, full transparency, and framing as 'follow a verifiable strategy,' not 'we manage your money.'"
- source: `Sequa Project.md` §10

> "Reads as shallow to the institutional panel. Mitigation: lead every conversation with on-chain verifiability and portable reputation, not the visuals; the visuals win the side prizes, the verifiability wins the track."
- source: `Sequa Project.md` §10

---

## Topic: Risks (mirror fidelity)

> "If follower trades drift from the source, the whole premise breaks. Mitigation: constrained, deterministic source strategies and a fixed pair set; faithful replication over breadth."
- source: `Sequa Project.md` §10

---

## Topic: Risks (time loss to Sui Overflow)

> "The front-loaded deployment bar guarantees a worst-case finish still clears the 20 Project Deployment Award and a minimum viable, shareable submission."
- source: `Sequa Project.md` §10

User-supplied addendum: Sui Overflow deadline is 2026-06-16, one day after Sequa. Treat non-negotiable phases (0, 1, 2, 4, 5) as protected.

---

## Topic: Definition of done (newcomer journey)

> "A newcomer lands on the leaderboard, immediately sees which AI agents are worth following and that their records are verified on-chain, opens one, understands its style and its proof in plain language, follows it in one effortless tap while clearly keeping custody, watches it mirror a trade into their own wallet, and shares a performance card so good they want to post it. It should feel like a consumer product a real company shipped, not a hackathon entry."
- source: `Sequa UI-UX Prompt.md` §"Definition of done"

---

## Topic: External sources cited in research

- FusionX V3 contracts (mainnet + testnet), DefiLlama Mantle.
- EIP-8004 specification, reference contracts, Mantle deployment announcement (2026-02-16).
- ERC-4337 session keys reference, Safe on Mantle, Permit2 (Matcha) — rejected/migration-path references.
- Mantle Turing Test Hackathon 2026 DoraHacks portal, Mantle DevHub, Chainwire press release.
- Submission URL: https://dorahacks.io/hackathon/mantleturingtesthackathon2026
- Source: `PHASE-0-RESEARCH.md` §"Sources"
