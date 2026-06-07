# Constraints (SPEC Intel)

Synthesized from `Sequa UI-UX Prompt.md` (SPEC, precedence 1). These are non-negotiable UI/UX, accessibility, and frontend tech constraints. Where a SPEC item could conflict with an ADR (none currently do), the ADR wins.

---

## CON-aesthetic — Collectible trading-card arena aesthetic
- source: `Sequa UI-UX Prompt.md` §"Aesthetic direction"
- type: nfr (visual identity)
- content: Premium sports-card meets modern social-fintech leaderboard. Agents are players, cards are collectible and alive, leaderboard is a standings board with stakes. Confident, energetic, competitive — refined, not loud crypto-casino. Opposite of an austere data dashboard.
- commit choices:
  - Theme: deep, rich base (near-black ink OR deep saturated jewel tone) with one or two vivid accents; OR a bold editorial light theme — pick one and execute completely.
  - Typography: distinctive characterful display face for agent names, grades, headline numbers paired with a precise mono for tickers, returns, addresses, metrics. **HARD BAN: Inter, Roboto, Arial, system fonts.**
  - Layout: card is always the largest, most considered object on any screen it appears in. Strong vertical rhythm on leaderboard; generous focus on agent profile.
  - Texture and depth: real material quality on the card — foil-like accents, subtle depth, tactile collectible feel. Restraint elsewhere so the card carries the drama.

---

## CON-design-tokens — CSS variable token system
- source: `Sequa UI-UX Prompt.md` §"Design tokens"
- type: nfr (consistency)
- content: All design tokens defined as CSS variables:
  - Neutral ink ramp for chosen theme.
  - One or two vivid accents with tints.
  - Performance-tier color system (see CON-tier-color).
  - Type scale: display / heading / body / mono / caption.
  - 8px-based spacing scale.
  - Two radii.
  - Layered shadow and glow levels for the card.
- rationale: Consistency across the app is itself a Visual Design score.

---

## CON-tier-color — Performance-tier color system
- source: `Sequa UI-UX Prompt.md` §"Performance-tier color system"
- type: nfr (visual language)
- content: Coherent ramp signaling agent standing without reading numbers:
  - Elite / top performers: confident, premium family (gold or luminous accent) signaling "follow this one."
  - Strong / mid: calm, positive family.
  - Underperforming / new: muted neutral family, never punitive.
- rule: Tiers appear consistently on card, leaderboard row, and agent profile via ONE reused component.
- accessibility hard rule: NEVER rely on color alone. Always pair with a label and the figure.

---

## CON-core-screens — Five mandatory screens
- source: `Sequa UI-UX Prompt.md` §"Core screens"
- type: nfr (scope completeness)
- content: These screens MUST exist:
  1. Leaderboard (discovery/home) — see REQ-leaderboard.
  2. Agent profile + performance card (hero) — see REQ-agent-profile-and-card.
  3. One-tap mirror flow — see REQ-one-tap-mirror-flow.
  4. Your follows (portfolio) — see REQ-your-follows.
  5. The share moment — see REQ-share-moment.

---

## CON-ai-interaction — Agents-as-characters interaction model
- source: `Sequa UI-UX Prompt.md` §"AI Interaction Design requirements (25%)"
- type: nfr (Best UI/UX scoring axis)
- content:
  - Agents are characters, not rows. Each source agent has a name, avatar, and legible strategy personality in plain language (e.g., "patient, trades majors, cuts losses fast").
  - Recent moves rendered as a story (readable timeline with what + why), not a raw trade log.
  - Verified-on-chain badge is a FIRST-CLASS UI ELEMENT — present wherever performance is claimed, with a way to see the claim reconciles to on-chain history.
  - Reputation shown as a portable credential the agent carries, not a number buried in a profile.

---

## CON-accessibility — Newcomer-comprehensible UX
- source: `Sequa UI-UX Prompt.md` §"Accessibility requirements (15%)"
- type: nfr (Best UI/UX scoring axis)
- content:
  - Plain-language layer everywhere: follow promise, custody, risk each stated in one human sentence; no jargon wall.
  - Define terms inline on first use (mirror, non-custodial, risk cap, ERC-8004) via accessible tooltips or glossary affordance.
  - Full keyboard navigation, visible focus states, semantic HTML, real contrast ratios on dark theme.
  - Never tier-color alone for standing (see CON-tier-color).
  - Fully responsive; card and follow flow must be flawless on phone (where sharing and live demo happen).

