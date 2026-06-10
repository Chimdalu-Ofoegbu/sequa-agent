# Phase 1: Source + signals - Research

**Researched:** 2026-06-10
**Domain:** On-chain integration mechanics (FusionX V3 / Uniswap-V3-fork DEX on Mantle Sepolia, ERC-8004 IdentityRegistry, swap+record ordering, event reconciliation) + a single-shot Claude narration call (framework already locked in 01-AI-SPEC.md).
**Confidence:** HIGH on everything verified against live chain state via `cast`; the **one MEDIUM/LOW item is a blocker-class finding** (FusionX V3 is NOT deployed on Mantle Sepolia chain 5003 — see Pitfall 1 and Open Question 1).

## Summary

Phase 1 builds one verifiable Claude-narrated momentum source agent that records every trade on-chain via `SourceRegistry.recordSignal` and reconciles 1:1 to settled FusionX V3 swaps. The framework decision (`@anthropic-ai/sdk` direct client, `claude-haiku-4-5`) is **locked** in 01-AI-SPEC.md and is NOT re-litigated here — this research covers only the unfamiliar on-chain mechanics and the validation architecture. Versions verified live: `@anthropic-ai/sdk@0.104.1` (latest), `viem@2.52.2`, `ethers@6.16.0`, `forge 1.5.1`, `node v24.15.0`.

I verified every on-chain claim directly against Mantle Sepolia (chain 5003) and Mantle mainnet (chain 5000) with `cast`, rather than trusting the docs or training data. Two findings are decision-grade:

1. **The ERC-8004 IdentityRegistry is real and the locked interface is correct.** `0x8004A818BFB912233c491871b3d84c89A494BD9e` on Sepolia is a live ERC-1967 UUPS proxy (impl `0x7274e874ca62410a93bd8bf61c69d8045e399c02`), an ERC-721 named `AgentIdentity` (`AGENT`). I simulated `register("ipfs://test")` from the operator EOA and it returned `137` (the next agentId) — confirming `register(string agentURI) returns (uint256)` exactly as pinned in `IIdentityRegistry.sol`. `tokenURI(1)` returns a JSON string, validating the D-28 static-JSON `agentURI` plan. `getAgentWallet(1)` and `ownerOf(1)` both work. **This part of the phase is low-risk.** [VERIFIED: cast call against 0x8004A818… on chain 5003]

2. **BLOCKER: FusionX V3 is NOT deployed on Mantle Sepolia (chain 5003).** Every FusionX V3 address pinned in `SequaConstants.sol` / PHASE-0-RESEARCH (SwapRouter `0x8fC0…`, Factory `0xf811…`, QuoterV2 `0xa4e5…`, NPM `0x9470…`, PoolDeployer, Masterchef) returns **zero code** on chain 5003, while Multicall3 (`0xcA11…`, codesize 3808) confirms the RPC and chain are correct and the Phase-0 SourceRegistry (`0x97a7…`, codesize 2336) confirms the deployment surface. The FusionX docs page these came from targets the **deprecated old Mantle Testnet (chain 5001)**, whose RPC (`rpc.testnet.mantle.xyz`) now 404s. Phase 0 never caught this because its e2e test used `0xDEAD`/`0xBEEF` placeholder tokens and **never actually called FusionX**. Additionally, on FusionX **mainnet** (where V3 IS live) the locked **fee=3000 tier does not exist** — enabled tiers are 100/500/2500/10000; closest to D-19's intended 0.30% is **2500 (0.25%)**. [VERIFIED: cast codesize + feeAmountTickSpacing against chains 5003 and 5000]

**Primary recommendation:** Resolve Open Question 1 (FusionX-on-Sepolia availability) FIRST as a Wave 0 spike, before any LP-seed or swap planning. If FusionX V3 is genuinely absent from Sepolia, the cleanest fix that preserves 95% of the locked design is to **deploy our own minimal Uniswap-V3-fork periphery (or use a maintained UniV3 deployment) on Sepolia** alongside the 4 mock tokens, OR invoke scope-cut #5 differently and **run the whole demo on a self-deployed UniV3 factory+router+NPM+quoter set**. The agent runtime, signal tuple, reconciler, ERC-8004 mint, and SourceRegistry redeploy are all unaffected — only the "venue addresses" and the fee-tier constant change. Treat `fee=2500` (or whatever the deployed factory enables) as the new uniform tier, and decouple `SequaConstants.sol` from hard-coded FusionX addresses so the venue is a deploy-time input.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mock ERC-20s (4) + public `mint` | On-chain / Foundry | — | Tokens must exist on Sepolia for pools + swaps (D-17/D-18) |
| Pool creation + full-range LP seed | On-chain / Foundry script | — | UniV3 pool init + NPM.mint is a deploy-time chore, not runtime (D-19/D-21) |
| `SourceRegistry` redeploy (+`invalidateSignal`,`signalAt`,typed event) | On-chain / Solidity | — | Verifiable on-chain track-record surface (D-31/D-33) |
| ERC-8004 identity mint | On-chain (canonical registry) | TS one-shot script | Mint once; store agentId for runtime (D-27) |
| Deterministic MA-crossover decision | TS runtime (pure core) | — | Off the LLM hot path; replay-testable (D-01/D-02) |
| Price polling (QuoterV2) | TS runtime | — | 30s poll feeds the MA windows (D-03/D-04) |
| `recordSignal` → `exactInputSingle` | TS runtime (operator EOA) | On-chain | The real trade path; 2-tx flow from one EOA (D-25/D-29) |
| Per-signal thesis (Claude) | TS runtime, OFF hot path | Anthropic API | Commentary only; never blocks the trade (D-01/D-09, AI-SPEC §4) |
| Thesis storage | TS runtime → GitHub repo JSON | CDN read (Phase 4) | Off-chain, keyed `(agentId,signalId)` (D-09/D-37) |
| Reconciliation `{matched,invalidated,orphan}` | TS CLI (`scripts/reconcile.ts`) | — | Phase 1 acceptance gate; walks events vs swaps (D-40) |
| Ambient noise bot | TS script (separate EOA) | On-chain | Keeps MAs crossing; not part of the track record (D-24) |
| Hosting + `/healthz` + uptime ping | VPS/Railway/Fly | UptimeRobot | Always-on for multi-day track record (D-35/D-38) |

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> 42 locked decisions D-01..D-42. These are NOT alternatives to research — they are the scope. Copied here verbatim by reference; the planner MUST honor every one.

### Locked Decisions

**Strategy + Claude integration**
- **D-01:** Deterministic rule decides trades; Claude narrates per-signal (1–2 sentence thesis). LLM nondeterminism stays OFF the mirror hot path.
- **D-02:** Rule = momentum/breakout. Short MA crossing longer MA triggers a position; flip out on the opposite cross. Prices from FusionX V3 QuoterV2.
- **D-03:** MA windows = short 5 ticks / long 20 ticks at 30s poll (short ≈ 2.5 min, long ≈ 10 min).
- **D-04:** Trigger = time-based polling every 30s.
- **D-05:** Pair scope = all 3 locked pairs (WMNT/USDC, mETH/USDC, WETH/USDC). Evaluate each pair every tick; up to 3 concurrent positions.
- **D-06:** Per-pair cooldown ~3–5 min after a `recordSignal` on that pair.
- **D-07:** Position sizing = fixed fraction of available USDC per BUY (25–33%); SELL flat-sells the held token back to USDC.
- **D-08:** Character = single confident momentum trader.
- **D-09:** Per-signal thesis stored off-chain as JSON keyed by `(agentId, signalId)`. On-chain signal payload stays opaque.
- **D-10:** Daily soft cap ~20 signals/day (agent-side).
- **D-11:** Mock USDC starting balance ~10,000 mUSDC minted to the agent; agent has its own pause flag.
- **D-12:** Agent name/persona drafted by the planner in Claude's voice; feeds the ERC-8004 `agentURI` JSON and the Phase 4 card.

