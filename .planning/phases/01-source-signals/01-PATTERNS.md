# Phase 1: source-signals - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 22 (10 Solidity/Foundry, 9 TypeScript, 3 deploy manifests/docs)
**Analogs found:** 9 in-repo exact/role-match + 13 mapped to RESEARCH/AI-SPEC reference patterns (greenfield TS + UniV3 fork have no in-repo analog by design)

> **Project setup confirmed (per orchestrator instruction):** No `CLAUDE.md` at repo root. No `.claude/skills/` or `.agents/skills/` (only `.claude/settings.local.json` + `.claude/worktrees/`). No `agent/` directory yet — the TypeScript workspace is fully greenfield. No UniV3 periphery vendored in `lib/` (only `forge-std` + `openzeppelin-contracts`). Proceeding with repo conventions inferred directly from the Phase 0 Solidity/Foundry files.

> **Two-track mapping.** The Solidity/Foundry track has strong, recent in-repo analogs (the Phase 0 deploy/verify/test/contract files) — copy those. The TypeScript `agent/` track and the D-43 UniV3-fork deploy have **no in-repo analog** and are mapped explicitly to `01-RESEARCH.md` Patterns 1-5 / Code Examples and `01-AI-SPEC.md` §3-4 as the reference excerpts. The planner MUST use those references, not force a weak repo analog.

---

## File Classification

