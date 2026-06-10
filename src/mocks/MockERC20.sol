// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockERC20
/// @notice Parameterized-decimals mock ERC-20 with an intentionally PUBLIC, ungated mint.
/// @dev D-17/D-18: 4 Sepolia mocks (mUSDC=6dec, mWMNT/mMETH/mWETH=18dec) for pools + swaps.
///      The public `mint` is deliberate (testnet-only liquidity tool, threat model T-1-02) —
///      mock tokens have zero real value and this is Sepolia-only (D-41). NEVER ship a public
///      mint to mainnet. Decimals are set per-instance so signal-payload decimal semantics
///      mirror mainnet (USDC 6, others 18) with zero adapter code on a future crossover.
contract MockERC20 is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _dec = decimals_;
    }

    /// @notice Overrides OZ's hardcoded 18 so each mock mirrors its mainnet decimals (D-18).
    function decimals() public view override returns (uint8) {
        return _dec;
    }

    /// @notice Public, ungated mint (D-17) — testnet liquidity faucet for LP seeding + dev wallets.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
