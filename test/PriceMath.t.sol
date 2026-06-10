// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PriceMath} from "../script/PriceMath.sol";

/// @title PriceMathTest
/// @notice Proves encodePriceSqrt + priceFromSqrtX96 round-trip the D-20 seed prices to within
///         1% (Pitfall 3 — a 6-vs-18 decimal-gap error is off by ~10^12, far outside 1%).
contract PriceMathTest is Test {
    uint256 internal constant USDC_SEED = 5_000e6;
    uint256 internal constant WMNT_SEED = 8333_333333333333333333; // $0.60
    uint256 internal constant METH_SEED = 1_562500000000000000; // $3200
    uint256 internal constant SCALE = 1e18;
    uint256 internal constant TOL_BPS = 100; // 1%

    function _assertRoundTrip(uint256 amount0, uint256 amount1) internal pure {
        uint160 sqrtP = PriceMath.encodePriceSqrt(amount0, amount1);
        uint256 observed = PriceMath.priceFromSqrtX96(sqrtP, SCALE);
        uint256 target = (amount1 * SCALE) / amount0;
        uint256 diff = observed > target ? observed - target : target - observed;
        assertLe(diff * 10_000, target * TOL_BPS, "round-trip off > 1%");
    }

    // WMNT(18) is token0 vs USDC(6) token1 OR reversed — test both orderings hold.
    function test_RoundTrip_WMNT_token0() public pure {
        _assertRoundTrip(WMNT_SEED, USDC_SEED); // token0=WMNT, token1=USDC
    }

    function test_RoundTrip_WMNT_token1() public pure {
        _assertRoundTrip(USDC_SEED, WMNT_SEED); // token0=USDC, token1=WMNT
    }

    function test_RoundTrip_METH_token0() public pure {
        _assertRoundTrip(METH_SEED, USDC_SEED);
    }

    function test_RoundTrip_METH_token1() public pure {
        _assertRoundTrip(USDC_SEED, METH_SEED);
    }

    /// @dev Human-price sanity: WMNT/USDC with WMNT=token0 → price1_per_0 (USDC_raw/WMNT_raw)
    ///      scaled by 1e18 should be ~ 0.60 * 1e6 / 1e18 * 1e18 = 0.60e6 = 600000.
    function test_HumanPrice_WMNT() public pure {
        uint160 sqrtP = PriceMath.encodePriceSqrt(WMNT_SEED, USDC_SEED);
        uint256 observed = PriceMath.priceFromSqrtX96(sqrtP, SCALE); // USDC_raw/WMNT_raw * 1e18
        // expected ~ 600000 (=0.6 * 1e6); allow 1%
        assertApproxEqRel(observed, 600_000, 0.01e18, "WMNT price1_per_0 not ~0.60 USDC/WMNT");
    }
}
