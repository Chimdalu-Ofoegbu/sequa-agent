// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SequaConstants
/// @notice Canonical Mantle Sepolia + Mainnet addresses pinned per CONTEXT.md D-02..D-05.
/// @dev Phase 0 only consumes the Sepolia constants; mainnet constants are present so Phase 5 redeployment is mechanical.
library SequaConstants {
    // ---- Chain ----
    uint256 internal constant MANTLE_SEPOLIA_CHAIN_ID = 5003;
    uint256 internal constant MANTLE_MAINNET_CHAIN_ID = 5000;

    // ---- FusionX V3 (DEC-001 / D-02) — Sepolia ----
    // DEAD on chain 5003 — DO NOT USE (D-43). FusionX V3 is verifiably NOT deployed on Mantle
    // Sepolia: every address below returns codesize 0 (RESEARCH Pitfall 1). These docs-pinned
    // addresses target the deprecated old Mantle Testnet (chain 5001). The live Phase 1 venue is
    // the self-deployed canonical Uniswap V3 fork in the UNIV3_*_SEPOLIA constants below.
    address internal constant FUSIONX_V3_SWAP_ROUTER_SEPOLIA = 0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36; // DEAD on chain 5003 — DO NOT USE (D-43)
    address internal constant FUSIONX_V3_FACTORY_SEPOLIA     = 0xf811BF0B2174135Ff1c8E615eB6B678caECa8d61; // DEAD on chain 5003 — DO NOT USE (D-43)
    address internal constant FUSIONX_V3_QUOTER_V2_SEPOLIA   = 0xa4e57d8FD802cc6b1b01218dfF0046fA571241da; // DEAD on chain 5003 — DO NOT USE (D-43)

    // ---- Self-deployed canonical Uniswap V3 fork (D-43) — Sepolia (chain 5003) ----
    // The LIVE Phase 1 trading venue. Deployed + verified by script/DeployPhase1.s.sol
    // (deploy-time write-back, NEVER copied from stale docs). fee=3000 / tickSpacing 60 enabled.
    // Every address asserted codesize > 0 on chain 5003 before trust (T-1-06).
    address internal constant UNIV3_FACTORY_SEPOLIA     = 0xee00d96ACE169B356E64A5dFE4ad732bE11eca93;
    address internal constant UNIV3_NPM_SEPOLIA         = 0xd825FA1f548dD37C49F63511E7162e8ffd5071b2;
    address internal constant UNIV3_SWAP_ROUTER_SEPOLIA = 0x3b8eA15B067eC1ff9255AbdF519e3F91bEb7c1E0;
    address internal constant UNIV3_QUOTER_V2_SEPOLIA   = 0x9CaC7a2a1fa687C11b5CFaEE0f967232257e87cf;

    // ---- FusionX V3 (DEC-001) — Mainnet (for Phase 5 reference) ----
    address internal constant FUSIONX_V3_SWAP_ROUTER_MAINNET = 0x5989FB161568b9F133eDf5Cf6787f5597762797F;
    address internal constant FUSIONX_V3_FACTORY_MAINNET     = 0x530d2766D1988CC1c000C8b7d00334c14B69AD71;
    address internal constant FUSIONX_V3_QUOTER_V2_MAINNET   = 0x90f72244294E7c5028aFd6a96E18CC2c1E913995;

    // ---- ERC-8004 (DEC-004 / D-05) — Sepolia ----
    address internal constant ERC8004_IDENTITY_REGISTRY_SEPOLIA   = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
    address internal constant ERC8004_REPUTATION_REGISTRY_SEPOLIA = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

    // ---- ERC-8004 (DEC-004) — Mainnet ----
    address internal constant ERC8004_IDENTITY_REGISTRY_MAINNET   = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address internal constant ERC8004_REPUTATION_REGISTRY_MAINNET = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

    // ---- D-03 pair set (DEC-002) — Mainnet pins ----
    // Pair set per CONTEXT.md D-03: WMNT/USDC, mETH/USDC, WETH/USDC. Single-hop only via ISwapRouter.exactInputSingle.
    // Token addresses pinned VERBATIM from canonical Mantle mainnet sources.

    /// @notice WMNT (wrapped MNT) on Mantle Mainnet.
    /// @dev EIP-55 checksum corrected from plan's `0x78c1B0C915c4FAA5FFFa6CABf0219DA63d7f4cb8` to
    ///      `0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8` (same underlying bytes — confirmed via
    ///      `cast --to-checksum-address`). Plan's casing fails Solidity 0.8.24 compile-time checksum check.
    address internal constant WMNT_MAINNET = 0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8;

    /// @notice mETH (Mantle staked ETH) on Mantle Mainnet.
    address internal constant METH_MAINNET = 0xcDA86A272531e8640cD7F1a92c01839911B90bb0;

    /// @notice USDC (native, Mantle-issued) on Mantle Mainnet.
    address internal constant USDC_MAINNET = 0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9;

    /// @notice WETH (canonical wrapped ETH) on Mantle Mainnet.
    /// @dev TODO[Phase 1]: Canonical Mantle WETH wrapper address NOT confirmed in PHASE-0-RESEARCH.md to a
    ///      degree this planner is willing to pin without risk of guessing. Phase 1 LP-seed chore MUST confirm
    ///      via FusionX V3 LP positions or Mantle's official token list and update this constant before any
    ///      WETH/USDC swap path is wired. Until then this constant is intentionally absent — any consumer that
    ///      imports it will fail to compile, which is the correct safety property.
    // address internal constant WETH_MAINNET = 0x...; // PINNED IN PHASE 1

    // ---- D-03 pair set (DEC-002) — Sepolia pins (PINNED IN PHASE 1, D-17/D-18/D-21) ----
    /// @dev These are the 4 mock ERC-20s deployed by script/DeployPhase1.s.sol — the LP positions
    ///      Phase 1 created ARE these tokens. Decimals: USDC=6, WMNT/METH/WETH=18 (D-18). Written
    ///      back as deploy-time output (single source of truth), not copied from any docs.
    /// @dev VERIFICATION NOTE: all 4 mocks are the SAME MockERC20 contract, so Mantlescan
    ///      source-verifies mUSDC as a clean "Exact Match" and bytecode-matches mWMNT/mMETH/mWETH
    ///      to it as "Similar Match" + a cosmetic "Constructor" warning. This is EXPECTED and
    ///      harmless — all 4 are source-verified and functionally correct. Do NOT "fix" it by
    ///      redeploying distinctly-named mocks; that would churn token+pool addresses for zero
    ///      functional gain (reviewed + accepted 2026-06-11).
    address internal constant USDC_SEPOLIA = 0xAa606f127F0b40C2ab1ba47498d23C4C769C680E; // mUSDC, 6 dec
    address internal constant WMNT_SEPOLIA = 0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da; // mWMNT, 18 dec
    address internal constant METH_SEPOLIA = 0xEDD7219bD5DBF25B44B891ccf25a26550277Bd3B; // mMETH, 18 dec
    address internal constant WETH_SEPOLIA = 0xc4a88aca804F11BFAA35BfB6CA4aA4db473688C4; // mWETH, 18 dec

    // ---- Seeded fee=3000 pools (D-19/D-43) — Sepolia ----
    /// @dev Full-range LP pools created by SeedLiquidity at the D-20 mainnet-like prices.
    address internal constant UNIV3_POOL_WMNT_USDC_SEPOLIA = 0xD622570De1975B748742433FD2d7612F49FdD4DE;
    address internal constant UNIV3_POOL_METH_USDC_SEPOLIA = 0xC57320318F2c2C3B99EEd5DCA789421963378481;
    address internal constant UNIV3_POOL_WETH_USDC_SEPOLIA = 0xAaEeA6b4c6B084d3Bb07dd91a457476B8081235C;

    // ---- Trading venue fee tier (D-19) ----
    uint24 internal constant UNIV3_FEE_TIER = 3000; // 0.30% / tickSpacing 60
}
