# Phase 1 — Spike Findings (pre-execution de-risk)

**Date:** 2026-06-10
**Why:** Two highest-risk surfaces in Phase 1 were spiked in isolation BEFORE execution, to retire risk and replace assumptions in 01-01-PLAN.md / 01-06-PLAN.md with proven recipes. Spike #2 ran in a throwaway git worktree (now discarded). Spike #3 was non-destructive (`cast` reads/estimates only — no on-chain write).

> **Authoritative for execution.** Where this file and a PLAN disagree, THIS file wins for the UniV3 vendoring recipe and the ERC-8004 mint facts — it is validated against the live toolchain/chain, the plans were written before the spike.

---

## Spike #2 — Canonical Uniswap V3 vendoring + compile (Plan 01-01 Task 1/2)

**VERDICT: COMPILES-CLEAN — full deploy + createPool + full-range mint proven (16/16 tests green, both solc worlds in one project).**

### Two corrections to 01-01-PLAN.md (the plan was written pre-spike and is WRONG on both)

1. **OZ-version collision is real and contextual remappings DON'T work here.** v3-periphery imports `@openzeppelin/contracts/...` at OZ ~3.4 (solc 0.7) paths that will NOT compile against the repo's OZ v5 global remapping. Foundry's `context:prefix=target` contextual remappings **silently fail on Windows Foundry 1.5.1** (the context group parses but never matches at resolution time; imports fall back to OZ v5 and fail). **Fix: rewrite v3-periphery's OZ imports to a dedicated `@openzeppelin-v3/` prefix** mapped to a solc-0.7 OZ — deterministic, OS-independent.
2. **`POOL_INIT_CODE_HASH` does NOT match the baked-in mainnet constant** under this repo's build settings. The plan's claim "the periphery's POOL_INIT_CODE_HASH matches the canonical bytecode … derive from the vendored PoolAddress.sol constant" is FALSE — at default settings (200 runs, paris, bytecode_hash=ipfs) the locally compiled `keccak256(type(UniswapV3Pool).creationCode)` = `0x3c168cc5…d70b`, but `PoolAddress.sol` ships `0xe34f199b…b8b54` (the 2021 mainnet value). Deploy/mint **reverts** because SwapRouter/NPM compute pool addresses off-chain via this constant. **Fix: compute the hash and PATCH the constant** (proven below).

### Recipe (copy-paste; reproducible from a clean `main`)

**a) Installs** (Foundry 1.5.1 — `--no-commit` was REMOVED and now ERRORS; no-commit is the default):
```bash
forge install Uniswap/v3-core                                              # -> v1.0.0
forge install Uniswap/v3-periphery                                         # -> v1.3.0
forge install openzeppelin-contracts-3.4=OpenZeppelin/openzeppelin-contracts@v3.4.1-solc-0.7-2
forge install Uniswap/solidity-lib                                         # @uniswap/lib -> v2.1.0
forge install base64-sol=Brechtpd/base64@v1.1.0                            # only if you want the NFT descriptor; otherwise optional
```

**b) Rewrite v3-periphery's OZ imports to the dedicated prefix** (v3-core imports nothing external — leave it):
```bash
grep -rl "@openzeppelin/contracts/" lib/v3-periphery/contracts --include=*.sol \
  | xargs sed -i 's#@openzeppelin/contracts/#@openzeppelin-v3/contracts/#g'
```

**c) Move remappings into `foundry.toml` and DELETE the root `remappings.txt`** (avoids auto-detected `openzeppelin-contracts/` entries clobbering the dual mapping). Working profile:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
auto_detect_solc = true          # CHANGED from `solc = "0.8.24"` — REQUIRED so 0.7.6 deps get their own compiler
auto_detect_remappings = false   # ADDED — silences noisy auto-detected OZ remappings
optimizer = true
optimizer_runs = 200
via_ir = false
evm_version = "paris"            # fine for Mantle; see init-code-hash note
remappings = [
    "forge-std/=lib/forge-std/src/",
    "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",        # src/ -> OZ v5 (unchanged)
    "@openzeppelin-v3/contracts/=lib/openzeppelin-contracts-3.4/contracts/",  # v3-periphery -> OZ 3.4
    "@uniswap/v3-core/=lib/v3-core/",
    "@uniswap/v3-periphery/=lib/v3-periphery/",
    "@uniswap/lib/=lib/solidity-lib/",
    "base64-sol/=lib/base64-sol/",
]
```
> Removing the hard `solc = "0.8.24"` pin is mandatory (it forced 0.7.6 files to 0.8.24 and broke them). With `auto_detect_solc`, `src/` resolves to the highest installed 0.8 (`0.8.28` here, not `0.8.24`) — harmless for coexistence; pin `src/` pragmas to `0.8.24` if you need deterministic src bytecode.

**d) Patch `POOL_INIT_CODE_HASH`** in `lib/v3-periphery/contracts/libraries/PoolAddress.sol` to the value computed for THIS build (recompute and re-patch after ANY optimizer/evm_version/bytecode_hash change — it shifts):
```solidity
bytes32 internal constant POOL_INIT_CODE_HASH = 0x3c168cc5d3311f0933f08b32142d0998baeecd13571089b4bb0cdeeaf401d70b; // repo settings: 200 runs / paris / ipfs
```
Verify it with a tiny test that logs `keccak256(type(UniswapV3Pool).creationCode)` and asserts equality. (Alternative for exact mainnet parity, NOT recommended here: build at `optimizer_runs=800`, `evm_version="istanbul"`, `bytecode_hash="none"` → yields `0xe34f199b…b8b54` with no source patch, but diverges the whole project from `paris`.)

**e) Deploy scripts & tests must use `vm.deployCode`, not `new`.** forge-std `Script.sol`/`Test.sol` are `>=0.8.13`, so a 0.8 script/test CANNOT `new UniswapV3Factory()` (0.7.6) across the version boundary. Instantiate the venue via the precompiled artifacts and drive them through locally-declared interfaces:
```solidity
// 0.8 deploy script / test
address factory = deployCode("UniswapV3Factory.sol:UniswapV3Factory");
address npm     = deployCode("NonfungiblePositionManager.sol:NonfungiblePositionManager",
                             abi.encode(factory, weth9, /*tokenDescriptor=*/address(0)));