**Strategy edge cases (pinned — do not re-decide)**
- **D-13:** BUY fires but available USDC < minimum → skip + log, no signal.
- **D-14:** BUY fires but already holding that token → skip + log.
- **D-15:** SELL fires but holding nothing → skip + log.
- **D-16:** Multiple pairs cross same tick → emit serially in fixed order (WMNT, mETH, WETH), each subject to its own cooldown.

**Sepolia liquidity + token plan**
- **D-17:** Deploy 4 mock ERC-20s ourselves with public `mint(address,uint256)`.
- **D-18:** Mirror mainnet decimals: MockUSDC = 6; MockWMNT/MockMETH/MockWETH = 18.
- **D-19:** Seed all 3 pools, full-range LP, **0.30% (3000) fee tier uniform**, ~5k USDC-equivalent each. ⚠️ See Pitfall 1 — fee=3000 is NOT a FusionX tier; this decision needs reconfirmation against the actual venue.
- **D-20:** Seed at mainnet-like reference prices (WMNT ≈ $0.60, mETH ≈ $3,200, WETH ≈ $3,200).
- **D-21:** LP-seed via a Foundry script (`script/SeedLiquidity.s.sol`); write resulting addresses into `SequaConstants.sol` TODO slots + a small `addresses.json` for TS.
- **D-22:** Idempotent seed script + admin top-up via mock `mint`.
- **D-23:** Verify all 4 mock contracts on Mantle Explorer.
- **D-24:** Ambient noise bot (separate Node script + dedicated noise EOA), small random swaps every 1–3 min.

**Agent identity, swap pattern + ERC-8004 timing**
- **D-25:** Real swaps, `recordSignal`-then-swap order. Same params, same EOA. Performance reconciles 1:1 to swap history.
- **D-26:** Single "agent operator" EOA holds capital + gas, registers the source, signs swaps. Key in `.env`, never committed.
- **D-27:** Pull ERC-8004 identity mint up to Phase 1. Call canonical Sepolia `register(agentURI)`, store agentId, pass to `registerSource`.
- **D-28:** `agentURI` = static GitHub-Pages JSON (`{name, persona, strategy, startedAt, repo}`).
- **D-29:** One-time max `approve(SwapRouter, type(uint256).max)` on all 4 tokens at startup. 2-tx flow per signal.
- **D-30:** Swap-revert handling = on-chain `invalidateSignal(signalId, reason)` event. "We don't hide misses."
- **D-31:** Redeploy `SourceRegistry` to add `invalidateSignal` + Phase 2 helpers; update `DEPLOYMENT.md`. `FollowRegistry` NOT redeployed.

**Track-record surface + Phase 2 hand-off**
- **D-32:** `SourceRegistry.performance()` stays minimal — `(signalCount, lastSignalAt)`. Frontend computes PnL off-chain.
- **D-33:** Add `signalAt(agentId, signalId)` view + a typed decoded-signal event during redeploy.
- **D-34:** Mirror-engine ordering invariant = best-effort. No on-chain ordering guarantee.

**Runtime hosting + acceptance + open-source**
- **D-35:** Host on always-on lightweight VPS / Railway / Fly, polling every 30s.
- **D-36:** Boot the agent the moment Phase 1 wire-up passes smoke test (target 2–5 days of track record by demo).
- **D-37:** Thesis JSON written to a public GitHub repo (`theses/<agentId>/<signalId>.json`) via PAT; frontend reads via CDN.
- **D-38:** Observability = structured stdout logs + `/healthz` (returns `lastSignalAt`/`lastTickAt`) + external uptime pinger.
- **D-39:** VPS failover = documented local-run fallback (`pull repo + .env + npm run agent` in <3 min).
- **D-40:** Reconciliation CLI (`scripts/reconcile.ts`) is a Phase 1 deliverable AND its acceptance gate. **Success criterion: 100% of non-invalidated signals matched.**
- **D-41:** Mainnet deferred — Sepolia-only for Phase 1.
- **D-42:** Public repo + `RUN.md` reproducibility story.

