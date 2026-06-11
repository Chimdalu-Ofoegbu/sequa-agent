---
phase: 01-source-signals
plan: 01
subsystem: infra
tags: [uniswap-v3, foundry, mantle-sepolia, erc20-mock, sqrtpricex96, liquidity-seed, deployCode]

# Dependency graph
requires:
  - phase: 00-lock
    provides: "Foundry deploy/verify patterns (DeployPhase0.s.sol, VerifyPhase0.sh), SequaConstants.sol skeleton, Etherscan V2 verify config"
provides:
  - "Live canonical Uniswap V3 fork (factory + NPM + SwapRouter + QuoterV2) on Mantle Sepolia (chain 5003), all codesize>0 (D-43)"
  - "4 verified mock ERC-20s: mUSDC(6dec), mWMNT/mMETH/mWETH(18dec) (D-17/D-18/D-23)"
  - "3 full-range fee=3000 LP pools (WMNT/USDC, mETH/USDC, WETH/USDC) seeded at D-20 mainnet-like prices (D-19)"
  - "Operator EOA 0xd813506F holds 10,000 mUSDC (D-11)"
  - "Venue/token/pool addresses written back to SequaConstants.sol + addresses.json + deployments/sepolia.json (single source of truth, D-21/D-43)"
  - "Tested PriceMath.encodePriceSqrt helper (overflow-safe split-sqrt form) for any future LP seed"
affects: [01-02 SourceRegistry redeploy, 01-04 chain hot path, 01-05 QuoterV2 price poll + reconciler, agent runtime]

# Tech tracking
tech-stack:
  added:
    - "Uniswap/v3-core@1.0.0 (vendored, 0.7.6)"
    - "Uniswap/v3-periphery@1.3.0 (vendored, 0.7.6, OZ imports rewritten to @openzeppelin-v3/)"
    - "OpenZeppelin/openzeppelin-contracts@v3.4.1-solc-0.7-2 (periphery OZ base)"
    - "Uniswap/solidity-lib, Brechtpd/base64"
  patterns:
    - "auto_detect_solc=true: 0.7.6 vendored + 0.8.x src compile in one Foundry project"
    - "vm.deployCode via explicit out/*.json artifact paths to instantiate 0.7.6 contracts from a 0.8 script"
    - "0.7.6 build anchor in script/ forces vendored contracts into the compile graph"
    - "Named seed/price constants (no inline magic numbers) tied to the fixed agent pair set"

key-files:
  created:
    - src/mocks/MockERC20.sol
    - script/Phase1Deployer.sol
    - script/PriceMath.sol
    - script/UniV3Interfaces.sol
    - script/DeployPhase1.s.sol
    - script/DeployUniV3Fork.s.sol
    - script/DeployMocks.s.sol
    - script/SeedLiquidity.s.sol
    - script/VerifyPhase1.sh
    - script/UniV3BuildAnchor.sol
    - addresses.json
    - test/MockERC20.t.sol
    - test/PoolInitCodeHash.t.sol
    - test/PriceMath.t.sol
  modified:
    - foundry.toml
    - src/config/SequaConstants.sol
    - deployments/sepolia.json
    - .env.example
    - lib/v3-periphery/contracts/libraries/PoolAddress.sol

key-decisions:
  - "Self-deployed canonical Uniswap V3 fork (D-43) — FusionX V3 is verifiably absent from chain 5003"
  - "PATCHED PoolAddress.POOL_INIT_CODE_HASH to the live build hash 0x3c168cc5…d70b (asserted by test)"
  - "mETH/WETH pools deepened to ~25k USDC (vs D-19's literal 5k) for mainnet-like single-token depth"

patterns-established:
  - "Dual-solc coexistence: auto_detect_solc + dual OZ remapping + prefix-rewritten periphery imports"
  - "Overflow-safe sqrtPriceX96 encoding via split-sqrt; on-chain slot0 round-trip + exact-equality guard (Pitfall 3)"

requirements-completed: [REQ-01]

# Metrics
duration: 52min
completed: 2026-06-10
---

# Phase 1 Plan 01: Source Venue + Liquidity Summary

**Self-deployed a canonical Uniswap V3 fork + 4 verified mock ERC-20s + 3 full-range fee=3000 LP pools LIVE on Mantle Sepolia, seeded at D-20 mainnet-like prices, with venue/token/pool addresses written back as the single source of truth — the Wave-0 venue gate every downstream Phase 1 plan consumes.**

## Performance

