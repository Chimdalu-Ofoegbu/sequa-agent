// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title MockERC20Test
/// @notice Proves the D-18 per-instance decimals (6 vs 18) and the D-17 public mint.
contract MockERC20Test is Test {
    MockERC20 internal usdc;
    MockERC20 internal wmnt;

    address internal constant ALICE = address(0xA11CE);

    function setUp() public {
        usdc = new MockERC20("USD Coin", "mUSDC", 6);
        wmnt = new MockERC20("Wrapped MNT", "mWMNT", 18);
    }

    /// @dev D-18: USDC mirrors mainnet 6 decimals.
    function test_DecimalsSix() public view {
        assertEq(usdc.decimals(), 6, "mUSDC must report 6 decimals (D-18)");
    }

    /// @dev D-18: the 18-decimal mocks report 18.
    function test_DecimalsEighteen() public view {
        assertEq(wmnt.decimals(), 18, "mWMNT must report 18 decimals (D-18)");
    }

    /// @dev D-17: public mint increases balance + totalSupply by the minted amount.
    function test_PublicMintIncreasesBalanceAndSupply() public {
        uint256 amount = 1_000e6; // 1,000 mUSDC at 6 decimals
        uint256 balBefore = usdc.balanceOf(ALICE);
        uint256 supplyBefore = usdc.totalSupply();

        usdc.mint(ALICE, amount);

        assertEq(usdc.balanceOf(ALICE), balBefore + amount, "mint must increase recipient balance");
        assertEq(usdc.totalSupply(), supplyBefore + amount, "mint must increase totalSupply");
    }

    /// @dev D-17: mint is ungated — any caller (here a random EOA) can mint.
    function test_PublicMintIsUngated() public {
        vm.prank(address(0xBEEF));
        wmnt.mint(ALICE, 5e18);
        assertEq(wmnt.balanceOf(ALICE), 5e18, "ungated mint must succeed from any caller (D-17)");
    }
}