### Claude's Discretion
- Time budget / wave sequencing for Phase 1 (planner decides via dependency analysis).
- Exact VPS provider (Railway vs Fly vs cheap VPS); exact poll interval within 30–60s; mock-token contract style; replay-harness test layout; thesis-file rotation scheme; ambient-noise randomization params; repo layout for the TS runtime.
- Exact callsign/persona copy (within D-12's momentum-trader constraint).
- `SequaConstants.sol` codegen vs `addresses.json` mechanism for feeding Sepolia addresses to the TS runtime.

### Deferred Ideas (OUT OF SCOPE)
- `SequaExecutor.sol` + scoped-allowance mirror execution, follower-side mirror engine → **Phase 2**.
- Resolve the `ITradeExecutor` unused-import lint in `FollowRegistry.sol` → **Phase 2**.
- Live ERC-8004 reputation accrual (`giveFeedback`/`getSummary`/`clientAddresses[]`) → **Phase 3**. Phase 1 mints identity only.
- Agent card / leaderboard / "Verify" button UI → **Phase 4** (reuses Phase 1 reconciler CLI).
- Mainnet deployment + real-asset trading → **Phase 5** (if at all).
- Multiple source agents → out by scope-cut #1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | SourceRegistry — full signal path + `performance` view. ACs: deployed+verified on Mantle Explorer; `registerSource(agentId, strategyMeta)` ties to ERC-8004 identity; `recordSignal(agentId, bytes)` emits `SignalRecorded`; `performance(agentId) view`. | Existing skeleton at `src/SourceRegistry.sol` already implements all four ACs. Phase 1 redeploy ADDS `invalidateSignal`/`signalAt`/typed event (D-31/D-33) and wires `registerSource` to the *real* ERC-8004 agentId from `register()` (verified live, returns 137 for next mint). Verification flow mirrors `script/VerifyPhase0.sh` (Etherscan V2 unified endpoint, `chainid=5003`). See Code Examples §SourceRegistry extensions. |
| REQ-06 | Source agents — Claude-driven traders. ACs: ≥1 verifiable agent; trades only the locked pair set; calls `recordSignal()` for every decision; performance computed from on-chain history only. | Framework locked (01-AI-SPEC.md, `@anthropic-ai/sdk@0.104.1`, `claude-haiku-4-5`). Trade path = deterministic MA core → `recordSignal` → `exactInputSingle` from one EOA (D-25). "On-chain history only" is enforced by the reconciler (D-40). The locked pair set's *venue* is the blocker — see Pitfall 1. |
</phase_requirements>

---

## Standard Stack

### Core (Solidity / Foundry — already in repo, mirror existing patterns)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Foundry (`forge`/`cast`) | 1.5.1 | Deploy, test, verify, on-chain reads | Already the repo's toolchain (`foundry.toml`, `DeployPhase0.s.sol`); `cast` was the verification tool for this research [VERIFIED: `forge --version`] |
| Solidity | 0.8.24 | Contracts + mocks + seed script | Pinned in `foundry.toml`, `evm_version="paris"` [VERIFIED: foundry.toml] |
| OpenZeppelin Contracts | v5.0.2 | `Ownable`, `ReentrancyGuard`, `ERC20` for mocks | Already in `lib/`; SourceRegistry inherits `Ownable`+`ReentrancyGuard` [VERIFIED: lib/, SourceRegistry.sol] |
| forge-std | (lib) | Script/Test base | Already in `lib/` [VERIFIED: lib/] |
| Uniswap V3 periphery interfaces | v3 (`ISwapRouter`, `INonfungiblePositionManager`, `IQuoterV2`, `IUniswapV3Factory`) | LP-seed + swap + quote calls | FusionX V3 is a verbatim Uniswap V3 fork — `exactInputSingle` selector `0x414bf389` (WITH `deadline`), NPM `factory()` self-consistent [VERIFIED: cast sig + cast call on FusionX mainnet] |

### Core (TypeScript / Node 20+ — greenfield `agent/` workspace)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | **0.104.1** (exact-pin) | Per-signal thesis narration | Locked in 01-AI-SPEC.md §2. `latest=0.104.1` [VERIFIED: `npm view @anthropic-ai/sdk dist-tags`] |
| `zod` | ^3 (latest 3.x) | Thesis output validation | Locked in 01-AI-SPEC.md §4b |
| `viem` | **2.52.2** | Contract reads/writes from TS (swap, recordSignal, quote, event logs) | Modern, typed, tree-shakeable; first-class `simulateContract` for QuoterV2's non-view pattern; native `getLogs`/`watchEvent` for the reconciler [VERIFIED: `npm view viem version`] |
| TypeScript | ^5.x | Type safety for signal tuple + ABIs | Node 20+ target (D-39) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ethers` | 6.16.0 | Alternative to viem | Only if a team member strongly prefers it; viem is the recommendation [VERIFIED: `npm view ethers version`] |
| `dotenv` | ^16 | Load `.env` (`OPERATOR_PRIVATE_KEY`, `ANTHROPIC_API_KEY`) | Runtime + scripts (D-26/D-42) |
| `promptfoo` + `vitest` | latest | Eval harness (01-AI-SPEC.md §5) + replay tests | Dev-only; eval CI + `test/strategy.replay.test.ts` |
| `tsx` | ^4 | Run TS scripts directly (`reconcile.ts`, noise bot) | Dev/runtime convenience |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| viem | ethers 6.16.0 | ethers is more familiar to many; viem has cleaner `simulateContract` for QuoterV2 and better tree-shaking. Either works — viem recommended for the simulate-based quote reads. |
| FusionX V3 (Sepolia) | Self-deployed UniV3 fork OR another live UniV3 on Sepolia | **Forced by the blocker (Pitfall 1)** — FusionX V3 is not on chain 5003. A self-deployed factory+router+NPM+quoter keeps the exact `ISwapRouter` surface and zero adapter code. |

**Installation (TypeScript runtime — greenfield `agent/`):**
```bash
cd agent
npm init -y
npm install @anthropic-ai/sdk@0.104.1 zod@^3 viem@^2.52.2 dotenv@^16
npm install -D typescript@^5 tsx@^4 vitest promptfoo
```

**Version verification (run before pinning):**
```bash
npm view @anthropic-ai/sdk version   # confirmed 0.104.1 (2026-06-10)
npm view viem version                # confirmed 2.52.2
npm view ethers version              # confirmed 6.16.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────────┐
                         │  30s POLL LOOP  (agent/src/index.ts, D-04)     │
                         └──────────────────────────────────────────────┘
                                            │  every 30s
                                            ▼
   FusionX/UniV3 QuoterV2 ───price───►  for each pair (WMNT, mETH, WETH order, D-16)
   simulateContract                          │
   quoteExactInputSingle (non-view)          ▼
                                    ┌────────────────────────────┐
                                    │ PURE MA-crossover core      │  ← replay-testable (D-02/D-03)
                                    │ shortMA(5) vs longMA(20)    │
                                    └────────────────────────────┘
                                            │ decision: BUY / SELL / HOLD
                            ┌───────────────┴────────────────┐
                  skip+log (D-13/14/15)            emit Signal (cooldown ok, D-06)
                                                            │
                                                            ▼   ===== HOT PATH (must complete) =====
                              ┌──────────────────────────────────────────────────────┐
                              │ 1. SourceRegistry.recordSignal(agentId, encodedTuple)  │  → SignalRecorded(signalId)
                              │    encodedTuple = (tokenIn,tokenOut,amountIn,           │     + typed decoded event (D-33)
                              │                    minAmountOut,fee)   (D-07)           │
                              │ 2. SwapRouter.exactInputSingle({...same params...})    │  (D-25, same EOA)
                              │    on revert → invalidateSignal(signalId, reason) (D-30)│  → SignalInvalidated
                              └──────────────────────────────────────────────────────┘
                                                            │ returns signalId
                                                            ▼   ===== OFF HOT PATH (fire-and-store) =====
                              void narrateAndStore(signal, signalId)   ← never awaited (AI-SPEC §4)
                                    │ @anthropic-ai/sdk, 8s timeout, graceful fallback
                                    ▼
                              theses/<agentId>/<signalId>.json  →  git push (PAT)  →  CDN (Phase 4)

   ── separate process ──►  Ambient noise bot (own EOA, D-24): random small swaps → keeps prices moving
   ── separate CLI ──────►  scripts/reconcile.ts (D-40): getLogs(SignalRecorded) ⨝ swap receipts → {matched, invalidated, orphan}
   ── canonical, one-time ►  ERC-8004 register(agentURI) → agentId → registerSource(agentId, meta)
```

### Recommended Project Structure
```
(repo root — Foundry, existing)
├── src/
│   ├── SourceRegistry.sol          # EXTEND: +invalidateSignal, +signalAt, +typed event; REDEPLOY (D-31/D-33)
│   ├── config/SequaConstants.sol   # FILL Sepolia token slots; DECOUPLE venue addr (see Pitfall 1)
│   └── mocks/
│       └── MockERC20.sol           # NEW: 4 mocks w/ public mint + decimals param (D-17/D-18)
├── script/
│   ├── DeployMocks.s.sol           # NEW: deploy 4 mocks, mint to operator (D-11/D-17)
│   ├── DeploySourceRegistryV1.s.sol# NEW: redeploy extended registry (D-31)
│   ├── SeedLiquidity.s.sol         # NEW: create+init pools, NPM.mint full-range (D-19/D-21/D-22)
│   └── VerifyPhase1.sh             # NEW: mirror VerifyPhase0.sh for mocks + registry (D-23/D-31)
├── deployments/sepolia.json        # UPDATE: new registry addr, mock addrs, pool addrs
├── agent/                          # NEW greenfield TS workspace (structure per AI-SPEC §3)
│   ├── src/{strategy,signals,narration,chain,store,health}/...
│   ├── scripts/{registerIdentity.ts, reconcile.ts, noiseBot.ts}
│   ├── eval/{signals/*.json, promptfooconfig.yaml}
│   └── test/strategy.replay.test.ts
└── .planning/phases/00-lock/DEPLOYMENT.md  # UPDATE after registry redeploy (D-31)
```

### Pattern 1: UniV3/FusionX full-range LP seed (Foundry script)
**What:** Create a pool for a mock pair, initialize at a target price, mint a full-range LP position.
**When to use:** `SeedLiquidity.s.sol` (D-19/D-21).
**Exact call sequence (standard Uniswap V3 periphery — FusionX is a verbatim fork):**
1. `INonfungiblePositionManager.createAndInitializePoolIfNecessary(token0, token1, fee, sqrtPriceX96)` — one call that creates the pool (via factory) AND initializes its price. Idempotent (returns existing pool if present) — satisfies D-22.
2. `token0.approve(NPM, amount0); token1.approve(NPM, amount1);`
3. `INonfungiblePositionManager.mint(MintParams{ token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min: 0, amount1Min: 0, recipient, deadline })`.

**Full-range ticks (D-19) — must be multiples of the tier's `tickSpacing`:**
```
tickLower = -887272 rounded UP to nearest multiple of tickSpacing
tickUpper = +887272 rounded DOWN to nearest multiple of tickSpacing
// For tickSpacing=50 (fee 2500): tickLower = -887250, tickUpper = +887250
// For tickSpacing=60 (fee 3000, UNAVAILABLE on FusionX): -887220 / +887220
```

**`sqrtPriceX96` from a target price (D-20):** `sqrtPriceX96 = floor( sqrt(price1_per_0) * 2^96 )`, where `price1_per_0 = (amount of token1) / (amount of token0)` **in raw on-chain units** (so decimals matter — USDC has 6, the others 18). Token ordering is enforced: `token0 < token1` by address. Compute the human price, adjust for the 18-vs-6 decimal gap, sqrt it, scale by 2^96.
```
// Example: WMNT(18 dec)/USDC(6 dec), target $0.60 per WMNT, USDC≈$1.
// If WMNT is token0: price = USDC_raw/WMNT_raw per 1 WMNT
//   = (0.60 * 10^6) / (1 * 10^18) = 0.60e-12  → sqrt → * 2^96
// Solidity: use a known-good encodePriceSqrt helper (see Don't Hand-Roll).
```

### Pattern 2: QuoterV2 price read from TS (NON-VIEW — must simulate)
**What:** `QuoterV2.quoteExactInputSingle` is **state-mutating in its signature** (it reverts internally and decodes the revert), so it is NOT a `view` and cannot be plain-`read`. Call it via `simulateContract` (viem) / `callStatic` (ethers).
**When to use:** the 30s price poll feeding the MA windows (D-02/D-03).
**Selector confirmed:** `quoteExactInputSingle((address,address,uint256,uint24,uint160))` = `0xc6a5026a` [VERIFIED: cast sig].
```typescript
// agent/src/chain/quote.ts  (viem)
import { createPublicClient, http, parseUnits } from 'viem';
const pub = createPublicClient({ transport: http(RPC_URL) });

// QuoterV2 params struct: { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96 }
// Returns: { amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate }
const { result } = await pub.simulateContract({
  address: QUOTER_V2,
  abi: quoterV2Abi,
  functionName: 'quoteExactInputSingle',
  args: [{ tokenIn, tokenOut, amountIn: parseUnits('1', tokenInDecimals), fee, sqrtPriceLimitX96: 0n }],
});
const amountOut = (result as any).amountOut; // price proxy: out per 1 unit in
```
**Determinism note:** the quote is a *spot* read; it moves with pool state (ambient bot + own trades). That is intended — the MA crossover operates on a time series of these reads. Persist the raw price series so the replay harness can re-run the exact decision (D-02 replay-testability).

### Pattern 3: `recordSignal`-then-swap from one EOA (the hot path)
**What:** Two sequential txs from the operator EOA: write the decision on-chain, then settle the swap with the *same* params (D-25).
**Critical detail — TWO DIFFERENT TUPLES:**
- **Signal payload (D-07, opaque on-chain):** `abi.encode(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)` — **5 fields**. This is what `recordSignal` stores and the reconciler/Phase 2 decode.
- **Router struct (FusionX/UniV3 `ExactInputSingleParams`):** `(tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96)` — **8 fields**, selector `0x414bf389` (WITH `deadline`) [VERIFIED: cast sig on FusionX mainnet SwapRouter, `WETH9()` returns WMNT].
The runtime derives the 8-field router struct from the 5-field signal tuple at call time (`recipient = operator EOA`, `deadline = now + buffer`, `sqrtPriceLimitX96 = 0`).
```typescript
// agent/src/chain/recordSignal.ts  (viem walletClient)
const encoded = encodeAbiParameters(
  [{type:'address'},{type:'address'},{type:'uint256'},{type:'uint256'},{type:'uint24'}],
  [tokenIn, tokenOut, amountIn, minAmountOut, fee]
);
// 1) record (returns signalId via SignalRecorded event)
const recTx = await wallet.writeContract({ address: SOURCE_REGISTRY, abi, functionName:'recordSignal', args:[agentId, encoded] });
const rec = await pub.waitForTransactionReceipt({ hash: recTx });
const signalId = decodeSignalId(rec.logs);
// 2) swap — same params (8-field router struct)
try {
  const swapTx = await wallet.writeContract({ address: SWAP_ROUTER, abi: routerAbi, functionName:'exactInputSingle',
    args:[{ tokenIn, tokenOut, fee, recipient: operator, deadline: BigInt(now+120), amountIn, amountOutMinimum: minAmountOut, sqrtPriceLimitX96: 0n }] });
  await pub.waitForTransactionReceipt({ hash: swapTx });
} catch (e) {
  // D-30: surface the miss on-chain, do not hide
  await wallet.writeContract({ address: SOURCE_REGISTRY, abi, functionName:'invalidateSignal', args:[agentId, signalId, reasonString] });
  return null;
}
return signalId;
```
**Allowance (D-29):** one-time `approve(SWAP_ROUTER, type(uint256).max)` per token at startup → every signal is a clean 2-tx flow, not 3.

### Pattern 4: Reconciliation (D-40 acceptance gate)
**What:** Walk `SignalRecorded` + `SignalInvalidated` logs from the redeployed registry, match each non-invalidated signal to a settled swap by `(operatorEOA, tokenIn, tokenOut, amountIn)`, classify `{matched, invalidated, orphan}`.
**How:** `getLogs` over the registry for the agentId; for each signal decode the 5-field tuple; pull the operator EOA's swap history (router `exactInputSingle` calls / pool `Swap` events) over the same block range; match. Output JSON + exit non-zero if any non-invalidated signal is `orphan`.
```typescript
// scripts/reconcile.ts  (skeleton)
const signals = await pub.getLogs({ address: SOURCE_REGISTRY, event: signalRecordedAbi, args:{ agentId }, fromBlock, toBlock });
const invalidated = await pub.getLogs({ address: SOURCE_REGISTRY, event: signalInvalidatedAbi, args:{ agentId }, fromBlock, toBlock });
// match each non-invalidated signal to a settled swap by (operator, tokenIn, tokenOut, amountIn)
// report { matched: n, invalidated: m, orphan: k }; assert orphan === 0 for the gate
```
**Reuse:** the tuple encode/decode lives in `agent/src/chain/reconcile-shared.ts` and is imported by BOTH the runtime and the CLI — write it once (D-40 says "same code reused, not reimplemented").

### Pattern 5: ERC-8004 identity mint (one-time, D-27)
**What:** Call canonical Sepolia `IdentityRegistry.register(agentURI)` once, capture the returned agentId, feed it into `registerSource`.
**Verified live:** `register(string)(uint256)` simulated from the operator EOA returns the next agentId (`137` at research time). `agentURI` is stored and returned by `tokenURI(agentId)` as a raw string — D-28's static GitHub-Pages JSON URL drops in directly. `getAgentWallet`/`ownerOf` confirmed working.
```typescript
// agent/scripts/registerIdentity.ts  (one-shot)
const hash = await wallet.writeContract({ address: ERC8004_IDENTITY_SEPOLIA, abi: identityAbi,
  functionName: 'register', args: [agentURI /* GitHub-Pages JSON URL, D-28 */] });
