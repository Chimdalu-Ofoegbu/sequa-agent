# Decisions (ADR Intel)

Synthesized from Phase 0 LOCKED decisions. Precedence: 0 (highest). All decisions in this file override any contradicting PRD/SPEC content per the precedence rules.

---

## DEC-001 — Trading venue: FusionX V3 (Sepolia venue AMENDED 2026-06-10, Phase 1)
- source: `PHASE-0-RESEARCH.md` §1
- status: LOCKED (mainnet); **AMENDED for Sepolia testnet — see amendment below**
- scope: DEX selection for source agents and mirror execution on Mantle
- decision: Use FusionX V3 (UniV3-style concentrated liquidity AMM) as the sole DEX venue for both source agent trading and mirror execution.
- rationale: Only Mantle DEX with both officially documented mainnet AND Sepolia testnet routers. Identical `ISwapRouter.exactInputSingle` interface to Uniswap V3 — zero adapter code for the mirror engine. Merchant Moe has more liquidity but no usable testnet and its V2.2 Liquidity Book router is non-standard.
- contract addresses:
  - SwapRouter mainnet: `0x5989FB161568b9F133eDf5Cf6787f5597762797F`
  - ~~SwapRouter Sepolia: `0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36`~~ **DEAD — see amendment**
  - Factory mainnet: `0x530d2766D1988CC1c000C8b7d00334c14B69AD71`
  - ~~Factory Sepolia: `0xf811BF0B2174135Ff1c8E615eB6B678caECa8d61`~~ **DEAD — see amendment**
  - QuoterV2 mainnet: `0x90f72244294E7c5028aFd6a96E18CC2c1E913995`
  - ~~QuoterV2 Sepolia: `0xa4e57d8FD802cc6b1b01218dfF0046fA571241da`~~ **DEAD — see amendment**

### AMENDMENT (2026-06-10, Phase 1 — Sepolia venue)
- **Finding (VERIFIED):** FusionX V3 is **not deployed on Mantle Sepolia (chain 5003)**. The three Sepolia addresses above all return `codesize 0` (confirmed via `cast codesize` on `rpc.sepolia.mantle.xyz`; controls Multicall3=3808 and ERC-8004 IdentityRegistry=130 confirm the RPC/chain are correct). The docs these addresses came from target the deprecated old Mantle Testnet (chain 5001, RPC now 404s). Phase 0's e2e test used `0xDEAD`/`0xBEEF` placeholder tokens and never called FusionX, so the gap went undetected. Additionally, FusionX **mainnet** does not enable the `fee=3000` tier (enabled: 100/500/2500/10000).
- **Resolution (user-approved, Phase 1 plan-phase):** Self-deploy a **canonical Uniswap V3 fork** (factory + NonfungiblePositionManager + SwapRouter + QuoterV2) to Mantle Sepolia as a Wave-0 chore, alongside the 4 mock ERC-20s. The `ISwapRouter.exactInputSingle` / `IQuoterV2` surface is identical to FusionX → **zero adapter code**, mirror engine unaffected (CON-fusionx-router interface contract intact). A canonical UniV3 factory enables `fee=3000` by default (tickSpacing 60), so **D-19's 0.30% / fee=3000 is preserved**.
- **Address handling:** the dead Sepolia addresses above MUST NOT be used. Venue addresses become a **deploy-time output** written back into `SequaConstants.sol` / `addresses.json` by the self-deploy script — not hard-coded constants copied from stale docs.
- **Mainnet path unchanged:** the mainnet FusionX V3 addresses remain valid for any future Phase 5 mainnet move; this amendment is Sepolia-only.

---

## DEC-002 — Trading pair set: 3 USDC-quoted pairs
- source: `PHASE-0-RESEARCH.md` §2
- status: LOCKED
- scope: Pair set for source agents (and therefore mirror execution)
- decision: Three USDC-quoted pairs only — WMNT/USDC, mETH/USDC, WETH/USDC. All single-hop `exactInputSingle` calls.
- rationale: Shared USDC quote keeps copy-trade math in one stable unit. WMNT is the deepest native pair; mETH is the Mantle LST flagship tying to the Turing narrative; WETH is the canonical major price reference.
- addresses: WMNT mainnet `0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8`
- chore: Half-day budget in Phase 1 to seed our own LP positions on FusionX testnet (Sepolia liquidity thin).
- testnet USDC: Use FusionX test USDC or a mock ERC20 (real Circle USDC is mainnet-only).

---

## DEC-003 — Non-custodial executor pattern: scoped ERC-20 allowance + SequaExecutor.sol
- source: `PHASE-0-RESEARCH.md` §3
- status: LOCKED
- scope: How follower wallets execute mirrored trades non-custodially
- decision: `SequaExecutor.sol` — user calls `approve(executor, capPerToken)` on each tradeable token; executor calls the FusionX router on behalf of the user. Gating: per-user caps, whitelisted router check, slippage bounds, kill switch.
- rationale: Only pattern that works on Mantle today with zero infrastructure dependencies (no bundler, no Safe module factory uncertainty, no smart-wallet onboarding friction). Custody stays in user's EOA. Revocation = one `approve(executor, 0)` call.
- effort: 2–3 days. One executor contract + backend signer calling `executeTrade(follower, signal)` + React one-tap flow doing `approve()` on the three tokens.
- migration architecture: Wrap executor behind an `ITradeExecutor` interface so future `SessionKeyExecutor` (ERC-4337) or `SafeModuleExecutor` can plug in behind the same signal dispatch backend.
- risks: Backend signer key compromise drains up to the cap. Mitigations: per-token caps small in demo, kill switch on executor, circuit breaker.
- rejected alternatives:
  - ERC-4337 session keys (5–7 days, partial Mantle bundler coverage)
  - Personal vault per user (breaks one-tap with a deposit step)
  - Safe module (three-step onboarding kills the demo)

---

## DEC-004 — ERC-8004: use canonical Mantle deployments
- source: `PHASE-0-RESEARCH.md` §4
- status: LOCKED
- scope: Identity and reputation registries; do NOT redeploy references
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

---

## DEC-005 — ERC-8004 minimum integration surface
- source: `PHASE-0-RESEARCH.md` §4
- status: LOCKED
- scope: Solidity interfaces our contracts target
- decision: Implement only the IdentityRegistry methods `register`, `getAgentWallet`, `ownerOf` and ReputationRegistry methods `giveFeedback`, `getSummary`. No ValidationRegistry surface in v1.

---

## DEC-006 — Prize pool target and judging panel
- source: `PHASE-0-RESEARCH.md` §5
- status: LOCKED (factual; informs strategy)
- scope: Prize stack to design toward
- decision: Target the Consumer & Viral DApps Track First Prize ($8,500), Best UI/UX ($3,000), Community Voting (2 × $8,500), and the 20 Project Deployment Award ($1,000). Pool is $100K Phase 2 plus ~$110K compute credits.
- consumer & viral sponsors: Animoca Brands + OpenCheck.
- judging panel (relevant): Hashed, Caladan, Animoca Brands, Nansen, Z.ai, Four Pillars, Allora Network, BGA, DoraHacks, Elfa AI, Virtuals Protocol, Prof. Jack Poon (HKU).
- key dates: Submission deadline 2026-06-15. Demo Day Jul 2–3, 2026. Winners Jul 10, 2026.
- deployment-award fine print: project doc bar (deployed + verified + ≥1 AI-callable on-chain function + frontend + ≥2-min demo) is consistent with public structure but MUST be confirmed directly on the DoraHacks portal before submission.
- submission URL: https://dorahacks.io/hackathon/mantleturingtesthackathon2026
