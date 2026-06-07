# Phase 0: Lock — Context

**Gathered:** 2026-06-07
**Status:** Ready for planning
**Source:** Synthesized from PHASE-0-RESEARCH.md (ADR-LOCKED) + ROADMAP.md Phase 0 + REQUIREMENTS.md REQ-01/02/12. No `/gsd-discuss-phase` round-trip — Phase 0 work is already over-specified by the locked ADR and the unusually concrete roadmap entry.

<domain>
## Phase Boundary

**Goal:** Clear the 20 Project Deployment Award technical bar by end of Day 1 (2026-06-07 → 2026-06-08) — deployed + verified contracts on Mantle Sepolia with at least one AI-callable on-chain function visible on Mantle Explorer.

**In scope (Phase 0 only):**
- Foundry project scaffold
- Skeleton `SourceRegistry.sol` (registers source agent, emits `SignalRecorded`, exposes `performance` view)
- Skeleton `FollowRegistry.sol` (`mirror`, `unmirror`, `followersOf`, `following`)
- Skeleton `IIdentityRegistry` and `IReputationRegistry` interfaces wired from canonical ERC-8004 surface (DEC-005)
- Deploy both contracts to Mantle Sepolia; verify both on Mantle Explorer
- Execute one trivial end-to-end `recordSignal → mirror` test transaction from a test wallet
- Capture all addresses and tx hashes in a deployment manifest committed to the repo, ready to paste into the DoraHacks submission

**Explicitly NOT in scope (deferred to later phases):**
- Real source-agent logic and live trading (→ Phase 1)
- `SequaExecutor.sol` with scoped allowance enforcement (→ Phase 2)
- Mirror engine daemon listening to `SignalRecorded` (→ Phase 2)
- Live ERC-8004 identity minting and reputation accrual (→ Phase 3)
- Frontend (→ Phase 4)

Phase 0 contracts are SKELETONS — they exist to clear the deployment-award bar with a verifiable AI-callable function path, NOT to be production-final.

</domain>

<decisions>
## Implementation Decisions

All six decisions below are LOCKED ADR-level — inherited from PHASE-0-RESEARCH.md and reflected in `.planning/intel/decisions.md`. The planner MUST honor them.

### Toolchain
- **D-01 (LOCKED):** Use Foundry as the contract toolchain. Solidity 0.8.x. Forge for tests. Forge script for deploys. Cast for verification + tx submission. Rationale: zero runtime dependencies, fastest deploy cycle, best Mantle Explorer verification path.

### Trading venue and pair set (DEC-001, DEC-002)
- **D-02 (LOCKED):** Mantle DEX target = FusionX V3 SwapRouter on Mantle Sepolia at `0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36`. Pin this address as a constant in the codebase.
- **D-03 (LOCKED):** Pair set = WMNT/USDC, mETH/USDC, WETH/USDC. Single-hop only via `ISwapRouter.exactInputSingle`. Address pins live in a config module.
- **NOTE for Phase 0:** the swap router is REFERENCED for compilation/type-correctness only — actual swap calls are Phase 2 work. Phase 0 contracts just need the address constant in place so Phase 1/2 can flip them on.

### Executor pattern (DEC-003)
- **D-04 (LOCKED):** Mirror executor pattern = scoped per-token ERC-20 allowance via a future `SequaExecutor.sol`. Phase 0 produces the `ITradeExecutor` INTERFACE only (so `FollowRegistry.mirror(sourceId, capital, executor)` has a typed executor parameter); the implementation is Phase 2. The interface must surface `executeTrade(address follower, bytes signal)` and a `kill()` switch hook at minimum.

### ERC-8004 (DEC-004, DEC-005)
- **D-05 (LOCKED):** Use canonical ERC-8004 deployments on Mantle. Sepolia IdentityRegistry = `0x8004A818BFB912233c491871b3d84c89A494BD9e`. Sepolia ReputationRegistry = `0x8004B663056A597Dffe9eCcC1965A193B7388713`. DO NOT redeploy. Pin both addresses as constants.
- **D-06 (LOCKED):** Phase 0 ERC-8004 surface = INTERFACES ONLY, not live calls. Define `IIdentityRegistry` with `register(string)/getAgentWallet/ownerOf` and `IReputationRegistry` with `giveFeedback(...)/getSummary(...)` per DEC-005 signatures. `SourceRegistry.registerSource` accepts an `agentId` parameter and STORES it (no Identity Registry call yet); the live `register()` call is Phase 1.

### Signal shape (technical choice locked here to unblock Phase 1)
- **D-07 (LOCKED):** `recordSignal(uint256 agentId, bytes signal)` — `bytes signal` is opaque to the contract in Phase 0. Convention for downstream: ABI-encoded `(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)` matching FusionX V3 `ExactInputSingleParams`. The contract MUST emit `SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp)` so the Phase 2 mirror engine has an indexable, parseable event stream.