const receipt = await pub.waitForTransactionReceipt({ hash });
// agentId from the Registered/Transfer(0x0->owner, tokenId) event, OR read tokenURI back
```

### Anti-Patterns to Avoid
- **Hard-coding FusionX Sepolia addresses into `SequaConstants.sol`.** They are dead on chain 5003 (Pitfall 1). Make the venue (factory/router/quoter/NPM) a deploy-time input the seed script writes back, not a compile-time constant copied from stale docs.
- **Calling QuoterV2 as a `view`.** It is non-view; a plain `readContract` reverts. Always `simulateContract`/`callStatic` (Pattern 2).
- **Awaiting the Claude narration on the hot path.** Locked off-path in AI-SPEC §4 — `void narrateAndStore(...)`, never block `recordSignal`/swap.
- **Confusing the 5-field signal tuple with the 8-field router struct.** They are different by design (Pattern 3) — the Phase 0 e2e payload was the 5-field signal tuple, not the router struct.
- **Using `fee=3000` against the live factory.** Not an enabled tier on FusionX (Pitfall 1). Use the factory's actual enabled tier (2500 on FusionX mainnet) uniformly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `sqrtPriceX96` from a target price | Custom fixed-point sqrt in Solidity | Uniswap's `encodePriceSqrt` (JS, in the seed script's off-chain prep) OR `prb-math`/`FullMath` if done on-chain | Decimal-gap (6 vs 18) + 2^96 scaling + token0/token1 ordering are classic foot-guns; the bignumber sqrt rounding must match UniV3's expectations or `initialize` mints at a wrong price |
| Full-range tick bounds | Magic `-887272/+887272` literals | Round to the tier's `tickSpacing` (`TickMath.MIN_TICK`/`MAX_TICK` rounded) | `mint` reverts if `tickLower`/`tickUpper` aren't multiples of `tickSpacing`; the rounded bounds differ per tier |
| Pool create + init | Separate `factory.createPool` + `pool.initialize` with race/exists handling | `NonfungiblePositionManager.createAndInitializePoolIfNecessary` | One idempotent call; handles "already exists" → satisfies D-22 idempotency for free |
| ERC-20 mock | Bespoke token | OpenZeppelin `ERC20` + a `mint(address,uint256)` + constructor `decimals` override | Already in `lib/`; matches D-17/D-18; verifies cleanly on Explorer (D-23) |
| Reading the QuoterV2 revert | Decode the revert bytes by hand | viem `simulateContract` / ethers `callStatic` | The SDK already implements the QuoterV2 revert-decode convention |
| Anthropic retries/timeouts | Raw `fetch` + backoff | `@anthropic-ai/sdk` `maxRetries`/`timeout` | Locked in AI-SPEC §2; the SDK does backoff on 429/5xx |
| Event log pagination/dedup | Custom RPC log loops | viem `getLogs` with block ranges + typed `event` | Handles topic encoding + decoding; reconciler correctness depends on it |

**Key insight:** Uniswap V3 math (price encoding, tick rounding) is the single most error-prone surface in this phase. Every value that initializes a pool or bounds a position must come from a battle-tested helper, not a hand-rolled formula — a wrong `sqrtPriceX96` silently seeds the pool at the wrong price and the card's USD figures (D-20) come out nonsensical.

---

## Runtime State Inventory

> This is a redeploy + new-deploy phase (SourceRegistry redeploy D-31; 4 new mocks; new pools; ERC-8004 mint). The inventory below is about what carries old state across the Phase 0 → Phase 1 transition and what the runtime persists.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) Phase 0 `SourceRegistry` at `0x97a7…` holds `agentId 1` registered to the deployer with `signalCount=1` from the placeholder e2e tx. (b) Canonical ERC-8004 IdentityRegistry already has 136 agents minted (next id = 137) — our mint will be a NEW agentId, not 1. (c) `deployments/sepolia.json` pins the OLD registry address. | (a) The redeployed registry is a FRESH contract at a NEW address — Phase 0's agentId 1 does not carry over; the agent registers fresh against the new registry with the real ERC-8004 agentId. (b) Capture the real returned agentId at mint time — do NOT assume `1`. (c) UPDATE `deployments/sepolia.json` + `DEPLOYMENT.md` (D-31) with the new registry address; Phase 5 cites the Phase 1 address. |
| Live service config | The always-on VPS/Railway/Fly host (D-35) will hold the operator key in `.env` and a GitHub PAT for thesis pushes — these live on the host, not in git. UptimeRobot monitor config (D-38) lives in UptimeRobot's UI, not the repo. | Document the host's `.env` contents and the UptimeRobot monitor in `RUN.md` (D-42) so the local-run failover (D-39) and a fresh host rebuild are reproducible. |
| OS-registered state | None for Phase 1 — the agent is a Node process (likely under pm2/systemd on the VPS), no Windows Task Scheduler / launchd entries created by this phase. | None — verified: this phase ships scripts + a long-running node process, no OS-level scheduler registration is in scope. |
| Secrets/env vars | `.env` keys: `OPERATOR_PRIVATE_KEY` (D-26, holds capital+gas, signs register/record/swap), `ANTHROPIC_API_KEY` (AI-SPEC), `MANTLESCAN_API_KEY` (verify, existing), `DEPLOYER_PRIVATE_KEY` (existing Phase 0), a separate NOISE_BOT key (D-24), and a `GITHUB_PAT` (D-37). All gitignored. | Add `OPERATOR_PRIVATE_KEY`, `ANTHROPIC_API_KEY`, `NOISE_BOT_PRIVATE_KEY`, `GITHUB_PAT` to `.env.example` (names only). Code renames: none — these are new keys, not renames of existing ones. |
| Build artifacts | Foundry `out/`, `cache/`, `broadcast/` from Phase 0 are stale w.r.t. the new contracts. No `agent/node_modules` exists yet (greenfield). | `forge clean && forge build` before redeploy; `npm install` in the new `agent/` workspace. No egg-info/compiled-binary analogues. |

---

## Common Pitfalls

### Pitfall 1: FusionX V3 is NOT on Mantle Sepolia, and fee=3000 is not a FusionX tier (BLOCKER)
**What goes wrong:** The seed script, swap path, and QuoterV2 reads all target addresses that have **zero code on chain 5003**, so every FusionX call reverts with "no code at address." Even on the chain where FusionX V3 IS live (mainnet 5000), the locked `fee=3000` tier returns `tickSpacing=0` (disabled), so `createAndInitializePoolIfNecessary(..., 3000, ...)` / `getPool(..., 3000)` would not produce a usable pool.
**Why it happens:** The FusionX testnet docs page (the source for both `SequaConstants.sol` and PHASE-0-RESEARCH §1) predates Mantle Sepolia and targets the deprecated old **Mantle Testnet (chain 5001)**, whose RPC now 404s. Phase 0's e2e test used `0xDEAD`/`0xBEEF` placeholder tokens with `fee:3000` and a contract that treats the payload as opaque (`recordSignal`), so it **never executed a real FusionX call** — the gap went undetected. [VERIFIED: `cast codesize` = 0 for SwapRouter/Factory/QuoterV2/NPM/PoolDeployer/Masterchef on 5003; Multicall3 codesize=3808 on 5003 confirms RPC/chain are correct; FusionX mainnet factory `feeAmountTickSpacing`: 100→1, 500→10, 2500→50, 3000→**0**, 10000→200; real WMNT/USDC pools exist on mainnet at fee 500/2500/10000.]
**How to avoid:** Resolve in Wave 0 (Open Question 1). Options, cheapest-design-disruption first:
1. **Confirm a current FusionX V3 Sepolia deployment.** Check the FusionX app (`fusionx.finance/liquidity?chain=mantle-sepolia-testnet`) / Discord for live testnet addresses; if found, re-pin and use the factory's actual enabled tier (likely 2500). Verify each address with `cast codesize` before trusting it.
2. **Self-deploy a Uniswap V3 fork on Sepolia** (factory + NPM + SwapRouter + QuoterV2) alongside the mocks. Identical `ISwapRouter` surface → zero adapter code, zero mirror-engine impact. Enable a single fee tier and use it uniformly. This is the most robust hackathon-grade fix and keeps the locked architecture intact.
3. **Find any maintained UniV3 deployment already live on Mantle Sepolia** and reuse it.
**Whichever wins:** change `fee=3000` → the actual enabled tier (e.g., 2500) everywhere it appears (D-19, signal tuple, seed script, reconciler fixtures, Phase 0 precedent note), and decouple venue addresses from `SequaConstants.sol` constants.
**Warning signs:** any `cast codesize <addr>` returning 0; `getPool(...,3000)` returning `address(0)`; `feeAmountTickSpacing(3000)` returning 0.

### Pitfall 2: QuoterV2 treated as a view function
**What goes wrong:** `readContract`/static `view` call to `quoteExactInputSingle` reverts; the poll loop never gets a price; MAs never populate.
**Why it happens:** Uniswap's QuoterV2 deliberately reverts internally and ABI-decodes the revert data — it is gas-costly and marked non-view despite "reading" a price.
**How to avoid:** Always `simulateContract` (viem) / `callStatic` (ethers) — Pattern 2. Confirmed selector `0xc6a5026a`. [VERIFIED]
**Warning signs:** "execution reverted" on every price read; empty MA buffers.

### Pitfall 3: Wrong `sqrtPriceX96` from the 6-vs-18 decimal gap
**What goes wrong:** Pool initializes at a wildly wrong price (off by 10^12), so D-20's "$0.60 / $3,200" reference prices render as absurd numbers on the card, and the first swap moves price catastrophically.
**Why it happens:** `sqrtPriceX96` is computed from the ratio of **raw** token1/token0 amounts, but USDC is 6 decimals and WMNT/mETH/WETH are 18 (D-18). Forgetting the 10^12 adjustment, or mis-ordering token0/token1 (must be ascending by address), inverts or mis-scales the price.
**How to avoid:** Use a tested `encodePriceSqrt(reserve1, reserve0)` helper with **raw** amounts in the right decimal units; verify token0 = `min(addr)`. Round-trip check: after init, read `slot0().sqrtPriceX96`, convert back to a human price, assert ≈ target before minting LP.
**Warning signs:** `slot0` price not matching D-20; immediate huge slippage on the first swap.

### Pitfall 4: Mantle Explorer verification uses the Etherscan V2 unified endpoint (not legacy V1)
**What goes wrong:** `forge verify-contract` against the old `api-sepolia.mantlescan.xyz/api` returns "deprecated V1 endpoint."
**Why it happens:** Mantle migrated to the Etherscan V2 unified API; Foundry 1.5.1 doesn't pass `chainid` separately, so it must be embedded in the URL.
**How to avoid:** Reuse the existing pattern verbatim — `--verifier-url "https://api.etherscan.io/v2/api?chainid=5003"` (see `script/VerifyPhase0.sh` and the `[etherscan]` block in `foundry.toml`). Mirror it in `VerifyPhase1.sh` for the 4 mocks + the redeployed registry. [VERIFIED: foundry.toml + VerifyPhase0.sh in repo]
**Warning signs:** "deprecated V1 endpoint, switch to Etherscan API V2."

### Pitfall 5: The thesis call silently blocking or crashing the long-running process
**What goes wrong:** A rate-limited/slow Claude call stalls the 30s loop, or an un-awaited rejected promise becomes an `unhandledRejection` and kills the VPS process — exactly the silent-VPS-dead failure D-38 guards against.
**Why it happens:** SDK default request timeout is 10 minutes with auto-retries; an un-awaited `void narrateAndStore` whose inner function throws crashes Node.
**How to avoid:** 8s per-call `timeout` + `maxRetries:2` (AI-SPEC §3); keep ALL throwing inside `narrateSignalSafe` (returns fallback, never throws); never `await` narration before returning from the trade. `/healthz` exposes `lastTickAt`/`lastSignalAt` so UptimeRobot catches a hung loop (D-38).
**Warning signs:** `/healthz` `lastTickAt` older than ~2 min; rising fallback-substitution rate (AI-SPEC §7).

### Pitfall 6: agentId assumed to be `1`
**What goes wrong:** Runtime/registerSource hard-codes agentId 1 (the Phase 0 placeholder); the real ERC-8004 mint returns a different id (137+), so `recordSignal` reverts `NotSourceOwner` or signals attach to the wrong identity.
**Why it happens:** Phase 0 used agentId 1 as a literal; the canonical registry already has 136 agents.
**How to avoid:** Capture the agentId returned by `register()` at mint time (read it from the `Transfer`/`Registered` event or `tokenURI` round-trip), persist it to `addresses.json`/`.env`, and thread it through `registerSource` and every `recordSignal`. [VERIFIED: register simulation returned 137; ownerOf(1) is an unrelated existing owner]

---

## Code Examples

### SourceRegistry extensions for the Phase 1 redeploy (D-31/D-33)
```solidity
// Additions to src/SourceRegistry.sol (inherit existing Ownable + ReentrancyGuard + D-08 owner gate).
// Store the raw signal bytes so signalAt() can return them without a log scan (D-33).
mapping(uint256 agentId => mapping(uint256 signalId => bytes)) private _signalData;
mapping(uint256 agentId => mapping(uint256 signalId => bool)) public invalidated;

