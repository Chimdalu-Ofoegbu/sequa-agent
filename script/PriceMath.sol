// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PriceMath
/// @notice Tested helper to encode a Uniswap V3 sqrtPriceX96 from RAW token reserve amounts,
///         and to round-trip it back to a human price for the Pitfall-3 guard (D-20).
/// @dev sqrtPriceX96 = floor( sqrt( (amount1 << 192) / amount0 ) ) where amount0/amount1 are
///      the RAW on-chain reserve amounts of token0/token1 (decimals already baked in). This is
///      the canonical UniV3 encodePriceSqrt math (sqrt of the reserve ratio, scaled by 2^96).
///      The 6-vs-18 decimal gap (Pitfall 3) is handled by the CALLER choosing raw amounts that
///      express the target price; this library does no decimal inference. We use a Babylonian
///      sqrt rather than a hand-rolled formula (Don't-Hand-Roll table).
library PriceMath {
    /// @notice Encode sqrtPriceX96 from raw reserve amounts of token0 and token1.
    /// @param amount0 RAW reserve amount of token0 (the lower-address token).
    /// @param amount1 RAW reserve amount of token1 (the higher-address token).
    /// @dev sqrtPriceX96 = sqrt(amount1/amount0) * 2^96. Computing `(amount1 << 192)/amount0`
    ///      OVERFLOWS uint256 when amount1 is large (e.g. 8333e18 << 192 ≈ 2^265 > 2^256), which
    ///      would silently mis-seed a pool — exactly the Pitfall-3 trap. We instead use the
    ///      split form sqrtPriceX96 = (sqrt(amount1) << 96) / sqrt(amount0), which keeps every
    ///      intermediate inside uint256 across the full decimal-gap range. The on-chain seed
    ///      then asserts slot0 stores exactly this value AND that it round-trips to the target
    ///      price within 1% (Phase1Deployer._assertPriceRoundTrips).
    function encodePriceSqrt(uint256 amount0, uint256 amount1) internal pure returns (uint160) {
        require(amount0 > 0, "PriceMath: amount0=0");
        uint256 root = (sqrt(amount1) << 96) / sqrt(amount0);
        require(root > 0, "PriceMath: sqrtPrice underflow");
        require(root <= type(uint160).max, "PriceMath: sqrtPrice overflow");
        return uint160(root);
    }

    /// @notice Round-trip a sqrtPriceX96 back to price1_per_0 scaled by `priceScale`.
    /// @dev price1_per_0 = (sqrtPriceX96 / 2^96)^2. Returned value is that ratio * priceScale.
    ///      Computed exactly with a 512-bit mulDiv so it is accurate across the FULL price range
    ///      (both ~1.6e15 and ~6e-16 raw ratios occur depending on token0/token1 ordering) — a
    ///      naive shift-based square loses precision and yields false round-trip failures.
    ///      = mulDiv(sqrtP*sqrtP, priceScale, 2^192). We split into two mulDiv-by-2^96 steps to
    ///      keep each intermediate exact.
    function priceFromSqrtX96(uint160 sqrtPriceX96, uint256 priceScale) internal pure returns (uint256) {
        uint256 p = uint256(sqrtPriceX96);
        uint256 Q96 = 0x1000000000000000000000000; // 2^96
        // step1 = mulDiv(p, priceScale, 2^96)
        uint256 step1 = mulDiv(p, priceScale, Q96);
        // result = mulDiv(step1, p, 2^96) = p^2 * priceScale / 2^192
        return mulDiv(step1, p, Q96);
    }

    /// @notice Full-precision floor(a*b/denominator), 512-bit intermediate (Uniswap FullMath).
    function mulDiv(uint256 a, uint256 b, uint256 denominator) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(a, b, not(0))
                prod0 := mul(a, b)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }
            if (prod1 == 0) {
                require(denominator > 0, "mulDiv: denom=0");
                return prod0 / denominator;
            }
            require(denominator > prod1, "mulDiv: overflow");
            uint256 remainder;
            assembly {
                remainder := mulmod(a, b, denominator)
            }
            assembly {
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }
            uint256 twos = denominator & (~denominator + 1);
            assembly {
                denominator := div(denominator, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;
            uint256 inverse = (3 * denominator) ^ 2;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            inverse *= 2 - denominator * inverse;
            result = prod0 * inverse;
        }
    }

    /// @notice Babylonian (Newton) integer square root.
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
