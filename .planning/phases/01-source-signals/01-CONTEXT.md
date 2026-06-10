# Phase 1: Source + signals - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

**Goal:** One verifiable Claude-driven source agent is live on FusionX V3 Mantle Sepolia, trading the locked 3-pair set and recording every trade decision on-chain via `SourceRegistry.recordSignal`, so its track record is computed from on-chain history only and reconciles 1:1 to real settled swaps.

**In scope (Phase 1):**
- Deploy 4 mock ERC-20 tokens (MockUSDC, MockWMNT, MockMETH, MockWETH) to Sepolia; verify on Mantle Explorer.
- Seed 3 full-range FusionX V3 pools (WMNT/USDC, mETH/USDC, WETH/USDC) at the 0.30% fee tier, modest depth (~5k USDC-equivalent each).
- **Redeploy `SourceRegistry.sol`** (Phase 0 was an explicit skeleton) with an added `invalidateSignal(signalId, reason)` event path, a `signalAt(agentId, signalId)` view, and a typed decoded-signal event for Phase 2 indexing. Re-verify on Mantle Explorer. Update `DEPLOYMENT.md`.
- Mint the source agent a real **ERC-8004 identity** via canonical Mantle Sepolia `IdentityRegistry.register()`; use the returned `agentId` in `SourceRegistry.registerSource()`.
- Build the Claude-narrated momentum source agent (TypeScript / Node 20): deterministic MA-crossover rule decides trades; Claude writes a 1–2 sentence per-signal thesis.
- Agent executes real swaps on FusionX V3 (`recordSignal` first, then `exactInputSingle` with the same params from the same operator EOA).
- Ship a reconciliation CLI (`scripts/reconcile.ts`) that proves every non-invalidated signal maps to a settled swap — this is a Phase 1 acceptance gate.
- Deterministic replay harness over canned price series (pure-function strategy core).
- Ambient noise bot (separate EOA) to keep Sepolia mock-pool prices moving so MAs cross organically.
- Host the agent on an always-on lightweight VPS / Railway / Fly with `/healthz` + uptime ping; boot it the moment Phase 1 smoke passes so a real multi-day track record accrues before the Phase 5 demo.

**Explicitly NOT in scope (deferred to later phases):**
- `SequaExecutor.sol` + scoped-allowance enforcement and the follower-side mirror engine (→ Phase 2).
- Live ERC-8004 reputation accrual loop (`giveFeedback` / `getSummary`) (→ Phase 3). Phase 1 only *mints* the identity.
- Frontend, agent card, leaderboard, "Verify" button UI (→ Phase 4). Phase 1 ships the reconciler CLI the card will later call.
- Mainnet deployment (→ Phase 5 ship, if at all). Phase 1 is Sepolia-only.

**Scope-cut awareness:** Scope-cut #1 (one source agent) is already the Phase 1 design. Scope-cut #5 (single pair) is the fallback if LP-seeding overruns — documented but not invoked.
</domain>

<decisions>
## Implementation Decisions