### Solidity / Foundry (repo root)

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/SourceRegistry.sol` (EXTEND) | model/registry contract | event-driven (state-changing + event emit) | itself (Phase 0 functions) + `src/FollowRegistry.sol` | exact (same file) |
| `src/mocks/MockERC20.sol` (NEW) | model (token) | CRUD (mint/transfer) | `lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol` | role-match (OZ base) |
| `src/config/SequaConstants.sol` (EXTEND) | config | n/a (constants) | itself (existing pinned constants) | exact (same file) |
| `script/DeployMocks.s.sol` (NEW) | script (deploy) | batch (deploy + mint) | `script/DeployPhase0.s.sol` | role-match |
| `script/DeploySourceRegistryV1.s.sol` (NEW) | script (deploy) | batch (deploy) | `script/DeployPhase0.s.sol` | exact (redeploys the same contract type) |
| `script/DeployUniV3Fork.s.sol` (NEW, D-43) | script (deploy) | batch (deploy periphery) | `script/DeployPhase0.s.sol` (env+broadcast shell only) | partial (no UniV3 deploy analog in repo — see No Analog) |
| `script/SeedLiquidity.s.sol` (NEW) | script (deploy/seed) | batch (pool create + LP mint) | `script/DeployPhase0.s.sol` + RESEARCH Pattern 1 | partial (shell from Phase 0; call sequence from RESEARCH) |
| `script/VerifyPhase1.sh` (NEW) | script (verify) | request-response (verify API) | `script/VerifyPhase0.sh` | exact |
| `test/SourceRegistry.t.sol` (EXTEND) | test | event-driven (assert emit + view) | itself (Phase 0 tests) | exact (same file) |

### TypeScript — greenfield `agent/` workspace (NO in-repo analog)

| New File | Role | Data Flow | Reference Pattern (no repo analog) |
|----------|------|-----------|------------------------------------|
| `agent/src/strategy/maCrossover.ts` | strategy core (pure) | transform (price series → decision) | RESEARCH Architecture diagram + D-02/D-03; AI-SPEC §4 "pure deterministic core" |
| `agent/src/signals/types.ts` | model (types) | n/a (type defs) | RESEARCH Pattern 3 (5-field tuple); AI-SPEC §3 `Signal` interface |
| `agent/src/narration/client.ts` | provider (singleton) | request-response | AI-SPEC §3 "Entry Point Pattern" (client singleton) |
| `agent/src/narration/persona.ts` | config (prompt) | n/a | AI-SPEC §3 `PERSONA_SYSTEM_PROMPT` + §4b few-shot |
| `agent/src/narration/narrateSignal.ts` | service (AI call) | request-response | AI-SPEC §3 `narrateSignal` + §4 `narrateSignalSafe` |
| `agent/src/narration/thesisSchema.ts` | utility (validation) | transform | AI-SPEC §4b Zod `thesisSchema` |
| `agent/src/narration/fallback.ts` | utility | transform (signal → text) | AI-SPEC §4/§6 `fallbackThesis` |
| `agent/src/chain/quote.ts` | service (chain read) | request-response (simulate) | RESEARCH Pattern 2 (QuoterV2 simulate) |
| `agent/src/chain/recordSignal.ts` | service (chain write) | event-driven (2-tx hot path) | RESEARCH Pattern 3 (`recordSignal`-then-swap) |
| `agent/src/chain/reconcile-shared.ts` | utility (shared codec) | transform (tuple encode/decode) | RESEARCH Pattern 3/4 (shared tuple, write once) |
| `agent/src/store/thesisStore.ts` | store | file-I/O (write JSON + git push) | RESEARCH diagram (theses/<agentId>/<signalId>.json); D-09/D-37 |
| `agent/src/health.ts` | service (endpoint) | request-response (`/healthz`) | RESEARCH State Inventory + D-38 |
| `agent/src/index.ts` | controller (poll loop) | event-driven (30s tick) | RESEARCH Architecture diagram; AI-SPEC §4 `handleSignal` |
| `agent/scripts/registerIdentity.ts` | script (one-shot) | request-response (chain write) | RESEARCH Pattern 5 (ERC-8004 register) |
| `agent/scripts/reconcile.ts` | CLI (acceptance gate) | batch (getLogs ⨝ swaps) | RESEARCH Pattern 4 (reconciliation) |
| `agent/scripts/noiseBot.ts` | script (separate EOA) | event-driven (random swaps) | RESEARCH Pattern 3 (swap call) + D-24 |
| `agent/test/strategy.replay.test.ts` | test | transform (replay canned series) | AI-SPEC §5 replay; mirrors `test/SourceRegistry.t.sol` discipline (Foundry → vitest) |
| `agent/eval/` (fixtures + promptfooconfig) | test/eval | batch | AI-SPEC §5 Reference Dataset + Eval Tooling |

### Deploy manifests / docs (UPDATE)

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `deployments/sepolia.json` (UPDATE) | config/manifest | n/a | itself (current Phase 0 content) | exact |
| `.planning/phases/00-lock/DEPLOYMENT.md` (UPDATE) | doc | n/a | itself (current Phase 0 content) | exact |

---

## Pattern Assignments

### `src/SourceRegistry.sol` (model/registry, event-driven) — EXTEND + REDEPLOY (D-31/D-33)

**Analog:** itself (existing Phase 0 functions, `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\src\SourceRegistry.sol`) — copy the existing inheritance, the owner-gate idiom, and the `recordSignal` body shape. RESEARCH "Code Examples §SourceRegistry extensions" gives the exact new members.

**Imports + inheritance pattern** (lines 1-12) — copy verbatim; new members inherit the SAME `Ownable + ReentrancyGuard`:
```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract SourceRegistry is Ownable, ReentrancyGuard {
```

**Owner-gate idiom to COPY into `invalidateSignal`** (lines 54-56, from `recordSignal`):
```solidity
Source storage s = sources[agentId];
if (!s.registered) revert SourceNotRegistered(agentId);
if (s.owner != msg.sender) revert NotSourceOwner(agentId, msg.sender);
```
This is the D-08 access-control gate. `invalidateSignal` MUST reuse it (CONTEXT code_context: "New `invalidateSignal` must inherit both" Ownable+nonReentrant).

**Event-emit + signalId-advance pattern to PRESERVE** (lines 58-62) — `recordSignal` keeps this body; the typed `SignalDecoded` event is emitted ALONGSIDE the existing `SignalRecorded` (RESEARCH Assumption A4: additive, never replace `SignalRecorded`):
```solidity
unchecked { s.signalCount += 1; }
signalId = s.signalCount;
s.lastSignalAt = uint64(block.timestamp);
emit SignalRecorded(agentId, signalId, signal, uint64(block.timestamp));
```

**New members to ADD** (source: RESEARCH lines 421-451 — the canonical extension spec):
```solidity
mapping(uint256 agentId => mapping(uint256 signalId => bytes)) private _signalData;        // for signalAt() (D-33)
mapping(uint256 agentId => mapping(uint256 signalId => bool)) public invalidated;

event SignalDecoded(                                                                         // typed event (D-33)
    uint256 indexed agentId, uint256 indexed signalId,
    address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee
);
event SignalInvalidated(uint256 indexed agentId, uint256 indexed signalId, string reason, uint64 timestamp);

function invalidateSignal(uint256 agentId, uint256 signalId, string calldata reason) external nonReentrant {
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
**Keep `performance()` minimal** `(signalCount, lastSignalAt)` per D-32 — do NOT add PnL on-chain. Index `agentId, signalId, tokenIn` on `SignalDecoded` (RESEARCH Open Q3). Decode the D-07 5-field tuple inside `recordSignal` to populate `_signalData` + emit `SignalDecoded`; guard the typed emit if bytes are non-conforming (RESEARCH line 435).

---

### `src/mocks/MockERC20.sol` (model/token, CRUD) — NEW (D-17/D-18)

**Analog:** OpenZeppelin `ERC20` base at `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\lib\openzeppelin-contracts\contracts\token\ERC20\ERC20.sol`, imported via the repo's existing remapping (`remappings.txt`: `@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/`). The exact mock shape is in RESEARCH lines 453-463.

**Import + contract pattern** (RESEARCH lines 455-462; uses the SAME `@openzeppelin/contracts/` remapping as `SourceRegistry.sol` line 4):
```solidity
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;
    constructor(string memory n, string memory s, uint8 d) ERC20(n, s) { _dec = d; }
    function decimals() public view override returns (uint8) { return _dec; }
    function mint(address to, uint256 amount) external { _mint(to, amount); } // public per D-17
}
```
**Decimals (D-18):** MockUSDC = 6; MockWMNT / MockMETH / MockWETH = 18. **Pragma/SPDX header** copy from `SourceRegistry.sol` lines 1-2 (`// SPDX-License-Identifier: MIT` / `pragma solidity ^0.8.20;`).

---

### `src/config/SequaConstants.sol` (config) — EXTEND (D-21/D-43)

**Analog:** itself. The file already has the exact TODO slots to fill (`C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\src\config\SequaConstants.sol`).

**Fill these commented TODO slots** (lines 52, 59-62) with deploy-time outputs:
```solidity
// line 52:  // address internal constant WETH_MAINNET = 0x...; // PINNED IN PHASE 1
// lines 59-62:
// address internal constant WMNT_SEPOLIA = 0x...; // PINNED IN PHASE 1
// address internal constant METH_SEPOLIA = 0x...; // PINNED IN PHASE 1
// address internal constant WETH_SEPOLIA = 0x...; // PINNED IN PHASE 1
// address internal constant USDC_SEPOLIA = 0x...; // PINNED IN PHASE 1
```
**Pattern to FOLLOW for new constants** (lines 38, 41 — EIP-55-checksummed `address internal constant`):
```solidity
address internal constant WMNT_MAINNET = 0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8;
```
**CRITICAL — D-43 anti-pattern (RESEARCH line 337):** the FusionX V3 Sepolia addresses currently pinned at lines 13-15 (`FUSIONX_V3_*_SEPOLIA`) are DEAD on chain 5003. Do NOT add hard-coded venue addresses copied from stale docs. Make the self-deployed UniV3-fork venue (factory/router/quoterV2/NPM) a **deploy-time input written back** by the deploy script — add new Sepolia venue slots that the D-43 fork deploy fills, and mark the dead FusionX Sepolia constants as not-for-use. Use the fork's actual enabled fee tier (D-43 enables fee=3000 / tickSpacing 60 by default).

---

### `script/DeploySourceRegistryV1.s.sol` (script/deploy, batch) — NEW (D-31)

**Analog:** `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\script\DeployPhase0.s.sol` — exact match (it already deploys `SourceRegistry`).

**Full deploy-script skeleton to COPY** (`DeployPhase0.s.sol` lines 1-30 — env-key read, `startBroadcast`/`stopBroadcast`, `console2.log` address output):
```solidity
import {Script, console2} from "forge-std/Script.sol";
import {SourceRegistry} from "../src/SourceRegistry.sol";
contract DeploySourceRegistryV1 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);
        SourceRegistry sourceRegistry = new SourceRegistry();   // redeployed extended contract
        vm.stopBroadcast();
        console2.log("SourceRegistry:", address(sourceRegistry));
        console2.log("Deployer:", vm.addr(deployerKey));
    }
}
```
Run invocation comment to copy from `DeployPhase0.s.sol` lines 11-14 (`forge script ... --rpc-url mantle_sepolia --broadcast --slow`). Do NOT redeploy `FollowRegistry` (D-31).

---

### `script/DeployMocks.s.sol` (script/deploy, batch) — NEW (D-11/D-17)

**Analog:** `DeployPhase0.s.sol` (same env-read + broadcast shell). Adds a deploy-loop over the 4 mocks + a `mint` to the operator EOA.

**Reuse** the `vm.envUint("DEPLOYER_PRIVATE_KEY")` + `startBroadcast`/`stopBroadcast` + `console2.log` skeleton above. Deploy `MockERC20("USD Coin","mUSDC",6)`, `("Wrapped MNT","mWMNT",18)`, `("Mantle ETH","mMETH",18)`, `("Wrapped ETH","mWETH",18)` (D-18), then `mint(operator, 10_000e6)` mUSDC (D-11). Log all 4 addresses for `deployments/sepolia.json` + the `SequaConstants.sol`/`addresses.json` write-back (D-21).

---

### `script/SeedLiquidity.s.sol` (script/deploy-seed, batch) — NEW (D-19/D-21/D-22)

**Analog (shell only):** `DeployPhase0.s.sol` env+broadcast wrapper. **Call sequence (NO in-repo analog):** RESEARCH Pattern 1 (lines 238-260).

**Exact UniV3 call sequence to follow** (RESEARCH Pattern 1):
```
1. INonfungiblePositionManager.createAndInitializePoolIfNecessary(token0, token1, fee, sqrtPriceX96)  // idempotent → D-22
2. token0.approve(NPM, amount0); token1.approve(NPM, amount1);
3. INonfungiblePositionManager.mint(MintParams{ token0, token1, fee, tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min:0, amount1Min:0, recipient, deadline })
```
**Full-range ticks** must be multiples of `tickSpacing` (RESEARCH lines 246-252; fee=3000 → tickSpacing 60 → -887220/+887220). **`sqrtPriceX96`** — use a tested `encodePriceSqrt` helper, account for the 6-vs-18 decimal gap and `token0 = min(addr)` ordering (RESEARCH Pattern 1 + Pitfall 3 + Don't-Hand-Roll table line 349). Seed at D-20 reference prices.

---

### `script/DeployUniV3Fork.s.sol` (script/deploy, batch) — NEW (D-43)

**Analog:** `DeployPhase0.s.sol` ONLY for the env-read + `startBroadcast`/`stopBroadcast`/`console2.log` shell. The periphery deploy itself (factory + NonfungiblePositionManager + SwapRouter + QuoterV2) has **no in-repo analog** — see "No Analog Found". Map to standard UniV3 periphery deploy; the deployed addresses are written back to `SequaConstants.sol`/`addresses.json` as deploy-time output (D-43, RESEARCH Pitfall 1 option 2). This GATES SeedLiquidity / swap / quote work (Wave 0).

---

### `script/VerifyPhase1.sh` (script/verify, request-response) — NEW (D-23/D-31)

**Analog:** `C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\script\VerifyPhase0.sh` — exact match. Mirror it for the 4 mocks + the redeployed registry.

**Bash header + API-key guard + jq-address-read pattern** (`VerifyPhase0.sh` lines 1-20) — copy verbatim:
```bash
set -euo pipefail
if [ -z "${MANTLESCAN_API_KEY:-}" ]; then
  echo "MANTLESCAN_API_KEY not set; run \`set -a; source .env; set +a\` first." >&2
  exit 1
fi
SOURCE_ADDR=$(jq -r '.contracts.sourceRegistry.address' deployments/sepolia.json)
```

**Etherscan V2 verify invocation** (`VerifyPhase0.sh` lines 28-38) — copy the URL + flags verbatim (RESEARCH Pitfall 4 — must use V2 unified endpoint with `chainid` in URL):
```bash
VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=5003"
forge verify-contract "${ADDR}" src/mocks/MockERC20.sol:MockERC20 \
  --chain 5003 --verifier etherscan --verifier-url "${VERIFIER_URL}" \
  --etherscan-api-key "${MANTLESCAN_API_KEY}" --watch
```
This matches `foundry.toml` lines 19-20 `[etherscan]` block. MockERC20 needs constructor-arg encoding (`--constructor-args`) since each mock differs by name/symbol/decimals — that is the ONE addition over the Phase 0 zero-arg verify.

---

### `test/SourceRegistry.t.sol` (test, event-driven) — EXTEND

**Analog:** itself (`C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\test\SourceRegistry.t.sol`) — copy the test idioms for the new `invalidateSignal`/`signalAt`/`SignalDecoded` coverage.

**Event-mirror + `vm.expectEmit` pattern** (lines 14-15, 57-62) — declare the new `SignalInvalidated`/`SignalDecoded` events on-test and assert with `vm.expectEmit(true,true,false,true, address(registry))`:
```solidity
event SignalRecorded(uint256 indexed agentId, uint256 indexed signalId, bytes signal, uint64 timestamp);
...
vm.warp(1_750_000_000);
vm.expectEmit(true, true, false, true, address(registry));
emit SignalRecorded(AGENT_ID, 1, signal, uint64(1_750_000_000));
vm.prank(alice);
uint256 signalId = registry.recordSignal(AGENT_ID, signal);
```

**Revert-assertion pattern for the owner gate** (lines 69-76) — reuse for `invalidateSignal` non-owner/unregistered cases:
```solidity
vm.expectRevert(abi.encodeWithSelector(SourceRegistry.NotSourceOwner.selector, AGENT_ID, bob));
vm.prank(bob);
registry.recordSignal(AGENT_ID, hex"deadbeef");
```

**The canonical D-07 5-field signal tuple** to reuse in fixtures (lines 48-54) — this is the SAME tuple the TS runtime, reconciler, and `SignalDecoded` event share:
```solidity
bytes memory signal = abi.encode(
    address(0x1111...),  // tokenIn
    address(0x2222...),  // tokenOut
    uint256(1e18),       // amountIn
    uint256(9e17),       // minAmountOut
    uint24(3000)         // fee
);
```
Add: a `signalAt` round-trip assertion (record → `signalAt` returns the same bytes) and a `SignalDecoded` topic assertion (indexed `tokenIn`).

---

### `agent/` TypeScript runtime (NO in-repo analog — map to RESEARCH / AI-SPEC)

> The entire `agent/` workspace is greenfield. There is no existing TypeScript in the repo. The planner MUST use the reference excerpts below verbatim as the pattern source, not a repo analog.

**`agent/src/narration/client.ts` + `narrateSignal.ts`** — Reference: **AI-SPEC §3 "Entry Point Pattern"** (lines 160-211). Module-level singleton `new Anthropic({ apiKey, maxRetries: 2, timeout: 8_000 })`; `claude-haiku-4-5`, `max_tokens: 120`, `temperature: 0.7`; persona in `system`, signal facts in the user turn; read `msg.content[0]` after a `block.type === 'text'` guard. **`narrateSignalSafe` wrapper** (try → Zod parse → one retry → `fallbackThesis`, never throws): AI-SPEC §4 lines 309-329.

**`agent/src/narration/persona.ts`** — Reference: AI-SPEC §3 `PERSONA_SYSTEM_PROMPT` (lines 174-179) + §4b inline few-shot examples (lines 380-386). One confident momentum-trader voice (D-08); "narrate, don't decide; never invent prices/PnL/guarantees."

**`agent/src/narration/thesisSchema.ts`** — Reference: AI-SPEC §4b Zod schema (lines 348-361). `z.string().trim().min(15).max(280).refine(t => !/[\{\}`]/.test(t))`.

**`agent/src/narration/fallback.ts`** — Reference: AI-SPEC §4/§6. Deterministic, on-persona, **fidelity-correct-by-construction** placeholder generated from the signal payload (§6 signal-fidelity gate).

**`agent/src/chain/quote.ts`** — Reference: **RESEARCH Pattern 2** (lines 262-281). QuoterV2 is NON-VIEW — use viem `simulateContract` (`functionName: 'quoteExactInputSingle'`, params struct `{tokenIn,tokenOut,amountIn,fee,sqrtPriceLimitX96:0n}`); selector `0xc6a5026a`. Persist the raw price series for replay (D-02). Anti-pattern: never `readContract` it (Pitfall 2).

**`agent/src/chain/recordSignal.ts`** — Reference: **RESEARCH Pattern 3** (lines 283-311). THE HOT PATH. Two-tx flow from the operator EOA: (1) `recordSignal(agentId, encoded5FieldTuple)` → wait receipt → decode `signalId` from `SignalRecorded`; (2) `exactInputSingle` with the 8-field router struct derived from the 5-field tuple (`recipient=operator, deadline=now+buffer, sqrtPriceLimitX96=0`, selector `0x414bf389` WITH deadline). On swap revert → `invalidateSignal(agentId, signalId, reason)` (D-30). One-time max approve at startup (D-29). **Critical:** 5-field signal tuple ≠ 8-field router struct (RESEARCH Pattern 3 + anti-pattern line 340).

**`agent/src/chain/reconcile-shared.ts`** — Reference: RESEARCH Pattern 3/4 (lines 291-294, 323). The `encodeAbiParameters`/decode of the 5-field tuple lives here ONCE, imported by BOTH the runtime and `scripts/reconcile.ts` (D-40 "same code reused, not reimplemented").

**`agent/src/strategy/maCrossover.ts`** — Reference: RESEARCH Architecture diagram (lines 188-192) + D-02/D-03. PURE function: `shortMA(5)` vs `longMA(20)` over the price series → `BUY|SELL|HOLD`. Replay-testable; holds no I/O. Edge cases D-13/D-14/D-15 (skip+log, no signal); D-16 serial emit in fixed pair order (WMNT, mETH, WETH).

**`agent/src/signals/types.ts`** — Reference: AI-SPEC §3 `Signal` interface (lines 182-189) + RESEARCH Pattern 3 5-field tuple. The shared signal shape across strategy, narration, chain, reconciler.

**`agent/src/store/thesisStore.ts`** — Reference: RESEARCH diagram (line 209) + D-09/D-37. Write `theses/<agentId>/<signalId>.json`, git push via PAT, rolling/daily-rotated files. Off-chain; never read back into a prompt (AI-SPEC §4 State Management).

**`agent/src/health.ts`** — Reference: RESEARCH State Inventory + D-38. `/healthz` returns `{ lastSignalAt, lastTickAt }`.

**`agent/src/index.ts`** — Reference: AI-SPEC §4 `handleSignal` (lines 288-306) + RESEARCH diagram. 30s poll loop; ORDER = deterministic decision → on-chain `recordSignalThenSwap` (await, hot path) → `void narrateAndStore(...)` (fire-and-store, NEVER awaited).

**`agent/scripts/registerIdentity.ts`** — Reference: **RESEARCH Pattern 5** (lines 325-334). One-shot `IdentityRegistry.register(agentURI)` against canonical Sepolia `0x8004A818BFB912233c491871b3d84c89A494BD9e`; capture the returned agentId from the `Transfer`/`Registered` event (DO NOT assume `1` — Pitfall 6); persist to `addresses.json`/`.env`; thread into `registerSource`. Interface shape: `src/interfaces/IIdentityRegistry.sol` (`register(string) returns (uint256)`).

**`agent/scripts/reconcile.ts`** — Reference: **RESEARCH Pattern 4** (lines 313-322). `getLogs(SignalRecorded)` + `getLogs(SignalInvalidated)` for the agentId; match each non-invalidated signal to a settled swap by `(operatorEOA, tokenIn, tokenOut, amountIn)`; report `{matched, invalidated, orphan}`; exit non-zero if any non-invalidated `orphan` (D-40 acceptance gate). Imports `reconcile-shared.ts`.

**`agent/scripts/noiseBot.ts`** — Reference: RESEARCH Pattern 3 (swap call) + D-24. Separate noise EOA; small random swaps (~0.5-2% of pool depth) on a random pair every 1-3 min.

**`agent/test/strategy.replay.test.ts`** — Reference: AI-SPEC §5 (line 408) + the discipline of `test/SourceRegistry.t.sol` translated to vitest. Replay the pure `maCrossover` core over canned price series; assert deterministic decisions.

**`agent/eval/`** — Reference: AI-SPEC §5 Reference Dataset (lines 465-479) + Eval Tooling (lines 427-447). 12-18 canned `Signal` fixtures (`agent/eval/signals/*.json`) + `promptfooconfig.yaml` wiring `anthropic:claude-haiku-4-5` + js assertions (thesisSchema/signalFidelity/bannedPhrases) + llm-rubric.

---

### `deployments/sepolia.json` (manifest) — UPDATE

**Analog:** itself (`C:\Users\Ben\Desktop\B3NSAG3\Hackathons\Mantle - Turing\Sequa\deployments\sepolia.json`). Follow the existing `contracts.<name>.{address, deployTx, explorerUrl, verificationUrl, verified}` shape. ADD: the redeployed `sourceRegistry` (new address — RESEARCH State Inventory: Phase 0 agentId 1 does NOT carry over), the 4 mock tokens, the UniV3-fork venue addresses (D-43), and the seeded pool addresses. The existing `testTransaction.signalPayload` block (lines 36-44) documents the D-07 5-field encoding precedent the agent's real signals follow.

### `.planning/phases/00-lock/DEPLOYMENT.md` (doc) — UPDATE

**Analog:** itself. Follow the existing "Deployed contracts" table + "REQ-12 checklist" structure (lines 8-15, 45-65). UPDATE the `SourceRegistry.sol` address/verification row to the Phase 1 redeploy; add the mock-token rows; note the venue is the self-deployed UniV3 fork (D-43). Phase 5 cites the Phase 1 SourceRegistry address (D-31).

---

## Shared Patterns

### Solidity contract security baseline
**Source:** `src/SourceRegistry.sol` lines 4-5, 12, 54-56; `src/FollowRegistry.sol` lines 4-5, 28.
**Apply to:** every state-changing contract function in this phase (`invalidateSignal`, and any mock with privileged ops).
```solidity
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
contract X is Ownable, ReentrancyGuard { ... function f() external nonReentrant { ... } }
```
D-08 owner gate (`if (s.owner != msg.sender) revert NotSourceOwner(...)`) + D-09 `nonReentrant` on every state-changing function. `MockERC20.mint` is intentionally ungated (D-17 public mint).

### Foundry deploy-script idiom
**Source:** `script/DeployPhase0.s.sol` lines 4, 17-19, 24, 26-28.
**Apply to:** all NEW deploy scripts (`DeployMocks`, `DeploySourceRegistryV1`, `DeployUniV3Fork`, `SeedLiquidity`).
```solidity
import {Script, console2} from "forge-std/Script.sol";
uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
vm.startBroadcast(key); /* new ... */ vm.stopBroadcast();
console2.log("Name:", address(x));
```
Run with `forge script script/X.s.sol:X --rpc-url mantle_sepolia --broadcast --slow` (DeployPhase0 lines 11-14). NOTE: SeedLiquidity/swap scripts use the **operator** key per the wave; mocks/registry use `DEPLOYER_PRIVATE_KEY`; noise bot uses `NOISE_BOT_PRIVATE_KEY` (RESEARCH State Inventory).

### Mantle Explorer verification (Etherscan V2)
**Source:** `script/VerifyPhase0.sh` lines 28-38; `foundry.toml` lines 19-20.
**Apply to:** `VerifyPhase1.sh` for all 4 mocks + the redeployed registry.
```bash
VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=5003"
forge verify-contract "${ADDR}" path:Contract --chain 5003 \
  --verifier etherscan --verifier-url "${VERIFIER_URL}" \
  --etherscan-api-key "${MANTLESCAN_API_KEY}" --watch
```
Legacy V1 (`api-sepolia.mantlescan.xyz/api`) is decommissioned (RESEARCH Pitfall 4). Toolchain pins: Solc 0.8.24, OZ v5.0.2, Foundry 1.5.1 (DEPLOYMENT.md "Source" section).

### The canonical D-07 5-field signal tuple (the universal contract)
**Source:** `test/SourceRegistry.t.sol` lines 48-54; `SourceRegistry.sol` line 48 (NatSpec); `deployments/sepolia.json` lines 36-44.
**Apply to:** `SignalDecoded` event fields, `reconcile-shared.ts`, `recordSignal.ts`, `types.ts`, `strategy` output, all eval fixtures, `SeedLiquidity` swap, noise bot.
```
ABI (address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint24 fee)
```
This 5-field tuple is the single shared shape across Solidity + TS. **Distinct from** the 8-field router `ExactInputSingleParams` (RESEARCH Pattern 3) — derive the router struct at call time, never conflate them.

### Off-hot-path AI degradation (TS, applies to every narration touch point)
**Source:** AI-SPEC §4 (lines 286-329), §6 (online guardrails), §3 Pitfall 2.
**Apply to:** `narrateSignal.ts`, `index.ts`, `narrateAndStore`.
`await` the on-chain trade; `void narrateAndStore(...)` fire-and-store (NEVER awaited); 8s per-call timeout + maxRetries 2; all throwing stays inside `narrateSignalSafe` (returns fallback, never throws → no unhandledRejection). The narration gate gates publishing words, never trading.

---

## No Analog Found

Files with no in-repo match — planner MUST use RESEARCH.md / AI-SPEC.md reference patterns (cited per-file above), not a forced repo analog:

| File(s) | Role | Data Flow | Reason | Reference |
|---------|------|-----------|--------|-----------|
| `agent/src/**` (all 13 TS runtime files) | service/strategy/store | mixed | Greenfield — zero TypeScript exists in the repo today | AI-SPEC §3-4 + RESEARCH Patterns 2-5 |
| `agent/scripts/*.ts` (3 files) | CLI/script | request-response / batch | Greenfield TS | RESEARCH Patterns 3/4/5 |
| `agent/test/*` + `agent/eval/*` | test/eval | batch | Greenfield TS; no JS test infra in repo (Foundry-only) | AI-SPEC §5 |
| `script/DeployUniV3Fork.s.sol` (periphery deploy body) | script/deploy | batch | No UniV3 periphery vendored in `lib/` (only forge-std + OZ); no prior fork-deploy in repo | RESEARCH Pitfall 1 option 2 + standard UniV3 periphery deploy; D-43 |
| `script/SeedLiquidity.s.sol` (pool create + LP mint body) | script/seed | batch | The env+broadcast shell has an analog (`DeployPhase0`), but the `createAndInitializePoolIfNecessary` + `NPM.mint` + sqrtPriceX96/tick math is new to the repo | RESEARCH Pattern 1 + Don't-Hand-Roll table |

**Note on the UniV3 fork (D-43):** the deploy script's outer shape (env-read, broadcast, log) copies `DeployPhase0.s.sol`, but the periphery contracts (factory, NPM, SwapRouter, QuoterV2) and their wiring must be vendored from UniV3 sources / a maintained fork into `lib/` first — there is no existing periphery to copy. The deployed addresses are a deploy-time output written back to `SequaConstants.sol`/`addresses.json`, never hard-coded.

---

## Metadata

**Analog search scope:** `src/`, `src/config/`, `src/interfaces/`, `script/`, `test/`, `lib/openzeppelin-contracts/contracts/token/ERC20/`, `deployments/`, `.planning/phases/00-lock/`; checked for `CLAUDE.md`, `.claude/skills/`, `.agents/skills/`, `agent/`, vendored UniV3.
**Files scanned (read in full):** `SourceRegistry.sol`, `SequaConstants.sol`, `FollowRegistry.sol` (head), `DeployPhase0.s.sol`, `VerifyPhase0.sh`, `SourceRegistry.t.sol`, `IIdentityRegistry.sol`, `deployments/sepolia.json`, `DEPLOYMENT.md`, `foundry.toml`; plus the 3 upstream phase docs (CONTEXT, RESEARCH, AI-SPEC).
**Pattern extraction date:** 2026-06-10
**Toolchain (pinned, from foundry.toml + DEPLOYMENT.md):** Foundry 1.5.1, Solidity 0.8.24, OZ Contracts v5.0.2, evm_version paris. TS (RESEARCH Standard Stack): Node 20+, `@anthropic-ai/sdk@0.104.1`, `viem@2.52.2`, `zod@^3`.