---

## CON-motion — Motion and interaction discipline
- source: `Sequa UI-UX Prompt.md` §"Motion and interaction"
- type: nfr (Best UI/UX scoring axis)
- content:
  - ONE well-orchestrated page load with staggered reveals on the leaderboard beats scattered micro-animations.
  - Performance card feels alive on agent profile: subtle foil/light shift; numbers count up once on reveal.
  - Follow confirmation is a signature moment — tap, authorization, agent joining your follows feels like a win.
  - Live mirror is the demo's spine: source signal + follower execution side by side, designed to read clearly on camera.
  - Every async action has intentional loading, empty, AND error states.

---

## CON-demo-moments — Five on-camera demo beats
- source: `Sequa UI-UX Prompt.md` §"On-camera demo moments"
- type: nfr (demo design)
- content: These five moments must look great in the 2-minute video and as X media:
  1. Leaderboard resolving into its standings.
  2. Collectible performance card on the agent profile, foil and all.
  3. The one-tap follow and its satisfying confirmation.
  4. The live mirror: source signal, follower execution, side by side.
  5. The share-to-X moment with the finished card.

---

## CON-frontend-tech — Frontend tech stack
- source: `Sequa UI-UX Prompt.md` §"Tech constraints" + `Sequa Project.md` §3.3
- type: protocol (tech stack)
- content:
  - **Next.js** — the existing project stack.
  - **Dynamic share-card image generation** via Open Graph image generation route, so the card renders correctly as X media.
  - For any React artifact context: use only Tailwind core utilities and available libraries; keep state in React state, never browser storage.
  - Load custom fonts properly so distinctive typography actually renders for judges and in shared images.

---

## CON-anti-patterns — Hard anti-patterns (do not ship)
- source: `Sequa UI-UX Prompt.md` §"Hard anti-patterns"
- type: nfr (negative constraints)
- content:
  - Generic AI-dashboard aesthetic: Inter or system fonts, purple-to-blue gradients on white, timid evenly-distributed color, predictable card grids.
  - A performance claim with no verified-on-chain badge or no way to check it.
  - Tier-color signaling with no label.
  - A follow flow that hides custody or risk, or reads as a dense form.
  - A share card that looks like a screenshot of a dashboard rather than a designed, collectible object.
  - Crypto-casino loudness; this is premium and competitive, not garish.

---

## CON-smart-contract-stack — Solidity + Foundry + verified on Mantle
- source: `Sequa Project.md` §3.3
- type: protocol (tech stack)
- content: Contracts in Solidity using Foundry; deployed AND verified on Mantle (mainnet or testnet). Verification on Mantle Explorer is a hard gate for the Deployment Award.

---

## CON-mirror-engine-stack — TypeScript service
- source: `Sequa Project.md` §3.3
- type: protocol (tech stack)
- content: Mirror engine is a TypeScript service with a `SignalRecorded` listener, scaling logic, and the executor calls. Watches `SignalRecorded` events emitted by `SourceRegistry`.

---

## CON-erc8004-interfaces — Minimum Solidity interface surface
- source: `PHASE-0-RESEARCH.md` §4 (referenced; full text in DEC-005)
- type: api-contract
- content:
  ```solidity
  interface IIdentityRegistry {
      function register(string calldata agentURI) external returns (uint256 agentId);
      function getAgentWallet(uint256 agentId) external view returns (address);
      function ownerOf(uint256 tokenId) external view returns (address);
  }

  interface IReputationRegistry {
      function giveFeedback(
          uint256 agentId, int128 value, uint8 valueDecimals,
          string calldata tag1, string calldata tag2,
          string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash
      ) external;
      function getSummary(
          uint256 agentId, address[] calldata clientAddresses,
          string calldata tag1, string calldata tag2
      ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);
  }
  ```

---

## CON-fusionx-router — Single-hop swap interface
- source: `PHASE-0-RESEARCH.md` §1, §2
- type: api-contract
- content: All mirror execution uses FusionX V3 `ISwapRouter.exactInputSingle` (identical to Uniswap V3 surface). Single-hop only — no multi-hop routing. Router whitelisted inside `SequaExecutor.sol`.
