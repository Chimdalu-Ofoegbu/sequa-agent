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
    address internal constant FUSIONX_V3_SWAP_ROUTER_SEPOLIA = 0x8fC0B6585d73C94575555B3970D7A79c5bfc6E36;
    address internal constant FUSIONX_V3_FACTORY_SEPOLIA     = 0xf811BF0B2174135Ff1c8E615eB6B678caECa8d61;
    address internal constant FUSIONX_V3_QUOTER_V2_SEPOLIA   = 0xa4e57d8FD802cc6b1b01218dfF0046fA571241da;

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

    // ---- D-03 pair set (DEC-002) — Sepolia pins ----
    /// @dev TODO[Phase 1]: Sepolia equivalents (WMNT_SEPOLIA, METH_SEPOLIA, WETH_SEPOLIA, USDC_SEPOLIA) are
    ///      seeded in the Phase 1 LP-seed chore — the LP positions Phase 1 creates ARE the tokens those
    ///      addresses point to. No canonical Sepolia pin exists at Phase 0 time. Phase 0 never references
    ///      these tokens (recordSignal treats the signal payload as opaque per D-07), so deferral is safe.
    // address internal constant WMNT_SEPOLIA = 0x...; // PINNED IN PHASE 1
    // address internal constant METH_SEPOLIA = 0x...; // PINNED IN PHASE 1
    // address internal constant WETH_SEPOLIA = 0x...; // PINNED IN PHASE 1
    // address internal constant USDC_SEPOLIA = 0x...; // PINNED IN PHASE 1
}
