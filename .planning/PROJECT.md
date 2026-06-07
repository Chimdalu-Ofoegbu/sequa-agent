# PROJECT: Sequa

> One-line pitch — Follow a proven AI trading agent in one tap. Sequa mirrors its moves to your wallet, you keep custody, and the agent's track record is on-chain and impossible to fake.

## Core value

Today copy-trading runs on screenshots and trust. Sequa replaces the screenshot with proof: every source-agent signal and every settled result is recorded on Mantle, so a "follow this agent" claim reconciles to verifiable on-chain history. The surface is a consumer app people want to share; the depth is portable ERC-8004 reputation that travels with the agent across the ecosystem.

## Developer-facing success metric

Submit a Mantle Turing Test Hackathon 2026 Phase 2 entry by 2026-06-15 that simultaneously:

1. Clears the 20 Project Deployment Award bar — contracts deployed AND verified on Mantle, at least one AI-callable on-chain function (the `recordSignal → mirror → execute` flow), publicly accessible frontend (not localhost), ≥2-minute demo video, deployment address in the DoraHacks submission.
2. Wins or places in the Consumer & Viral DApps track ($8,500).
3. Wins Best UI/UX ($3,000).
4. Produces enough X share-card engagement to win Community Voting (2 × $8,500).

## Target runtime

- **Frontend** — Next.js 14+ deployed on Vercel; existing Claude Design UI exported into Next.js and wired to contracts + mirror engine. Dynamic Open Graph image generation for the share card.
- **Smart contracts** — Solidity via Foundry; deployed to Mantle Mainnet and Mantle Sepolia; verified on Mantle Explorer.
- **Mirror engine** — TypeScript daemon (Node 20+) listening for `SignalRecorded` events on Mantle and dispatching scaled executions through `SequaExecutor.sol` on FusionX V3.

## Deadline

**2026-06-15** — 8 days from today (2026-06-07). Sui Overflow (2026-06-16) splits attention; non-negotiable phases (0, 1, 2, 4, 5) are protected.

## Judging panel (relevant)

Hashed, Caladan, Animoca Brands, Nansen, Z.ai, Four Pillars, Allora Network, BGA, DoraHacks, Elfa AI, Virtuals Protocol, Prof. Jack Poon (HKU).

Consumer & Viral DApps track sponsors: Animoca Brands + OpenCheck. Submission portal: https://dorahacks.io/hackathon/mantleturingtesthackathon2026

---

## Locked decisions

The following ADR-locked decisions are immutable. Any change requires a new ADR superseding the original.

<decisions>
### DEC-001 — Trading venue: FusionX V3
- source: `PHASE-0-RESEARCH.md` §1
- status: LOCKED
- scope: DEX selection for source agents and mirror execution on Mantle.
- decision: Use FusionX V3 (UniV3-style concentrated liquidity AMM) as the sole DEX venue for both source agent trading and mirror execution.
- rationale: Only Mantle DEX with both officially documented mainnet AND Sepolia testnet routers. Identical `ISwapRouter.exactInputSingle` interface to Uniswap V3 — zero adapter code for the mirror engine. Merchant Moe has more liquidity but no usable testnet and its V2.2 Liquidity Book router is non-standard.
- contract addresses:
  - SwapRouter mainnet: `0x5989FB161568b9F133eDf5Cf6787f5597762797F`
  - SwapRouter Sepolia: `0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36`
  - Factory mainnet: `0x530d2766D1988CC1c000C8b7d00334c14B69AD71`
  - Factory Sepolia: `0xf811BF0B2174135Ff1c8E615eB6B678caECa8d61`
  - QuoterV2 mainnet: `0x90f72244294E7c5028aFd6a96E18CC2c1E913995`
  - QuoterV2 Sepolia: `0xa4e57d8FD802cc6b1b01218dfF0046fA571241da`
</decisions>

<decisions>
### DEC-002 — Trading pair set: 3 USDC-quoted pairs
- source: `PHASE-0-RESEARCH.md` §2
- status: LOCKED
- scope: Pair set for source agents (and therefore mirror execution).
- decision: Three USDC-quoted pairs only — WMNT/USDC, mETH/USDC, WETH/USDC. All single-hop `exactInputSingle` calls.
- rationale: Shared USDC quote keeps copy-trade math in one stable unit. WMNT is the deepest native pair; mETH is the Mantle LST flagship tying to the Turing narrative; WETH is the canonical major price reference.
- addresses: WMNT mainnet `0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8`.
- chore: Half-day budget in Phase 1 to seed our own LP positions on FusionX testnet (Sepolia liquidity thin).
- testnet USDC: Use FusionX test USDC or a mock ERC20 (real Circle USDC is mainnet-only).
</decisions>

<decisions>
### DEC-003 — Non-custodial executor pattern: scoped ERC-20 allowance + SequaExecutor.sol
- source: `PHASE-0-RESEARCH.md` §3
- status: LOCKED
- scope: How follower wallets execute mirrored trades non-custodially.
- decision: `SequaExecutor.sol` — user calls `approve(executor, capPerToken)` on each tradeable token; executor calls the FusionX router on behalf of the user. Gating: per-user caps, whitelisted router check, slippage bounds, kill switch.
- rationale: Only pattern that works on Mantle today with zero infrastructure dependencies (no bundler, no Safe module factory uncertainty, no smart-wallet onboarding friction). Custody stays in user's EOA. Revocation = one `approve(executor, 0)` call.
- effort: 2–3 days. One executor contract + backend signer calling `executeTrade(follower, signal)` + React one-tap flow doing `approve()` on the three tokens.
- migration architecture: Wrap executor behind an `ITradeExecutor` interface so future `SessionKeyExecutor` (ERC-4337) or `SafeModuleExecutor` can plug in behind the same signal dispatch backend.
- risks: Backend signer key compromise drains up to the cap. Mitigations: per-token caps small in demo, kill switch on executor, circuit breaker.
- rejected alternatives:
  - ERC-4337 session keys (5–7 days, partial Mantle bundler coverage)
  - Personal vault per user (breaks one-tap with a deposit step)
  - Safe module (three-step onboarding kills the demo)