address router  = deployCode("SwapRouter.sol:SwapRouter", abi.encode(factory, weth9));
address quoter  = deployCode("QuoterV2.sol:QuoterV2", abi.encode(factory, weth9));
```

### Gotchas confirmed
- **NonfungibleTokenPositionDescriptor / base64 NOT needed for mint.** NPM takes the descriptor as a constructor ADDRESS; pass `address(0)`. Only `tokenURI()` would revert (never called on mint/seed). base64-sol only needed if you later want the on-chain SVG descriptor.
- **fee=3000 / tickSpacing 60 is enabled by default** in the vendored `UniswapV3Factory` constructor (asserted). No `enableFeeAmount` call needed — but keep the runtime `feeAmountTickSpacing(3000)==60` assert as a guard.
- `abicoder v2` in periphery is fine under 0.7.6/0.8; `via_ir=false`; `evm_version=paris` OK.
- Coexistence proven: the existing FollowRegistry/SourceRegistry tests (0.8 + OZ v5) AND the new UniV3 deploy/mint tests (0.7.6 + OZ 3.4) all pass in one `forge test` run.

### Bonus proven
`createAndInitializePoolIfNecessary(token0, token1, 3000, 2**96)` + full-range mint (ticks ±887220) succeeds → `tokenId 1, liquidity ~1e21`. (Only after the `PoolAddress` constant is corrected — at the default un-patched constant it reverts, which is exactly the trap this spike was for.)

---

## Spike #3 — ERC-8004 `register()` live-send probe (Plan 01-06 Task 2)

**VERDICT: register() works on a real send — RESEARCH assumption A5 (fee/allowlist might block a real tx) is RETIRED. No plan change required; the live mint is now low-risk.** Non-destructive (no actual mint performed).

Probed against canonical Sepolia `IdentityRegistry 0x8004A818BFB912233c491871b3d84c89A494BD9e` from the Phase-0 deployer EOA:

| Check | Result | Meaning |
|-------|--------|---------|
| `cast call register(string)→uint256` | returns **146** | open registration; returns the NEXT agentId (was 137 at research — increments). **Confirms Pitfall 6: agentId is NOT 1.** |
| `cast estimate register(string)` | **180,589 gas**, succeeds | a REAL tx executes without revert (estimation runs the full tx incl. requires) — no allowlist gate blocks the deployer EOA |
| same with `--value 0` | identical 180,589 | **no mandatory `msg.value` registration fee** |
| `tokenURI(1)` | returns a JSON string | registry stores/returns an arbitrary string → D-28 static-JSON / HTTPS `agentURI` drops in directly |
| `ownerOf(1)` | returns an address | ERC-721 surface live as pinned in `IIdentityRegistry.sol` |

**For Plan 01-06 Task 2:** budget ~181k gas for the mint; capture the returned agentId from the `Transfer(0x0→owner, tokenId)` / register event (it will be ~146+, NOT 1); pass it to `registerSource`. Gas balances confirmed ample (deployer ~49.7 MNT, follower ~40 MNT on Sepolia).

---

## Environment facts (verified this session)
- Mantle Sepolia chain 5003 RPC `https://rpc.sepolia.mantle.xyz` live; FusionX V3 still codesize 0 (re-confirmed); Multicall3=3808, ERC-8004 registry has code.
- Foundry 1.5.1 (`forge install --no-commit` removed). Deployer EOA `0x0C83…0b21` ~49.7 MNT, follower `0xeC31…B615` ~40 MNT.