- **Duration:** ~52 min (Tasks 1-2; Task 3 is a pending human-verify checkpoint)
- **Started:** 2026-06-10T20:49:08Z
- **Completed (Tasks 1-2):** 2026-06-10T21:41:18Z
- **Tasks:** 2 of 3 (Task 3 = human-verify checkpoint, NOT self-approved)
- **Files modified/created:** ~20 (+ vendored libs)

## Accomplishments
- **UniV3 vendoring + dual-solc coexistence (Task 1):** vendored canonical v3-core/v3-periphery, rewrote periphery OZ imports to a dedicated `@openzeppelin-v3/` prefix, moved remappings into `foundry.toml` with `auto_detect_solc=true`, and PATCHED `POOL_INIT_CODE_HASH` to the locally-computed hash (a test asserts `keccak256(type(UniswapV3Pool).creationCode)` equals it). `forge build` compiles 0.7.6 vendored + 0.8.24/0.8.28 src together; 29/29 tests green including the untouched Phase 0 suites.
- **Live venue + mocks + pools (Task 2):** deployed factory/NPM/SwapRouter/QuoterV2 + 4 mocks + 3 seeded pools in one atomic broadcast (`DeployPhase1.s.sol`), driving the 0.7.6 venue from a 0.8 script via `vm.deployCode`. Every address codesize>0; `feeAmountTickSpacing(3000)==60`; operator holds exactly 10,000 mUSDC; QuoterV2 quotes mainnet-like spot (WMNT≈$0.60, mETH/WETH≈$3186 after the 0.3% fee).
- **Single source of truth write-back:** all 11 addresses written to `SequaConstants.sol` (filled token slots + new `UNIV3_*_SEPOLIA` consts; dead FusionX consts flagged `// DEAD on chain 5003 — DO NOT USE (D-43)`), a new root `addresses.json` for the TS runtime, and `deployments/sepolia.json`. All 4 mocks (+ factory, quoterV2, swapRouter) verified on Mantlescan.

## Deployed Addresses (Mantle Sepolia, chain 5003) — the single source of truth

| Component | Address | Explorer |
|-----------|---------|----------|
| UniV3 Factory | `0xee00d96ACE169B356E64A5dFE4ad732bE11eca93` | https://sepolia.mantlescan.xyz/address/0xee00d96ACE169B356E64A5dFE4ad732bE11eca93 |
| SwapRouter | `0x3b8eA15B067eC1ff9255AbdF519e3F91bEb7c1E0` | https://sepolia.mantlescan.xyz/address/0x3b8eA15B067eC1ff9255AbdF519e3F91bEb7c1E0 |
| QuoterV2 | `0x9CaC7a2a1fa687C11b5CFaEE0f967232257e87cf` | https://sepolia.mantlescan.xyz/address/0x9CaC7a2a1fa687C11b5CFaEE0f967232257e87cf |
| NonfungiblePositionManager | `0xd825FA1f548dD37C49F63511E7162e8ffd5071b2` | https://sepolia.mantlescan.xyz/address/0xd825FA1f548dD37C49F63511E7162e8ffd5071b2 |
| mUSDC (6 dec) | `0xAa606f127F0b40C2ab1ba47498d23C4C769C680E` | https://sepolia.mantlescan.xyz/address/0xAa606f127F0b40C2ab1ba47498d23C4C769C680E#code |
| mWMNT (18 dec) | `0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da` | https://sepolia.mantlescan.xyz/address/0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da#code |
| mMETH (18 dec) | `0xEDD7219bD5DBF25B44B891ccf25a26550277Bd3B` | https://sepolia.mantlescan.xyz/address/0xEDD7219bD5DBF25B44B891ccf25a26550277Bd3B#code |
| mWETH (18 dec) | `0xc4a88aca804F11BFAA35BfB6CA4aA4db473688C4` | https://sepolia.mantlescan.xyz/address/0xc4a88aca804F11BFAA35BfB6CA4aA4db473688C4#code |
| Pool WMNT/USDC (fee 3000) | `0xD622570De1975B748742433FD2d7612F49FdD4DE` | https://sepolia.mantlescan.xyz/address/0xD622570De1975B748742433FD2d7612F49FdD4DE |
| Pool mETH/USDC (fee 3000) | `0xC57320318F2c2C3B99EEd5DCA789421963378481` | https://sepolia.mantlescan.xyz/address/0xC57320318F2c2C3B99EEd5DCA789421963378481 |
| Pool WETH/USDC (fee 3000) | `0xAaEeA6b4c6B084d3Bb07dd91a457476B8081235C` | https://sepolia.mantlescan.xyz/address/0xAaEeA6b4c6B084d3Bb07dd91a457476B8081235C |