// Typed decoded event so the Phase 2 mirror engine indexes on fields without decoding bytes per handler (D-33).
event SignalDecoded(
    uint256 indexed agentId, uint256 indexed signalId,
    address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee
);
event SignalInvalidated(uint256 indexed agentId, uint256 indexed signalId, string reason, uint64 timestamp);

// Extend recordSignal to also decode + emit the typed event and persist bytes.
// (decode the D-07 5-field tuple; if a caller ever sends non-conforming bytes, guard or skip the typed emit.)

function invalidateSignal(uint256 agentId, uint256 signalId, string calldata reason)
    external nonReentrant
{
    Source storage s = sources[agentId];
    if (!s.registered) revert SourceNotRegistered(agentId);
    if (s.owner != msg.sender) revert NotSourceOwner(agentId, msg.sender);
    invalidated[agentId][signalId] = true;
    emit SignalInvalidated(agentId, signalId, reason, uint64(block.timestamp));
}

function signalAt(uint256 agentId, uint256 signalId) external view returns (bytes memory) {
    return _signalData[agentId][signalId];
}
```
*Note: keep `performance()` minimal `(signalCount, lastSignalAt)` per D-32. The `nonReentrant`+owner gate on `invalidateSignal` mirrors the existing functions (CONTEXT code_context).* [CITED: existing src/SourceRegistry.sol patterns]

### MockERC20 with parameterized decimals (D-17/D-18)
```solidity
// src/mocks/MockERC20.sol
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); } // public per D-17
}
// Deploy: MockUSDC(6), MockWMNT(18), MockMETH(18), MockWETH(18)  (D-18)
```

### Anthropic narration (LOCKED — verbatim from AI-SPEC §3, do not redesign)
```typescript
const msg = await client.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 120, temperature: 0.7,
  system: PERSONA_SYSTEM_PROMPT,
  messages: [{ role: 'user', content: userContent }],
});
const block = msg.content[0];
if (block?.type !== 'text') throw new Error('Unexpected non-text content block');
return block.text.trim();
```
[CITED: 01-AI-SPEC.md §3]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FusionX V3 on old Mantle Testnet (chain 5001) | Mantle Sepolia (chain 5003); old testnet RPC 404s | Mantle Sepolia migration (the FusionX docs were not updated) | The pinned Sepolia addresses are dead — Pitfall 1 |
| Mantlescan legacy Etherscan V1 verify API | Etherscan V2 unified (`api.etherscan.io/v2/api?chainid=5003`) | V1 decommissioned | Already handled in repo's verify scripts (Pitfall 4) |
| `claude-3-5-haiku` / dated model IDs | `claude-haiku-4-5` (pinned alias) | per AI-SPEC | Use the locked alias; a wrong ID throws NotFoundError at first signal |

**Deprecated/outdated:**
- `rpc.testnet.mantle.xyz` (old testnet) — dead (404). Use `rpc.sepolia.mantle.xyz` (chain 5003).
- `fee=3000` tier on FusionX — not enabled (Pitfall 1).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The cleanest fix for the FusionX-on-Sepolia gap is a self-deployed UniV3 fork (or a found live deployment); the locked agent/reconciler/identity design is unaffected. | Pitfall 1 / Open Q1 | If FusionX has a current Sepolia deployment we haven't located, self-deploying is wasted effort (but harmless); if no UniV3 fork is easily deployable on Mantle Sepolia, the LP-seed timeline expands — must be resolved Wave 0. |
| A2 | FusionX V3 testnet (if re-found) uses the same enabled fee tiers as mainnet (2500 closest to the intended 0.30%). | Standard Stack / Pitfall 1 | If the testnet factory enables different tiers, the uniform tier constant changes — low risk, just read `feeAmountTickSpacing` on the actual factory before seeding. |
| A3 | FusionX Sepolia SwapRouter (or our fork) uses the original UniV3 `ExactInputSingleParams` WITH `deadline` (selector 0x414bf389), as confirmed on FusionX mainnet. | Pattern 3 | If a deployment uses SwapRouter02 (no `deadline`, selector 0x04e45aaf), the struct has 7 fields not 8 — verify the router's selector on the actual deployment before wiring. |
| A4 | The redeployed `SourceRegistry`'s `SignalRecorded` event keeps the same shape as Phase 0 so the reconciler/Phase 2 contract is stable; new events are additive. | Code Examples | If the event shape changes, Phase 2's listener contract assumptions shift — keep `SignalRecorded` backward-compatible and add the typed event alongside, not in place. |
| A5 | ERC-8004 `register(string)` has no access gate / fee that blocks the operator EOA from minting (simulation succeeded from that EOA). | Pattern 5 | If a real send requires a fee or allowlist not surfaced by `eth_call`, the mint tx reverts — test with a tiny real send early in Wave 0. |

**Note:** The blocker in Pitfall 1 is VERIFIED (not assumed) — the *resolution* (A1) is the assumed part and must be confirmed before LP-seed planning is finalized.

---

## Open Questions

1. **Is FusionX V3 deployed and usable on Mantle Sepolia (chain 5003) today — and at what addresses/fee tiers?**
   - What we know: every docs-pinned FusionX Sepolia address has zero code on 5003; the docs target the dead old testnet; FusionX V3 IS live on mainnet (5000) but only at fee tiers 100/500/2500/10000, not 3000. [VERIFIED via cast]
   - What's unclear: whether a *current* FusionX V3 Sepolia deployment exists at undocumented addresses (the FusionX app offers a `mantle-sepolia-testnet` option, which hints it may).
   - Recommendation: **Wave 0 spike** — check the FusionX app/Discord for live Sepolia addresses; `cast codesize` each candidate; if none, self-deploy a UniV3 fork (Pitfall 1 option 2). Decision gates all LP-seed/swap/quote work. Re-confirm `fee=3000`→actual tier with the user (it contradicts D-19).
2. **Exact `agentURI` JSON shape + host for the ERC-8004 mint (D-28).**
   - What we know: `tokenURI` stores/returns the raw string; D-28 says static GitHub-Pages JSON `{name, persona, strategy, startedAt, repo}`.
   - What's unclear: whether the canonical registry expects a URL vs an inline JSON string (existing agentId 1 stored an inline JSON object, not a URL — see Pattern 5 tokenURI output).
   - Recommendation: a resolvable HTTPS URL is the safest, most portable choice for the Phase 4 card; confirm the registry accepts a plain URL string (it stores whatever string you pass — verified it round-trips arbitrary strings).
3. **`SignalDecoded` typed-event field set for Phase 2 (D-33).**
   - What we know: Phase 2 wants indexed fields to avoid decoding bytes per handler.
   - What's unclear: which fields Phase 2 will index on (tokenIn? agentId+tokenIn?).
   - Recommendation: index `agentId`, `signalId`, `tokenIn` (3 indexed max is fine); emit the rest as data. Low-cost to over-emit now.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `forge` / `cast` | Contracts, mocks, seed script, verify, on-chain reads | ✓ | 1.5.1 | — |
| `node` | TS agent runtime, scripts | ✓ | v24.15.0 (≥20 ✓) | — |
| `npm` | TS deps | ✓ | 11.12.1 | — |
| `jq` | Verify scripts (read deployments json) | ✓ | 1.8.1 | — |
| OpenZeppelin Contracts | Mocks + registry | ✓ (lib/) | v5.0.2 | — |
| Mantle Sepolia RPC | All on-chain ops | ✓ | `rpc.sepolia.mantle.xyz` (chain 5003 confirmed) | Public RPC; consider a dedicated endpoint for the 30s poll to avoid rate limits |
| ERC-8004 IdentityRegistry (Sepolia) | Identity mint (D-27) | ✓ | live UUPS proxy `0x8004A818…`, impl `0x7274e874…` | — |
| **FusionX V3 (Sepolia)** | LP-seed, swaps, quotes (D-02/D-19/D-25) | **✗** | docs addresses have ZERO code on 5003 | **Self-deploy a UniV3 fork on Sepolia, OR locate a current FusionX/UniV3 Sepolia deployment (Open Q1)** |
| `@anthropic-ai/sdk` | Thesis narration | ✓ (npm) | 0.104.1 (latest) | Fallback thesis text (AI-SPEC §4) if API down — already designed |
| `ANTHROPIC_API_KEY` | Narration | ⚠️ (user-supplied) | — | Agent degrades to fallback thesis; trade path unaffected |
| VPS/Railway/Fly host | Always-on agent (D-35) | ⚠️ (to be provisioned) | — | Local-run failover documented (D-39) |

**Missing dependencies with no fallback:**
- **FusionX V3 on Mantle Sepolia** — this is the blocker. No usable LP venue exists at the pinned addresses; the agent cannot trade until Open Q1 is resolved.

**Missing dependencies with fallback:**
- Anthropic API / key — fallback thesis (commentary degrades, trade path intact).
- VPS host — local-run failover (D-39).

---

## Validation Architecture

> Nyquist validation is enabled (no `workflow.nyquist_validation:false` in config). This section is consumed to generate VALIDATION.md. It covers BOTH the deterministic on-chain/strategy core (the Phase 1 acceptance gate) AND the off-hot-path thesis eval (which 01-AI-SPEC.md §5 owns in detail — referenced, not duplicated).

### Observable signals that prove each success criterion

| Success Criterion (CONTEXT/REQ) | Observable Signal (what proves it TRUE) | Where measured |
|---|---|---|
| SourceRegistry redeployed + verified (REQ-01, D-31) | Verified contract page on Mantlescan; `performance(agentId)` returns live `(count, lastSignalAt)`; `signalAt`/`invalidateSignal`/typed event present in ABI | Explorer + `cast call` |
| Real ERC-8004 identity minted (D-27) | `ownerOf(agentId) == operator`; `getAgentWallet(agentId)` set; agentId stored and used in `registerSource` | `cast call` on `0x8004A818…` |
| Every trade decision recorded on-chain (REQ-06, D-25) | One `SignalRecorded` (+ typed `SignalDecoded`) event per non-skipped decision; reconciler `orphan == 0` | Reconciler CLI |
| Performance from on-chain history only (REQ-06) | Reconciler recomputes the track record purely from logs + swap receipts; no off-chain DB needed | `scripts/reconcile.ts` output |
| **100% non-invalidated signals matched (D-40 acceptance gate)** | `reconcile.ts` reports `{matched: N, invalidated: M, orphan: 0}` and exits 0 | Reconciler CLI (CI + manual) |
| Swap-revert honesty (D-30) | A reverted swap produces a `SignalInvalidated` event; reconciler counts it as `invalidated`, not `orphan` | Reconciler CLI |
| Deterministic strategy core (D-02/D-03) | Replay harness over canned price series reproduces the identical signal sequence byte-for-byte | `test/strategy.replay.test.ts` |
| Swap/record ordering (D-25) | For each signal, the `recordSignal` tx block ≤ the matching swap tx block from the same EOA | Reconciler ordering assert |
| Liveness (D-38) | `/healthz` returns fresh `lastTickAt` (≤ ~2 min) and `lastSignalAt`; UptimeRobot green | `/healthz` HTTP + UptimeRobot |
| Thesis fidelity/safety (AI-SPEC §5) | Code checks (signal fidelity, format) pass; promptfoo regression green; judge ≥0.7 calibrated | AI-SPEC §5 harness |

### Test Framework
| Property | Value |
|----------|-------|
| Framework (Solidity) | Foundry `forge test` (existing; `test/SourceRegistry.t.sol` pattern) |
| Framework (TS) | Vitest (replay harness, unit) + promptfoo (thesis eval, AI-SPEC §5) |
| Config file | `foundry.toml` (exists); `agent/package.json` scripts + `agent/eval/promptfooconfig.yaml` (Wave 0) |
| Quick run command | `forge test` ; `cd agent && npx vitest run test/` |
| Full suite command | `forge test && cd agent && npm run eval:ci && npx tsx scripts/reconcile.ts --assert` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | redeployed registry: register/record/perf/invalidate/signalAt/typed event | unit | `forge test --match-contract SourceRegistryTest` | ✅ extend existing |
| REQ-01 | mocks mint + correct decimals (6/18) | unit | `forge test --match-contract MockERC20Test` | ❌ Wave 0 |
| REQ-01 | seed script creates+inits pool, mints full-range LP at target price | integration (forked/sim) | `forge script SeedLiquidity --fork-url <venue>` (or fork test) | ❌ Wave 0 |
| REQ-06 | MA-crossover core: identical signals over canned series | unit/replay | `npx vitest run test/strategy.replay.test.ts` | ❌ Wave 0 |
| REQ-06 | skip cases D-13/14/15 emit NO signal; D-16 serial order | unit/replay | (same replay file) | ❌ Wave 0 |
| REQ-06 | recordSignal→swap ordering + invalidate-on-revert (D-25/D-30) | integration | `npx tsx scripts/reconcile.ts --assert` (against live testnet) | ❌ Wave 0 |
| REQ-06 (D-40) | **reconciler: orphan == 0 (acceptance gate)** | integration | `npx tsx scripts/reconcile.ts --assert` (exit non-zero on any orphan) | ❌ Wave 0 |
| REQ-06 | thesis fidelity/format/safety | code + promptfoo + judge | `cd agent && npm run eval:ci` | ❌ Wave 0 (AI-SPEC §5) |

### Sampling Rate
- **Per task commit:** `forge test` (Solidity) and/or `npx vitest run` (changed TS) — fast (<30s).
- **Per wave merge:** full `forge test` + `agent` unit/eval + a dry-run `reconcile.ts` against the testnet over the wave's signals.
- **Phase gate:** `reconcile.ts --assert` reports `orphan == 0` over the full live signal history AND `forge test` green AND thesis `eval:ci` green, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/MockERC20.t.sol` — decimals + public mint (REQ-01, D-17/D-18)
- [ ] `script/SeedLiquidity.s.sol` + a fork/sim test — covers REQ-01 LP seed (gated on Open Q1 venue)
- [ ] `agent/test/strategy.replay.test.ts` + canned price-series fixtures — REQ-06 deterministic core (D-02/D-03/D-13..D-16)
- [ ] `agent/scripts/reconcile.ts` with `--assert` mode — REQ-06/D-40 acceptance gate
- [ ] `agent/eval/signals/*.json` + `promptfooconfig.yaml` + `signalFidelity.ts`/`bannedPhrases.ts` — AI-SPEC §5 thesis eval
- [ ] `agent/test/` Vitest config + `agent/package.json` eval scripts
- [ ] Framework install: `cd agent && npm i -D vitest promptfoo tsx typescript`

