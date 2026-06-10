# Sequa — Phase 0 Locked Decisions

**Status:** LOCKED — decisions made 2026-06-07. Companion to `Sequa Project.md` (architecture) and `Sequa UI-UX Prompt.md` (frontend spec).

**Runway:** 8 days to deadline (2026-06-15), split attention with Sui Overflow (2026-06-16). Decisions front-load the deployment award and minimize unknown-unknown research time during execution phases.

**Existing assets to factor into the plan:**
- Full UI build already exists in Claude Design (per user). Phase 4 (Frontend + Card) is **wire-up + export**, not greenfield design/build. Adjust phase plan accordingly.

---

## 1. Trading venue — LOCKED: FusionX V3

**Pick:** [FusionX V3](https://docs.fusionx.finance/) (UniV3-style concentrated liquidity AMM on Mantle).

**Why:** Only Mantle DEX with **both** an officially documented mainnet AND Sepolia testnet router. Identical `ISwapRouter.exactInputSingle` interface to Uniswap V3 — zero adapter code for the mirror engine. Merchant Moe has more liquidity but no usable testnet; its V2.2 Liquidity Book router is non-standard and would burn dev time.

**Contracts:**

| | Mainnet | Sepolia Testnet |
|---|---|---|
| SwapRouter | `0x5989FB161568b9F133eDf5Cf6787f5597762797F` | `0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36` |
| Factory | `0x530d2766D1988CC1c000C8b7d00334c14B69AD71` | `0xf811BF0B2174135Ff1c8E615eB6B678caECa8d61` |
| QuoterV2 | `0x90f72244294E7c5028aFd6a96E18CC2c1E913995` | `0xa4e57d8FD802cc6b1b01218dfF0046fA571241da` |

## 2. Trading pair set — LOCKED: 3 USDC-quoted pairs

- **WMNT/USDC** — deepest native pair, base for agent trades
- **mETH/USDC** — Mantle's flagship LST, ties to the Turing narrative
- **WETH/USDC** — canonical major, easy price reference

All single-hop `exactInputSingle` calls with shared USDC quote — copy-trade math stays in one stable unit.

**WMNT (mainnet):** `0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8`

**Pre-execution chore for the executor sprint:** seed our own LP positions on FusionX testnet for the three pairs (Sepolia liquidity is thin). Budget half a day for this in Phase 1 setup.

**Non-decision:** USDC on testnet — use FusionX's test USDC or a mock ERC20; real Circle USDC is mainnet-only.

## 3. Non-custodial executor pattern — LOCKED: Scoped ERC-20 allowance + delegated executor contract

**Pick:** `SequaExecutor.sol` — user calls `approve(executor, capPerToken)` on each tradeable token; executor calls the FusionX router on behalf of the user, gated by per-user caps, whitelisted router check, slippage bounds, and a kill switch.

**Why:** Only option that works on Mantle today with zero infrastructure dependencies (no bundler, no Safe module factory uncertainty, no smart-wallet onboarding friction). Same trust model Uniswap users already understand. Custody stays in the user's EOA. Revocation = one `approve(executor, 0)` call — clean non-custodial story for both demo and institutional judges.

**Effort:** 2–3 days. One executor contract + a backend signer that calls `executeTrade(follower, signal)` + the React one-tap flow doing `approve()` on the three tokens.

**Architect for migration:** Wrap executor behind a `ITradeExecutor` interface so a future `SessionKeyExecutor` (ERC-4337) or `SafeModuleExecutor` can plug in behind the same signal dispatch backend.

**Risk + mitigation:** Backend signer key compromise = drain up to the cap. Mitigate with per-token caps (small in the demo), a kill switch on the executor, and a circuit breaker. Standard DeFi risk that judges will accept and the project doc already accepts in §10.

**Runner-ups rejected for the demo (kept for v2):**
- ERC-4337 session keys — best long-term, but 5–7 days and Mantle bundler coverage is partial.
- Personal vault per user — clean custody, but breaks "one tap" with a deposit step.
- Safe module — requires followers to own a Safe + `enableModule` + fund. Three-step onboarding kills the demo narrative.

## 4. ERC-8004 — LOCKED: Use canonical Mantle deployments

**Status:** EIP-8004 ("Trustless Agents") is Draft Standards Track but has live reference implementations. Mantle officially deployed canonical registries on 2026-02-16.

**Mantle addresses:**

| | Mainnet | Sepolia Testnet |
|---|---|---|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

**ValidationRegistry:** NOT canonically deployed on Mantle. **Skip for the demo** — reputation-only flow is sufficient for the verifiability story.

**Minimum integration surface:**

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

**Integration plan:**
- `SourceRegistry.registerSource()` calls `IIdentityRegistry.register()`; store returned `agentId`; gate source-side writes with `ownerOf(agentId) == msg.sender`.
- `FollowRegistry` settles each mirrored trade by calling `giveFeedback(sourceAgentId, pnlBps, 4, "copy-trade", "settled", ...)`. `int128` handles negative P&L.
- UI reads portable reputation via `getSummary()` for the leaderboard and agent card.

**Gotchas locked into design:**
- **Self-feedback blocked.** The source agent's owner/operators cannot submit feedback on themselves. `FollowRegistry.giveFeedback` must be called from the **follower's** address (or a neutral settlement contract that is *not* an operator of the source). Architect the settlement path accordingly.
- **No global trust score.** `getSummary()` requires a `clientAddresses[]` allowlist. The UI either (a) curates which followers count, or (b) computes its own weighting client-side. Pick this in Phase 3 planning.
- **Wallet rotation needs EIP-712 (EOA) or ERC-1271 (contract).** Any contract that ever needs to be `setAgentWallet`'d must implement ERC-1271. For the demo, source agents = EOAs; followers don't need to be agents.
- **Gas on L2 is negligible** (~80–120k for register, ~60–90k for feedback) — safe to call per trade settlement.

## 5. Prizes — confirmed pool and panel

**Pool ($100K Phase 2):**

| Bucket | Amount |
|---|---|
| Grand Champion | $9,000 |
| Track First Prize (6 × $8,500) — incl. Consumer & Viral DApps | $51,000 |
| Community Voting (2 × $8,500) | $17,000 |
| Best UI/UX | $3,000 |
| Finalist & Deployment Award (20 × $1,000) | $20,000 |

Plus ~$110K in compute credits on top (Nansen, Elfa AI, Surf AI, Orbit AI, AltLLM).

**Consumer & Viral DApps track sponsors:** Animoca Brands + OpenCheck.

**Judging panel (relevant):** Hashed, Caladan, Animoca Brands, Nansen, Z.ai, Four Pillars, Allora Network, BGA, DoraHacks, Elfa AI, Virtuals Protocol, Prof. Jack Poon (HKU). Both institutional judges flagged in the project doc (Hashed, Caladan) confirmed.

**Dates:** Submission deadline 2026-06-15. Demo Day Jul 2–3, 2026. Winners Jul 10, 2026.

**Deployment-award fine print:** Not exposed on public sources (DoraHacks blocks WebFetch). The project doc's bar (deployed + verified + ≥1 AI-callable on-chain function + frontend + ≥2-min demo) is consistent with the public structure but **must be confirmed on the DoraHacks portal directly** before submission. Add to the submission checklist.

**Submission URL:** https://dorahacks.io/hackathon/mantleturingtesthackathon2026

---

## Sources

- [FusionX V3 mainnet contracts](https://docs.fusionx.finance/developers/smart-contracts-mantle-mainnet/v3-smart-contracts) · [FusionX V3 testnet contracts](https://docs.fusionx.finance/developers/smart-contracts-mantle-testnet/v3-smart-contracts) · [DefiLlama Mantle](https://defillama.com/chain/Mantle)
- [EIP-8004 Specification](https://eips.ethereum.org/EIPS/eip-8004) · [erc-8004 reference contracts](https://github.com/erc-8004/erc-8004-contracts) · [Mantle ERC-8004 deployment announcement](https://chainwire.org/2026/02/16/mantle-unlocks-autonomous-economy-with-erc-8004-deployment/)
- [ERC-4337 session keys reference](https://docs.erc4337.io/smart-accounts/session-keys-and-delegation.html) · [Safe on Mantle](https://docs.safe.global/core-api/transaction-service-reference/mantle) · [Permit2 (Matcha)](https://blog.matcha.xyz/article/permit2)
- [Mantle Turing Test Hackathon 2026 — DoraHacks](https://dorahacks.io/hackathon/mantleturingtesthackathon2026) · [Mantle DevHub](https://devhub.mantle.xyz/) · [Chainwire press release](https://chainwire.org/2026/04/23/mantle-launches-turing-test-hackathon-2026-backed-by-tencent-cloud-bybit-byreal-and-bga/)