### Strategy + Claude integration
- **D-01:** **Deterministic rule + Claude narrates.** A small audited rule decides trades; Claude is called per-signal to write a 1–2 sentence plain-language thesis. Mirror fidelity stays bulletproof (rule is reproducible); the "AI agent" story stays loud (Claude voices it). This satisfies CON-ai-interaction's "agents as characters" without putting LLM nondeterminism on the mirror hot path.
- **D-02:** **Rule = momentum / breakout.** Short MA crossing a longer MA triggers a position; flip out on the opposite cross. Prices read from FusionX V3 QuoterV2.
- **D-03:** **MA windows = short 5 ticks / long 20 ticks at a 30s poll** (short ≈ 2.5 min, long ≈ 10 min). Fast enough to fire on camera, slow enough to look considered.
- **D-04:** **Trigger = time-based polling** every 30s. Fully deterministic, predictable demo cadence.
- **D-05:** **Pair scope = all 3 locked pairs** (WMNT/USDC, mETH/USDC, WETH/USDC). Agent independently evaluates each pair every tick; may hold up to 3 concurrent positions.
- **D-06:** **Per-pair cooldown ~3–5 minutes** after a `recordSignal` on that pair. Prevents whipsaw flapping, keeps the timeline readable, gives Phase 2 deterministic signal spacing.
- **D-07:** **Position sizing = fixed fraction of available USDC per BUY (25–33%); SELL flat-sells the held token back to USDC.** Deterministic and mirror-trivial — Phase 2 scales the same fraction to follower capital.
- **D-08:** **Character = single confident momentum trader** ("patient until the trend confirms, then in fast, out faster on reversal"). One coherent persona across all signals and the card.
- **D-09:** **Per-signal thesis stored off-chain as JSON keyed by `(agentId, signalId)`.** On-chain signal payload stays opaque per Phase-0 D-07. Thesis is commentary, not the proof — the verified-on-chain badge still reconciles to the swap, not the thesis.
- **D-10:** **Daily soft cap ~20 signals/day** across all 3 pairs (agent-side, not on-chain) as a runaway guard on top of the cooldown.
- **D-11:** **Mock USDC starting balance ~10,000 mUSDC** minted to the agent; agent has its own pause flag, independent of any contract kill switch.
- **D-12:** **Agent name/persona drafted by the planner in Claude's voice** — single-word callsign + 1–2 sentence persona consistent with the momentum character. Feeds the ERC-8004 `agentURI` JSON and the Phase 4 card.

### Strategy edge cases (canonical — pinned, do not let planner re-decide)
- **D-13:** BUY fires but available USDC < minimum → **skip + log, do not emit a signal.**
- **D-14:** BUY fires but already holding that token → **skip + log** (no doubling up).
- **D-15:** SELL fires but holding nothing → **skip + log.**
- **D-16:** Multiple pairs cross on the same tick → **emit signals serially in fixed pair order (WMNT, mETH, WETH),** each subject to its own cooldown.

### Sepolia liquidity + token plan
- **D-17:** **Deploy 4 mock ERC-20s ourselves** with a public `mint(address,uint256)` so the agent EOA, the LP-seed script, and dev/test wallets can mint freely.
- **D-18:** **Mirror mainnet decimals:** MockUSDC = 6 decimals; MockWMNT / MockMETH / MockWETH = 18 decimals. Keeps signal-payload decimal semantics identical to mainnet — zero adapter code when crossing over later.
- **D-19:** **Seed all 3 pools, full-range LP, 0.30% (3000) fee tier uniform,** modest depth ~5k USDC-equivalent each. Full-range avoids any out-of-range swap revert mid-demo. 0.30% matches the Phase 0 test signal (`fee: 3000`). *(Preserved: the self-deployed UniV3 fork — see D-43 — enables fee=3000 / tickSpacing 60 by default, so this decision stands unchanged.)*
- **D-20:** **Seed at mainnet-like reference prices** (e.g., WMNT ≈ $0.60, mETH ≈ $3,200, WETH ≈ $3,200 at seed time) so the card's USD figures look real.
- **D-21:** **LP-seed via a Foundry script** (`script/SeedLiquidity.s.sol`); write resulting mock-token + pool addresses into `SequaConstants.sol`'s `TODO[Phase 1]` slots as the single source of truth (plus a small `addresses.json`/codegen artifact for the TypeScript runtime).
- **D-22:** **Idempotent seed script + admin top-up** via mock `mint` for <60s pool re-depth if a long session drains a pool.
- **D-23:** **Verify all 4 mock contracts on Mantle Explorer** so click-through from a `SignalRecorded` event to the swap tx hits clean verified contracts all the way down.
- **D-24:** **Ambient noise bot** (separate Node script + dedicated noise EOA) swaps small random amounts (~0.5–2% of pool depth) on a random pair every 1–3 min, so the momentum MAs actually cross. Pure utility, not part of the agent's identity or track record.