---

## Security Domain

> `security_enforcement` not set to false in config → included. Scope: Phase 1 is Sepolia + mock tokens (D-41), single operator EOA, no follower capital (that's Phase 2). Security surface is narrow but the operator key + on-chain integrity matter.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | On-chain auth is `msg.sender == sources[agentId].owner` (D-08, existing); ERC-8004 `ownerOf` gate. No web auth in Phase 1. |
| V3 Session Management | no | No sessions; stateless narration + a long-running process. |
| V4 Access Control | yes | `recordSignal`/`invalidateSignal` gated to source owner; `register` mints to caller; mock `mint` is intentionally public (testnet only, D-17). |
| V5 Input Validation | yes | Validate the decoded signal tuple before the typed-event emit; Zod-validate the thesis (AI-SPEC §4b); validate RPC/quote responses before acting. |
| V6 Cryptography | yes | Never hand-roll signing — viem/ethers wallet client handles ECDSA; operator key in gitignored `.env`, separate from deployer + noise-bot keys (D-26/D-24). |
| V7 Error Handling & Logging | yes | Structured stdout logs (D-38); never log the private key or full `.env`; on-chain `invalidateSignal` for swap reverts (D-30). |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator private-key leak (key drains capital/gas) | Spoofing/Elevation | `.env` gitignored, never committed (D-26/D-42); `.env.example` names only; testnet-only funds (D-41) cap blast radius; rotate if exposed |
| Unauthorized `recordSignal` (someone else writes signals for the agent) | Tampering | Existing `NotSourceOwner` gate (msg.sender == owner) carried into the redeploy + new `invalidateSignal` |
| Reentrancy on state-changing registry fns | Tampering | `nonReentrant` on `recordSignal`/`invalidateSignal` (D-09, existing pattern) |
| Swap front-run / sandwich on thin mock pools | Tampering | `amountOutMinimum` (minAmountOut from the signal tuple) as slippage bound; full-range LP + ambient bot keep depth (D-19/D-24); reverts → `invalidateSignal` (D-30) |
| Thesis injects financial-promotion / advice language | Repudiation/optics | Banned-phrase + signal-fidelity gates pre-publish (AI-SPEC §6) |
| Wrong-venue / no-code address (sends to a dead contract) | DoS | `cast codesize` every venue address before pinning (Pitfall 1); fail-closed if code absent |
| GitHub PAT leak (thesis push) | Elevation | Fine-scoped PAT (single repo, contents-write only); gitignored; rotate on exposure |

---

## Sources

### Primary (HIGH confidence — verified live this session)
- **Mantle Sepolia chain 5003 (`rpc.sepolia.mantle.xyz`)** via `cast` — chain-id, codesizes, `feeAmountTickSpacing`, `register` simulation, `ownerOf`/`getAgentWallet`/`tokenURI`/`name`/`symbol` on ERC-8004; Phase-0 SourceRegistry codesize + e2e tx existence.
- **Mantle mainnet chain 5000 (`rpc.mantle.xyz`)** via `cast` — FusionX V3 factory fee tiers, real WMNT/USDC pools, NPM `factory()`, SwapRouter `WETH9()` + selector confirmation.
- **`npm view`** — `@anthropic-ai/sdk@0.104.1` (latest), `viem@2.52.2`, `ethers@6.16.0`.
- Repo files: `src/SourceRegistry.sol`, `src/config/SequaConstants.sol`, `src/interfaces/IIdentityRegistry.sol`, `foundry.toml`, `script/VerifyPhase0.sh`, `script/DeployPhase0.s.sol`, `test/SourceRegistry.t.sol`, `deployments/sepolia.json`, `.planning/phases/00-lock/DEPLOYMENT.md`.
- `.planning/phases/01-source-signals/01-CONTEXT.md` (42 decisions), `01-AI-SPEC.md` (framework lock), `.planning/REQUIREMENTS.md`, `.planning/intel/{decisions,constraints}.md`, `PHASE-0-RESEARCH.md`, `.planning/STATE.md`.

### Secondary (MEDIUM confidence)
- FusionX V3 testnet docs (`docs.fusionx.finance/.../v3-smart-contracts`) — source of the (now-stale) Sepolia addresses + NPM/PoolDeployer/Masterchef addresses + pool init code hash. Addresses contradicted by live chain state (Pitfall 1).
- Uniswap V3 periphery reference (NonfungiblePositionManager / ISwapRouter / QuoterV2 / Factory) — FusionX is a verbatim fork; interface shapes confirmed against FusionX mainnet selectors.
- `github.com/erc-8004/erc-8004-contracts` — IdentityRegistry is an upgradeable ERC-721 with `register` minting an agentId (confirmed against the live proxy's behavior).

### Tertiary (LOW confidence — flagged for validation)
- Whether a *current* FusionX V3 Sepolia deployment exists at undocumented addresses (Open Q1) — unconfirmed; web search inconclusive.

---

## Metadata

**Confidence breakdown:**
- ERC-8004 identity mechanics: **HIGH** — `register`/`ownerOf`/`getAgentWallet`/`tokenURI` all exercised against the live canonical proxy; interface matches the pinned `IIdentityRegistry.sol`.
- SourceRegistry redeploy + reconciler design: **HIGH** — extends an existing, tested contract following established repo patterns; reconciler is a standard log-walk.
- Swap/quote/LP mechanics (interface shapes): **HIGH** — confirmed FusionX is a verbatim UniV3 fork via selectors + factory behavior on mainnet.
- **Venue availability on Sepolia: LOW (blocker)** — FusionX V3 is verifiably absent from chain 5003 and `fee=3000` is not an enabled tier; resolution requires a Wave 0 spike + likely a self-deployed UniV3 fork.
- AI narration: **HIGH** — locked + version-verified; not re-researched.

**Research date:** 2026-06-10
**Valid until:** ~2026-06-24 (on-chain facts are stable for this hackathon window; re-verify venue addresses if more than a few days pass, and re-run `cast codesize` on any newly-found FusionX Sepolia addresses before pinning).