**Operator EOA:** `0xd813506F6F8a646154964C625f893C5059db5304` — balance 10,000 mUSDC (10000000000 raw, D-11).
**Deployer EOA (LP holder, gas):** `0x0C837aDA52E8Dd4b16Ae39D864FD5eEB82B80b21`.

## UniV3 periphery fork + POOL_INIT_CODE_HASH handling
- **Fork:** Uniswap canonical `v3-core@1.0.0` + `v3-periphery@1.3.0`, vendored as plain files (de-submoduled so the source patches persist). Periphery OZ imports rewritten to `@openzeppelin-v3/contracts/` (→ OZ 3.4-solc-0.7); src/ keeps OZ v5 via `@openzeppelin/contracts/`. Contextual remappings were NOT used (they silently fail on Windows Foundry 1.5.1 per the spike).
- **POOL_INIT_CODE_HASH:** the upstream baked-in mainnet constant (`0xe34f199b…b8b54`, built at 800 runs/istanbul/none) does NOT match this repo's build (200 runs/paris/ipfs), which would revert createAndInitialize/mint. Patched to the locally-computed `0x3c168cc5d3311f0933f08b32142d0998baeecd13571089b4bb0cdeeaf401d70b`; `test/PoolInitCodeHash.t.sol` asserts `keccak256(type(UniswapV3Pool).creationCode)` equals it (re-patch after any optimizer/evm change).

## Seed amounts / prices (D-19 / D-20)
Named constants in `script/Phase1Deployer.sol` (no inline magic numbers):

| Pool | Token amount (raw) | USDC amount (raw) | Spot price | 0.01-token quote (verified live) |
|------|--------------------|--------------------|-----------|-----------------------------------|
| WMNT/USDC | 8333.333… mWMNT | 5,000 mUSDC | ~$0.60 | 5981 → $0.5981/WMNT |
| mETH/USDC | 7.8125 mMETH | 25,000 mUSDC | ~$3200 | 31862981 → $3186/mETH |
| WETH/USDC | 7.8125 mWETH | 25,000 mUSDC | ~$3200 | 31862981 → $3186/WETH |

Each pool's `sqrtPriceX96` is encoded from the SORTED raw seed amounts (so price and LP ratio are consistent by construction), and the on-chain seed asserts `slot0().sqrtPriceX96 == seeded value` AND the round-trip price is within 1% of target (Pitfall 3 guard).

## Task Commits
1. **Task 1: Vendor UniV3 periphery + MockERC20 + tests** — `226fb8e` (feat)
2. **Task 2: Deploy UniV3 fork + 4 mocks + seed 3 pools + write-back** — `95b0e4d` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] uint256 overflow in encodePriceSqrt would silently mis-seed pools**
- **Found during:** Task 2 (pre-broadcast PriceMath unit test)
- **Issue:** The naive `(amount1 << 192) / amount0` form overflows uint256 when amount1 is large (e.g. 8333e18 << 192 ≈ 2^265 > 2^256), silently producing a wrong sqrtPriceX96 — the exact Pitfall-3 trap.
- **Fix:** Rewrote `encodePriceSqrt` to the split form `(sqrt(amount1) << 96) / sqrt(amount0)`, which keeps every intermediate inside uint256 across the full decimal-gap range; added FullMath `mulDiv` to `priceFromSqrtX96` for accurate round-trips. `test/PriceMath.t.sol` proves both token orderings round-trip within 1% before any gas was spent.
- **Files modified:** script/PriceMath.sol, test/PriceMath.t.sol
- **Verification:** 5/5 PriceMath tests + live slot0 round-trip asserts green.
- **Committed in:** `95b0e4d` (Task 2 commit)

**2. [Rule 3 - Blocking] vm.getCode could not find the 0.7.6 venue artifacts**
- **Found during:** Task 2 (deploy simulation)
- **Issue:** `forge script`/`forge test` only compile the target's 0.8 import closure, so `deployCode("UniswapV3Factory.sol:...")` reported "no matching artifact found" for the vendored 0.7.6 contracts; a build anchor in `test/` was not compiled by `forge script` at all.
- **Fix:** Moved the 0.7.6 build anchor to `script/UniV3BuildAnchor.sol` and switched `deployCode`/`getCode` to explicit `out/<File>.sol/<Contract>.json` artifact paths (which read from disk after a prior `forge build`), per the forge-std `getCode` "relative path to the json file" contract.
- **Files modified:** script/UniV3BuildAnchor.sol (moved), script/Phase1Deployer.sol, test/PoolInitCodeHash.t.sol
- **Verification:** clean dry-run simulation, then live `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL`.
- **Committed in:** `95b0e4d` (Task 2 commit)