### Venue resolution (Phase 1 plan-phase amendment — user-approved 2026-06-10)
- **D-43:** **Self-deploy a canonical Uniswap V3 fork on Mantle Sepolia as Wave 0** (factory + NonfungiblePositionManager + SwapRouter + QuoterV2), alongside the 4 mock ERC-20s, because FusionX V3 is verifiably **not deployed on chain 5003** (the pinned Sepolia addresses return codesize 0 — see DEC-001 amendment + 01-RESEARCH.md Pitfall 1). The fork's `ISwapRouter.exactInputSingle` / `IQuoterV2` surface is identical to FusionX → **zero adapter code**, mirror engine and the D-07 signal tuple unaffected (CON-fusionx-router interface contract intact). The deployed venue addresses are written back into `SequaConstants.sol` / `addresses.json` as a **deploy-time output** — the dead FusionX Sepolia constants MUST NOT be used and venue addresses MUST NOT be hard-coded from stale docs. This Wave-0 deploy GATES all LP-seed (D-19/D-21), swap (D-25), and QuoterV2-read (D-02) work. Mainnet FusionX path is unchanged (Sepolia-only amendment, consistent with D-41).

### Agent identity, swap pattern + ERC-8004 timing
- **D-25:** **Real swaps, `recordSignal`-then-swap order.** Agent calls `SourceRegistry.recordSignal(agentId, abiEncode(swapParams))` first, then `SwapRouter.exactInputSingle` with the same params from the same EOA. Performance reconciles 1:1 to the agent EOA's on-chain swap history (satisfies REQ-06 AC).
- **D-26:** **Single "agent operator" EOA** holds capital + gas, registers the source (becomes `sources[agentId].owner`, gating `recordSignal` per Phase-0 D-08), and signs swaps. Key lives in `.env`, never committed.
- **D-27:** **Pull ERC-8004 identity mint up to Phase 1.** Call canonical Sepolia `IdentityRegistry.register(agentURI)` now, store the returned `agentId`, and pass it into `SourceRegistry.registerSource()`. Every Phase 1 signal is tied to a real on-chain ERC-8004 identity from signal #1. Phase 3 then owns only the reputation accrual loop. (Cost ~80–120k gas on L2 — trivial.)
- **D-28:** **`agentURI` = static GitHub-Pages JSON** (`{name, persona, strategy, startedAt, repo}`). Durable, portable, editable, no IPFS pinning on the demo critical path.
- **D-29:** **One-time max `approve(SwapRouter, type(uint256).max)`** on all 4 tokens at runtime startup. Keeps each signal a 2-tx flow (recordSignal + swap), not 3.
- **D-30:** **Swap-revert handling = on-chain `invalidateSignal(signalId, reason)` event.** If the matching swap reverts (e.g., slippage), the agent writes an on-chain marker so reconciliation + the Phase 4 timeline can honestly show "attempted X but reverted." "We don't hide misses."
- **D-31:** **Redeploy `SourceRegistry` to add `invalidateSignal` (+ the Phase 2 helpers below) and update `DEPLOYMENT.md`.** Phase 0 contract was explicitly skeleton/"NOT production-final." The deployment-award technical bar is cleared by *any* verified deployed AI-callable function on Mantle; the Phase 1 redeploy satisfies it identically. Phase 5 submission cites the Phase 1 address. `FollowRegistry` is **not** redeployed in Phase 1 (its Phase 2 changes belong with `SequaExecutor`).