</decisions>

<decisions>
### DEC-004 — ERC-8004: use canonical Mantle deployments
- source: `PHASE-0-RESEARCH.md` §4
- status: LOCKED
- scope: Identity and reputation registries; do NOT redeploy references.
- decision: Use canonical Mantle ERC-8004 deployments (Mantle officially deployed 2026-02-16). Skip ValidationRegistry — not canonically deployed on Mantle; reputation-only flow is sufficient for the verifiability story.
- contract addresses:
  - IdentityRegistry mainnet: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - IdentityRegistry Sepolia: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
  - ReputationRegistry mainnet: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
  - ReputationRegistry Sepolia: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- integration plan:
  - `SourceRegistry.registerSource()` calls `IIdentityRegistry.register()`; stores returned `agentId`; gates source-side writes with `ownerOf(agentId) == msg.sender`.
  - `FollowRegistry` settles each mirrored trade by calling `giveFeedback(sourceAgentId, pnlBps, 4, "copy-trade", "settled", ...)`. `int128` handles negative P&L.
  - UI reads portable reputation via `getSummary()` for leaderboard and agent card.
- design gotchas (LOCKED into architecture):
  - **Self-feedback blocked.** Source agent's owner/operators cannot submit feedback on themselves. `FollowRegistry.giveFeedback` MUST be called from the follower's address (or a neutral settlement contract that is NOT an operator of the source).
  - **No global trust score.** `getSummary()` requires a `clientAddresses[]` allowlist. The UI either curates which followers count or computes its own weighting client-side — pick in Phase 3 planning.
  - **Wallet rotation needs EIP-712 (EOA) or ERC-1271 (contract).** For the demo, source agents = EOAs; followers don't need to be agents.
  - Gas on L2 is negligible (~80–120k register, ~60–90k feedback) — safe per-trade settlement.
</decisions>

<decisions>
### DEC-005 — ERC-8004 minimum integration surface
- source: `PHASE-0-RESEARCH.md` §4
- status: LOCKED
- scope: Solidity interfaces our contracts target.
- decision: Implement only the IdentityRegistry methods `register`, `getAgentWallet`, `ownerOf` and ReputationRegistry methods `giveFeedback`, `getSummary`. No ValidationRegistry surface in v1.
- interface surface:
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
</decisions>

<decisions>
### DEC-006 — Prize pool target and judging panel
- source: `PHASE-0-RESEARCH.md` §5
- status: LOCKED (factual; informs strategy)
- scope: Prize stack to design toward.
- decision: Target the Consumer & Viral DApps Track First Prize ($8,500), Best UI/UX ($3,000), Community Voting (2 × $8,500), and the 20 Project Deployment Award ($1,000). Pool is $100K Phase 2 plus ~$110K compute credits.
- consumer & viral sponsors: Animoca Brands + OpenCheck.
- judging panel (relevant): Hashed, Caladan, Animoca Brands, Nansen, Z.ai, Four Pillars, Allora Network, BGA, DoraHacks, Elfa AI, Virtuals Protocol, Prof. Jack Poon (HKU).
- key dates: Submission deadline 2026-06-15. Demo Day Jul 2–3, 2026. Winners Jul 10, 2026.
- deployment-award fine print: project doc bar (deployed + verified + ≥1 AI-callable on-chain function + frontend + ≥2-min demo) is consistent with public structure but MUST be confirmed directly on the DoraHacks portal before submission.
- submission URL: https://dorahacks.io/hackathon/mantleturingtesthackathon2026
</decisions>

---

## Constraints

Full constraint set lives in `.planning/intel/constraints.md`. Highlights enforced everywhere:

- **Aesthetic** — premium sports-card meets modern social-fintech leaderboard. HARD BAN on Inter / Roboto / Arial / system fonts. The performance card is always the largest, most considered object on its screen.
- **Performance-tier color system** — coherent ramp signaling standing; tier color is NEVER used alone (always paired with a label and the figure).
- **AI as characters** — agents have name, avatar, plain-language strategy personality; recent moves rendered as a readable timeline, not a raw trade log.
- **Accessibility** — plain-language layer everywhere; full keyboard navigation; responsive (phone-first for sharing); contrast ratios met.
- **Motion discipline** — one well-orchestrated page load with staggered reveals; signature follow-confirmation moment; live mirror designed to read on camera; every async action has loading/empty/error states.
- **Tech stack** — Next.js + Tailwind (core utilities only) + Open Graph image generation; Solidity + Foundry; TypeScript mirror engine on Node 20+.
- **FusionX router contract** — all mirror execution uses `ISwapRouter.exactInputSingle`; single-hop only; router whitelisted inside `SequaExecutor.sol`.

## Source intel

- `.planning/intel/SYNTHESIS.md` — synthesis summary and counts
- `.planning/intel/decisions.md` — 6 LOCKED ADR decisions (DEC-001…DEC-006)
- `.planning/intel/requirements.md` — 14 derived requirements
- `.planning/intel/constraints.md` — 13 SPEC constraints
- `.planning/intel/context.md` — running notes (positioning, runway, risks, scoring, definition of done)
- `.planning/INGEST-CONFLICTS.md` — 0 blockers, 0 warnings, 5 INFO (auto-resolved)