### Informed-discretion deviation (documented, within D-19/D-20 intent)

**3. [Rule 2 - Correctness] Deepened the mETH/WETH pools to ~25k USDC depth**
- **Issue:** D-19's literal "~5k USDC-equivalent" depth for a $3200 asset is only ~1.56 tokens — too thin for the agent's real per-trade size (~2.5-3.3k USDC, D-07) and for the human-verify quote, which would show heavy slippage rather than mainnet-like prices (D-20).
- **Fix:** kept WMNT/USDC at ~5k; deepened mETH/USDC and WETH/USDC to ~25k USDC + 7.8125 tokens each. Spot prices remain exactly $0.60 / $3200 (D-20 preserved). All depth values are named constants.
- **Impact:** Honors D-20 ("mainnet-like") and the agent's trade sizing; a modest, defensible deviation from D-19's literal 5k. Documented in `addresses.json` and `deployments/sepolia.json`.

---

**Total deviations:** 3 (1 bug auto-fixed, 1 blocking auto-fixed, 1 informed-discretion depth change)
**Impact on plan:** Both auto-fixes were necessary for correctness; the depth change preserves the locked spot prices while making the venue usable + mainnet-like. No scope creep.

## Issues Encountered
- **Mock verification compiler version:** `auto_detect_solc` resolves MockERC20's `^0.8.20` pragma to 0.8.28 (the highest installed), not 0.8.24. Verification needed `--compiler-version 0.8.28` to match the deployed bytecode. `VerifyPhase1.sh` pins this. The 4 mocks (D-23 gate), plus factory + quoterV2, are source-verified on Mantlescan. SwapRouter is now source-verified too (manifest `verified` flag corrected, commit `242f266`). NPM source-verification is still pending (its code is present on-chain, codesize>0, which is what the checkpoint requires; NPM is used only for LP seeding, not the agent hot path) and can be re-submitted later without affecting downstream plans.

## Next Phase Readiness
- The Wave-0 venue gate is OPEN: downstream plans (02 SourceRegistry redeploy, 04 chain hot path, 05 QuoterV2 poll + reconciler) can consume the venue/token/pool addresses from `addresses.json` / `SequaConstants.sol`.
- **Task 3 human-verify checkpoint — RESOLVED / APPROVED (2026-06-11):** the human reviewed the explorer source pages + mainnet-like QuoterV2 quotes and approved. One issue was raised and investigated: mWMNT/mMETH/mWETH show Mantlescan "Similar Match" + a cosmetic "Constructor" warning because all 4 mocks share the same `MockERC20` bytecode (only mUSDC, verified first, gets a clean independent "Exact Match"). Re-verification is impossible (forge + direct Etherscan V2 API both return already-verified); the only fix would be redeploying distinctly-named mocks + re-seeding pools. **Decision: accepted as cosmetic** — all 4 are source-verified and functionally correct; mock tokens are test assets, not the trust story (SourceRegistry + on-chain signals are). Explanatory note added to `addresses.json` / `SequaConstants.sol` / `deployments/sepolia.json` (commit `242f266`). **Plan 01-01 is COMPLETE.**

## Self-Check: PASSED

Re-ran all Task 1-2 acceptance criteria + file/commit existence:
- **T1:** clean `forge build` compiles 0.7.6 (85 files) + 0.8.24 (29) + 0.8.28 in one project; 29/29 tests green (Phase 0 suites included); POOL_INIT_CODE_HASH patched + asserted; public mint + createAndInitializePoolIfNecessary present.
- **T2 (live on chain 5003):** all 11 addresses (venue+tokens+pools) codesize>0; `feeAmountTickSpacing(3000)==60`; USDC decimals=6; operator balance=10000000000 (10k mUSDC); QuoterV2 WMNT→USDC(0.01)=5981 (>0); `addresses.json` jq schema OK; SequaConstants `UNIV3_*` filled + dead FusionX flagged.
- **Files:** all created files FOUND. **Commits:** `226fb8e`, `95b0e4d` FOUND.

---
*Phase: 01-source-signals*
*Completed (Tasks 1-2): 2026-06-10*