### Track-record surface + Phase 2 hand-off
- **D-32:** **`SourceRegistry.performance()` stays minimal** — `(signalCount, lastSignalAt)`. The frontend (Phase 4) computes PnL/return/win-rate off-chain from `SignalRecorded` + `invalidateSignal` events + on-chain swap receipts. Contract stays small and cheap to verify; verifiability is intact because everything needed is on-chain.
- **D-33:** **Add a `signalAt(agentId, signalId)` view + a typed decoded-signal event** during the redeploy. The view returns stored signal bytes for re-parsing without log scans; the typed event emits ABI-decoded `tokenIn/tokenOut/...` alongside the opaque bytes so the Phase 2 mirror engine can index on indexed fields without decoding bytes in every handler.
- **D-34:** **Mirror-engine ordering invariant = best-effort.** Source emits `recordSignal` then swaps next tx; Phase 2 mirror engine listens for `SignalRecorded`, queues a follower swap with the same params, submits within ~30s. No on-chain ordering guarantee — the reconciler surfaces source vs follower fill prices side-by-side, which IS the verifiability story (CON-demo-moments #4 "live mirror side-by-side").

### Runtime hosting + acceptance + open-source
- **D-35:** **Host on always-on lightweight VPS / Railway / Fly**, polling every 30s, running continuously so signal history accumulates before the demo and survives the Sui Overflow attention split.
- **D-36:** **Boot the agent the moment Phase 1 wire-up passes smoke test** — target 2–5 days of continuous track record by the Phase 5 demo recording (the credibility move per PROJECT.md §5).
- **D-37:** **Thesis JSON written by the runtime to a public GitHub repo** (`theses/<agentId>/<signalId>.json`) via the agent's GitHub PAT; frontend reads via CDN-fronted `raw.githubusercontent.com`. Mitigate commit-flood with rolling/daily-rotated files.
- **D-38:** **Observability = structured stdout logs + `/healthz` (returns `lastSignalAt`/`lastTickAt`) + an external uptime pinger** (e.g., UptimeRobot free tier) alerting on Discord/Slack if `/healthz` goes stale. Catches the silent-VPS-dead scenario before demo day.
- **D-39:** **VPS failover = documented local-run fallback.** README documents "pull repo + `.env` + `npm run agent`" to boot a local agent in <3 min against the same operator EOA / same `SourceRegistry` / same `agentId` / same on-chain history. (User-selected Option 1; a cross-project arb-bot implementation note pasted alongside this answer was confirmed out of scope and discarded.)
- **D-40:** **Reconciliation CLI (`scripts/reconcile.ts`) is a Phase 1 deliverable AND its acceptance gate.** Walks `SignalRecorded` events, matches each to a settled `SwapRouter` swap by the agent EOA (same `tokenIn/tokenOut/amountIn`), reports `{matched, invalidated, orphan}`. **Phase 1 success criterion: reconciler reports 100% of non-invalidated signals matched.** Phase 4 reuses it behind the agent-card "Verify" button.
- **D-41:** **Mainnet deferred — Sepolia-only for Phase 1.** REQ-12 accepts testnet (DEC-006). Avoids burning real MNT on mock-token/LP work mainnet doesn't need; revisit in Phase 5.
- **D-42:** **Public repo + `RUN.md` reproducibility story.** Strategy rule, Claude system+user prompts, reconciler CLI, and `/healthz` all public; operator key in gitignored `.env`. `RUN.md` documents "spin up your own source agent against the same `SourceRegistry` with your own EOA and watch your signals interleave with ours on Explorer." End-to-end "verifiable agent" story.

### Claude's Discretion
- **Time budget / wave sequencing for Phase 1** — planner decides based on dependency analysis (workstreams: mocks+LP / SourceRegistry redeploy+ERC-8004 / Claude integration+thesis+reconciler / hosting+bootstrap). No pre-committed per-day split.
- Exact VPS provider (Railway vs Fly vs cheap VPS), exact poll interval within 30–60s, mock-token contract style, replay-harness test layout, thesis-file rotation scheme, ambient-noise randomization params, repo layout for the TS runtime.
- Exact callsign/persona copy (within D-12's momentum-trader constraint).
- `SequaConstants.sol` codegen vs `addresses.json` mechanism for feeding Sepolia addresses to the TypeScript runtime.

### Folded Todos
None. The one pending todo (`followregistry-itradeexecutor-anchor.md`) is explicitly `resolves_phase: 2` — it belongs with `SequaExecutor` / the `FollowRegistry` redeploy in Phase 2, and `FollowRegistry` is intentionally not touched in Phase 1 (D-31). Left in the pending queue.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked decisions + requirements (immutable)
- `.planning/intel/decisions.md` — DEC-001..DEC-006 (venue, pair set, executor pattern, ERC-8004 deployments + interface surface, prize/panel/dates).
- `PHASE-0-RESEARCH.md` — same six ADR decisions in narrative form; source of all addresses.
- `.planning/REQUIREMENTS.md` — REQ-01 (SourceRegistry full signal path + `performance` view) and REQ-06 (source agents) acceptance criteria; scope-cut lines.
- `.planning/intel/constraints.md` — CON-fusionx-router (single-hop `exactInputSingle` only), CON-smart-contract-stack (Foundry + verified on Mantle), CON-mirror-engine-stack (TypeScript `SignalRecorded` listener), CON-erc8004-interfaces (minimum Solidity surface), CON-ai-interaction (agents-as-characters), CON-anti-patterns (verified-on-chain badge mandatory).
- `.planning/ROADMAP.md` Phase 1 section — goal, success criteria, deliverables, contingency annotations.

### Phase 0 outputs Phase 1 builds on
- `.planning/phases/00-lock/00-CONTEXT.md` — D-07 signal-shape convention, D-08 access control (`msg.sender == owner`), D-09 reentrancy baseline; explicit "skeletons, NOT production-final" framing that authorizes the Phase 1 redeploy.
- `.planning/phases/00-lock/DEPLOYMENT.md` — deployment-award packet to UPDATE after the SourceRegistry redeploy.
- `deployments/sepolia.json` — current Sepolia addresses + the Phase 0 e2e test tx (fee=3000 precedent, executor-placeholder rationale).
- `src/SourceRegistry.sol` — the contract being redeployed/extended (add `invalidateSignal`, `signalAt`, typed event).
- `src/FollowRegistry.sol` — referenced for the Phase 2 hand-off; NOT modified in Phase 1.
- `src/config/SequaConstants.sol` — FusionX V3 Sepolia router/factory/QuoterV2 pins; `WETH_MAINNET` + all `*_SEPOLIA` token slots are `TODO[Phase 1]` to fill from the mock deploy.
- `src/interfaces/IIdentityRegistry.sol` — `register`/`getAgentWallet`/`ownerOf`; the live `register()` call lands here in Phase 1.
- `src/interfaces/IReputationRegistry.sol` — referenced (consumed in Phase 3, not Phase 1).
- `src/interfaces/ITradeExecutor.sol` — Phase 2 surface; informs the typed executor param but unused in Phase 1.

### Project framing (read for narrative + scoring alignment)
- `Sequa Project.md` §3.1–3.3 (contract + mirror-engine + source-agent stack), §5 (verifiability anchor — the whole Phase 1 credibility move), §10 (mirror-fidelity + regulatory-optics risks).
- `.planning/intel/context.md` — verifiability anchor, demo centerpiece, mirror-fidelity risk, scoring weights.

### External canonical (read-only references for addresses + signatures)
- FusionX V3 Mantle testnet docs: `https://docs.fusionx.finance/developers/smart-contracts-mantle-testnet/v3-smart-contracts` — SwapRouter / Factory / QuoterV2 ABIs + `exactInputSingle` params; pool creation + LP add flow for the seed script.
- ERC-8004 reference contracts: `https://github.com/erc-8004/erc-8004-contracts` — `IdentityRegistry.register` exact signature + return semantics.
- Mantle Sepolia Explorer: `https://sepolia.mantlescan.xyz/` — verification surface for the SourceRegistry redeploy + 4 mock tokens.
- Mantle Sepolia network params: Chain ID 5003, RPC `https://rpc.sepolia.mantle.xyz` (per `00-CONTEXT.md`).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SourceRegistry.sol` — `registerSource` / `recordSignal(agentId, bytes)` / `performance` already implemented as a skeleton with the D-07 signal convention and `SignalRecorded` event. Phase 1 extends it (add `invalidateSignal`, `signalAt`, typed decoded event) and redeploys.
- `SequaConstants.sol` — FusionX V3 Sepolia addresses already pinned and compile-verified; the EIP-55 checksum gotcha on WMNT is already solved. Phase 1 fills the `TODO[Phase 1]` Sepolia token slots.
- Phase 0 `DeployPhase0.s.sol` / `VerifyPhase0.sh` — deploy + verify patterns to mirror for the mock tokens, the SourceRegistry redeploy, and `SeedLiquidity.s.sol`.
- The Phase 0 e2e test tx (`deployments/sepolia.json`) establishes the `fee: 3000` + ABI-encoded `ExactInputSingleParams` payload precedent the agent's real signals follow.

### Established Patterns
- Foundry-first: `forge script` deploy, `forge verify-contract` against Mantle Explorer, addresses pinned in `SequaConstants.sol` as the single source of truth, manifest committed to `deployments/`. Phase 1 follows this for mocks + LP + redeploy.
- Access control: `Ownable` + `msg.sender == sources[agentId].owner` gate on `recordSignal` (D-08); `nonReentrant` on every state-changing function (D-09). New `invalidateSignal` must inherit both.
- Signal payload convention (D-07): `bytes` = ABI `(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)`. The agent runtime, reconciler, typed event, and Phase 2 engine all share this exact tuple.

### Integration Points
- `SourceRegistry.recordSignal` ← the Claude agent runtime (TypeScript) writes here for every trade.
- `IdentityRegistry.register` (canonical Sepolia `0x8004A818…BD9e`) ← called once in Phase 1 to mint the agent's `agentId`.
- FusionX V3 `SwapRouter.exactInputSingle` (Sepolia `0x8fC0…6E36`) ← the agent's real swaps + the ambient-noise bot + the LP-seed script.
- `SignalRecorded` / typed decoded event ← consumed by the reconciler CLI now and the Phase 2 mirror engine + Phase 4 frontend later.
- `SequaConstants.sol` Sepolia token slots ← consumed by Phase 2 `SequaExecutor` whitelist + the TS runtime.
</code_context>

<specifics>
## Specific Ideas

- The reconciler's `{matched, invalidated, orphan}` report is both the Phase 1 acceptance artifact and the literal mechanism behind the Phase 4 "verified on-chain" badge — the same code reused, not reimplemented (D-40).
- "We don't hide misses": surfacing reverted attempts on-chain via `invalidateSignal` is a deliberate verifiability flex for the institutional panel (Hashed/Caladan), not just error handling (D-30).
- The agent should have been running for days, not minutes, when the demo records — a thin track record visibly undercuts the entire "track record nobody can fake" thesis (D-36).
- Full-range LP + mainnet-like seed prices + an ambient-noise bot together make the Sepolia pools behave enough like a real market that the momentum strategy fires organically and the card's USD numbers look credible (D-19, D-20, D-24).
</specifics>

<deferred>
## Deferred Ideas

- **`SequaExecutor.sol` + scoped-allowance mirror execution, follower-side mirror engine** → Phase 2. The best-effort ordering invariant (D-34) and the typed decoded event (D-33) are the Phase 1→2 hand-off contract.
- **Resolve the `ITradeExecutor` unused-import lint in `FollowRegistry.sol`** → Phase 2 (pending todo `followregistry-itradeexecutor-anchor.md`, `resolves_phase: 2`). `FollowRegistry` is intentionally untouched in Phase 1.
- **Live ERC-8004 reputation accrual** (`giveFeedback` from follower address + `getSummary` + `clientAddresses[]` allowlist strategy) → Phase 3. Phase 1 mints the identity only.
- **Agent card / leaderboard / "Verify" button UI** → Phase 4 (reuses the Phase 1 reconciler CLI).
- **Mainnet deployment + real-asset trading** → Phase 5 ship (if at all). Phase 1 is Sepolia + mocks.
- **Multiple source agents** → out of scope by scope-cut #1; one strong verifiable source is the Phase 1 (and ship-core) target.

### Reviewed Todos (not folded)
- `followregistry-itradeexecutor-anchor.md` — reviewed; not folded. `resolves_phase: 2`, requires touching `FollowRegistry`/`SequaExecutor` which Phase 1 deliberately leaves alone (D-31).

</deferred>

---

*Phase: 01-source-signals*
*Context gathered: 2026-06-09*