### Access control (security baseline — see threat_model gate)
- **D-08 (LOCKED):** Source-side writes (`recordSignal`) gated by `msg.sender == sources[agentId].owner`. `mirror`/`unmirror` callable by anyone (caller is the follower). Owner of each contract = deployer EOA for Phase 0; ownership transfer to a multisig is a hackathon-out-of-scope cleanup.
- **D-09 (LOCKED):** Reentrancy guards on every state-changing function (OpenZeppelin `ReentrancyGuard`) — defensive baseline since downstream phases will call external routers from these paths.

### Deployment-award packet content
- **D-10 (LOCKED):** The deployment manifest committed at Phase 0 close MUST include: contract address per deployed contract on Sepolia, Mantle Explorer verification URL per contract, the deployment tx hash, the trivial end-to-end `recordSignal → mirror` test tx hash, and a short paragraph naming `recordSignal → mirror` as the AI-callable on-chain function (the deployment-award requirement). This is the literal text that gets pasted into DoraHacks.

### Claude's Discretion
- Repo layout, file naming, OpenZeppelin version pin, Foundry version pin, the exact `forge script` deploy pattern, test fixture style. Use modern Foundry idioms (`forge install`, `forge soldeer` is acceptable, `vm.envAddress` for RPC config).
- How to handle WMNT/USDC test liquidity on Sepolia — Phase 0 doesn't need swaps to work, just the constants in place.
- Whether to use a single-file scaffold or split per-contract — Claude picks whatever ships fastest given the 8-day clock.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase-0 inputs (immutable)
- `PHASE-0-RESEARCH.md` — All LOCKED ADR decisions (DEC-001..DEC-006). Source of truth for venue, pair set, executor pattern, ERC-8004 deployment addresses, prize/panel/dates.
- `.planning/intel/decisions.md` — Same six decisions in the GSD intel format.
- `.planning/intel/constraints.md` — Cross-cutting constraints (CON-fusionx-router single-hop only, accessibility/motion contracts for later phases, deployment-award bar specifics).
- `.planning/REQUIREMENTS.md` — Acceptance criteria for REQ-01 (SourceRegistry), REQ-02 (FollowRegistry), REQ-12 (Deployment Award bar).
- `.planning/ROADMAP.md` Phase 0 section — Enumerated Day-1 deliverables and success criteria.

### Project-level inputs
- `Sequa Project.md` §3.1 — Contract surface descriptions (registerSource, recordSignal, performance, mirror, unmirror, followersOf, following) — Phase 0 MUST match these signatures or the downstream code breaks.
- `Sequa Project.md` §9 — Deployment-award checklist; this is what gets submitted.

### External canonical (read-only references for signatures and addresses)
- ERC-8004 reference contracts: `https://github.com/erc-8004/erc-8004-contracts` — for `IIdentityRegistry` and `IReputationRegistry` exact signatures.
- FusionX V3 testnet docs: `https://docs.fusionx.finance/developers/smart-contracts-mantle-testnet/v3-smart-contracts` — for SwapRouter and Factory addresses (only the constants land in Phase 0).
- Mantle Sepolia Explorer: `https://sepolia.mantlescan.xyz/` — verification surface.

</canonical_refs>

<specifics>
## Specific Ideas

### Day-1 deliverable enumeration (from ROADMAP.md Phase 0)
1. Foundry project scaffold; `IIdentityRegistry` + `IReputationRegistry` interfaces from DEC-005 wired in.
2. Skeleton `SourceRegistry.sol` with `registerSource`, `recordSignal` (emits `SignalRecorded`), `performance` view.
3. Skeleton `FollowRegistry.sol` with `mirror`, `unmirror`, `followersOf`, `following`.
4. Deploy both to Mantle Sepolia; verify both on Mantle Explorer.
5. Trivial end-to-end `recordSignal → mirror` transaction submitted from a test wallet; tx hash captured for the deployment-award submission packet.

### Mantle Sepolia network parameters
- Chain ID: 5003 (per ChainList)
- RPC URL: `https://rpc.sepolia.mantle.xyz`
- Explorer: `https://sepolia.mantlescan.xyz`
- Faucet: dev needs Sepolia MNT — bridge from Ethereum Sepolia or use the public Mantle Sepolia faucet
- **MNT is the native gas token**; mainnet uses real MNT, Sepolia uses test MNT
- Verification on Mantle Explorer typically uses Etherscan-compatible verification via `forge verify-contract` with the Mantle Explorer API URL

### Gas note
- Mantle Sepolia gas behaves like ETH (L2) but estimates can be unreliable. `forge` deploys should bump gas limit ~2x on first attempt. This is documented in DEC-002 gotchas.

</specifics>

<deferred>
## Deferred Ideas

- Multisig ownership transfer for contracts (Phase 0 owner = deployer EOA; out of hackathon scope).
- Upgradeable contract patterns (UUPS/Diamond). Phase 0 contracts are not upgradeable; redeployment is the upgrade path. Scope decision.
- Gas-optimized struct packing. Not worth the time in 8 days; revisit if Phase 4 polish leaves spare cycles.
- Subgraph indexing for `SignalRecorded`. Phase 2 mirror engine can index directly via ethers/viem `eth_getLogs` polling. Subgraph is a Sui-Overflow-recovery-week task.

</deferred>

---

*Phase: 00-lock*
*Context synthesized: 2026-06-07 (auto mode — no discuss-phase round-trip)*
