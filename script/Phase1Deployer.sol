// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {PriceMath} from "./PriceMath.sol";
import {
    IUniswapV3FactoryLike,
    IUniswapV3PoolLike,
    INonfungiblePositionManagerLike,
    IQuoterV2Like,
    IERC20Like
} from "./UniV3Interfaces.sol";

/// @title Phase1Deployer
/// @notice Shared deploy logic (venue + 4 mocks + 3 seeded pools) for the D-43 Wave-0 venue.
/// @dev The vendored canonical Uniswap V3 contracts are 0.7.6; this script is 0.8.x and
///      instantiates them via vm.deployCode, driving them through locally-declared interfaces
///      (01-SPIKE-FINDINGS §e). All EXPLICIT NAMED CONSTANTS below pin the exact fixed pair set
///      the source agent trades (WMNT/USDC, mETH/USDC, WETH/USDC at fee=3000) — never inline
///      magic numbers (user requirement). Inherited by DeployUniV3Fork / DeployMocks /
///      SeedLiquidity (each runs one phase) and by DeployPhase1 (runs all three atomically).
abstract contract Phase1Deployer is Script {
    // ---- Venue config (D-19 / D-43) ----
    uint24 internal constant POOL_FEE = 3000; // 0.30% tier — canonical UniV3 enables it by default
    int24 internal constant FULL_RANGE_TICK_LOWER = -887220; // tickSpacing 60, MIN_TICK rounded up
    int24 internal constant FULL_RANGE_TICK_UPPER = 887220; // tickSpacing 60, MAX_TICK rounded down
    int24 internal constant EXPECTED_TICK_SPACING = 60;

    // ---- Token decimals (D-18) ----
    uint8 internal constant USDC_DECIMALS = 6;
    uint8 internal constant TOKEN18_DECIMALS = 18;

    // ---- Operator starting balance (D-11) ----
    uint256 internal constant OPERATOR_USDC_START = 10_000e6; // 10,000 mUSDC

    // ---- Seed amounts (D-19 / D-20): modest, mainnet-like-priced depth per pool ----
    // Each token side encodes the D-20 price. USDC depth is sized per-pool so a single-token
    // swap stays near spot (the agent's real BUY/SELL sizes are ~2.5-3.3k USDC, D-07).
    //   WMNT @ $0.60  -> 5000 USDC  / 0.60  = 8333.333... WMNT   (~$5k each side, D-19 baseline)
    //   mETH @ $3200  -> 25000 USDC / 3200  = 7.8125 mETH        (DEVIATION from D-19's literal
    //   WETH @ $3200  -> 25000 USDC / 3200  = 7.8125 WETH         5k: a $3200 asset at 5k depth is
    //                                                              only 1.56 tokens — too thin for
    //                                                              the agent's per-trade size and
    //                                                              the human-verify quote. Deepened
    //                                                              to ~$25k so spot stays mainnet-
    //                                                              like (D-20) under real swaps.)
    uint256 internal constant SEED_WMNT_USDC_AMOUNT = 5_000e6; // 5,000 mUSDC for the WMNT pool
    uint256 internal constant SEED_ETH_USDC_AMOUNT = 25_000e6; // 25,000 mUSDC for the mETH/WETH pools
    uint256 internal constant SEED_WMNT_AMOUNT = 8333_333333333333333333; // ~8333.3333 mWMNT (18 dec) @ $0.60
    uint256 internal constant SEED_METH_AMOUNT = 7_812500000000000000; // 7.8125 mMETH (18 dec) @ $3200
    uint256 internal constant SEED_WETH_AMOUNT = 7_812500000000000000; // 7.8125 mWETH (18 dec) @ $3200

    // Deployer mints itself this much of each token for LP seeding (generous headroom over seed).
    uint256 internal constant DEPLOYER_USDC_MINT = 1_000_000e6;
    uint256 internal constant DEPLOYER_TOKEN18_MINT = 1_000_000e18;

    // Round-trip price guard tolerance: |observed - target| / target must be < 1%.
    uint256 internal constant PRICE_TOLERANCE_BPS = 100; // 1.00%

    // ---- Deployed addresses (populated during run) ----
    address internal factory;
    address internal npm;
    address internal swapRouter;
    address internal quoterV2;

    address internal usdc;
    address internal wmnt;
    address internal meth;
    address internal weth;

    address internal poolWmntUsdc;
    address internal poolMethUsdc;
    address internal poolWethUsdc;

    // ===================================================================================
    //  VENUE (D-43)
    // ===================================================================================

    /// @notice Deploy factory + NPM + SwapRouter + QuoterV2 via deployCode (0.7.6 boundary).
    /// @param weth9 The WETH9 the periphery wraps — we pass MockWMNT (venue is internal).
    function _deployVenue(address weth9) internal {
        // Use explicit artifact JSON paths (not "File.sol:Contract") so vm.getCode reads the
        // 0.7.6 artifacts straight from disk. forge script only compiles the 0.8 closure of the
        // target script and would otherwise report "no matching artifact found" for the vendored
        // 0.7.6 venue (01-SPIKE-FINDINGS §e). PRE-REQ: run `forge build` once so out/ holds these.
        factory = deployCode("out/UniswapV3Factory.sol/UniswapV3Factory.json");
        npm = deployCode(
            "out/NonfungiblePositionManager.sol/NonfungiblePositionManager.json",
            abi.encode(factory, weth9, address(0)) // tokenDescriptor=0 — not needed for mint
        );
        swapRouter = deployCode("out/SwapRouter.sol/SwapRouter.json", abi.encode(factory, weth9));
        quoterV2 = deployCode("out/QuoterV2.sol/QuoterV2.json", abi.encode(factory, weth9));

        // fee=3000 / tickSpacing 60 is enabled by default in the canonical factory; guard it.
        int24 spacing = IUniswapV3FactoryLike(factory).feeAmountTickSpacing(POOL_FEE);
        if (spacing == 0) {
            IUniswapV3FactoryLike(factory).enableFeeAmount(POOL_FEE, EXPECTED_TICK_SPACING);
            spacing = IUniswapV3FactoryLike(factory).feeAmountTickSpacing(POOL_FEE);
        }
        require(spacing == EXPECTED_TICK_SPACING, "venue: fee=3000 tickSpacing != 60 (D-19)");

        console2.log("UniV3Factory:", factory);
        console2.log("NonfungiblePositionManager:", npm);
        console2.log("SwapRouter:", swapRouter);
        console2.log("QuoterV2:", quoterV2);
    }

    // ===================================================================================
    //  MOCKS (D-11 / D-17 / D-18)
    // ===================================================================================

    /// @notice Deploy the 4 mocks, mint 10k mUSDC to operator, and stock the deployer for LP.
    function _deployMocks(address deployer, address operator) internal {
        usdc = address(new MockERC20("USD Coin", "mUSDC", USDC_DECIMALS));
        wmnt = address(new MockERC20("Wrapped MNT", "mWMNT", TOKEN18_DECIMALS));
        meth = address(new MockERC20("Mantle ETH", "mMETH", TOKEN18_DECIMALS));
        weth = address(new MockERC20("Wrapped ETH", "mWETH", TOKEN18_DECIMALS));

        // D-11: operator starts with exactly 10,000 mUSDC.
        MockERC20(usdc).mint(operator, OPERATOR_USDC_START);

        // Stock the deployer generously for LP seeding (>> seed amounts).
        MockERC20(usdc).mint(deployer, DEPLOYER_USDC_MINT);
        MockERC20(wmnt).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(meth).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(weth).mint(deployer, DEPLOYER_TOKEN18_MINT);

        console2.log("mUSDC:", usdc);
        console2.log("mWMNT:", wmnt);
        console2.log("mMETH:", meth);
        console2.log("mWETH:", weth);
        console2.log("operator mUSDC balance:", MockERC20(usdc).balanceOf(operator));
    }

    // ===================================================================================
    //  SEED (D-19 / D-20 / D-21 / D-22)
    // ===================================================================================

    /// @notice Create+init each pool at its D-20 price and mint a full-range LP position.
    function _seedAllPools(address recipient) internal {
        poolWmntUsdc = _seedPool(wmnt, usdc, SEED_WMNT_AMOUNT, SEED_WMNT_USDC_AMOUNT, recipient);
        poolMethUsdc = _seedPool(meth, usdc, SEED_METH_AMOUNT, SEED_ETH_USDC_AMOUNT, recipient);
        poolWethUsdc = _seedPool(weth, usdc, SEED_WETH_AMOUNT, SEED_ETH_USDC_AMOUNT, recipient);

        console2.log("pool WMNT/USDC:", poolWmntUsdc);
        console2.log("pool mETH/USDC:", poolMethUsdc);
        console2.log("pool WETH/USDC:", poolWethUsdc);
    }

    /// @notice Idempotent (D-22) create+init+mint for one pair. tokenA/tokenB are the non-USDC
    ///         and USDC token; amountA/amountB their raw seed amounts. Sorts to token0<token1,
    ///         encodes sqrtPriceX96 from the sorted raw amounts, round-trip-asserts the price
    ///         (Pitfall 3), then mints a full-range position.
    function _seedPool(
        address tokenA,
        address tokenB,
        uint256 amountA,
        uint256 amountB,
        address recipient
    ) private returns (address pool) {
        // Sort tokens ascending by address (token0 < token1) — Pitfall 3.
        (address token0, address token1, uint256 amount0, uint256 amount1) =
            tokenA < tokenB ? (tokenA, tokenB, amountA, amountB) : (tokenB, tokenA, amountB, amountA);

        uint160 sqrtPriceX96 = PriceMath.encodePriceSqrt(amount0, amount1);

        pool = INonfungiblePositionManagerLike(npm).createAndInitializePoolIfNecessary(
            token0, token1, POOL_FEE, sqrtPriceX96
        );
        require(pool != address(0), "seed: pool create returned address(0)");

        // Round-trip guard (Pitfall 3): assert slot0 matches the sqrtPriceX96 we computed AND
        // that it maps back to the seeded ratio within 1% (a 6-vs-18 gap error is off ~10^12).
        _assertPriceRoundTrips(pool, amount0, amount1, sqrtPriceX96);

        IERC20Like(token0).approve(npm, amount0);
        IERC20Like(token1).approve(npm, amount1);

        INonfungiblePositionManagerLike(npm).mint(
            INonfungiblePositionManagerLike.MintParams({
                token0: token0,
                token1: token1,
                fee: POOL_FEE,
                tickLower: FULL_RANGE_TICK_LOWER,
                tickUpper: FULL_RANGE_TICK_UPPER,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: 0,
                amount1Min: 0,
                recipient: recipient,
                deadline: block.timestamp + 1200
            })
        );
    }

    /// @notice Assert slot0().sqrtPriceX96 round-trips to within PRICE_TOLERANCE_BPS of the
    ///         price implied by the seeded raw amounts (amount1/amount0). Catches a 6-vs-18
    ///         decimal-gap error (Pitfall 3) — a wrong gap is off by ~10^12.
    function _assertPriceRoundTrips(address pool, uint256 amount0, uint256 amount1, uint160 expectedSqrtP)
        private
        view
    {
        (uint160 sqrtP,,,,,,) = IUniswapV3PoolLike(pool).slot0();
        // Strongest guard: the pool stored exactly the sqrtPriceX96 we seeded it with.
        require(sqrtP == expectedSqrtP, "roundtrip: slot0 sqrtPriceX96 != seeded value");
        uint256 SCALE = 1e18;
        // Observed price1_per_0 (scaled): from the pool's sqrtPriceX96.
        uint256 observed = PriceMath.priceFromSqrtX96(sqrtP, SCALE);
        // Target price1_per_0 (scaled): from the raw seed amounts.
        uint256 target = (amount1 * SCALE) / amount0;
        require(target > 0, "roundtrip: target=0");
        uint256 diff = observed > target ? observed - target : target - observed;
        // |diff|/target < PRICE_TOLERANCE_BPS/10000
        require(diff * 10_000 <= target * PRICE_TOLERANCE_BPS, "roundtrip: slot0 price off > 1% (Pitfall 3)");
    }

    // ===================================================================================
    //  QUOTE SANITY (post-seed)
    // ===================================================================================

    /// @notice QuoterV2 simulate for each non-USDC token; require amountOut > 0.
    /// @dev QuoterV2 is non-view (reverts+decodes internally) so this must run inside a state
    ///      context; callers invoke it after stopBroadcast as a read. We log a SMALL spot-grade
    ///      quote (0.01 token → ~spot price, negligible slippage; this is the mainnet-like price
    ///      the human-verify checkpoint confirms: WMNT~$0.60, mETH/WETH~$3200) AND a 1-token
    ///      quote (shows realistic slippage at the seeded depth).
    function _logQuotes() internal {
        // 0.01 token in → spot: multiply amountOut by 100 mentally to read $/token.
        _logOneQuote("WMNT->USDC spot(0.01in)", wmnt, usdc, 1e16);
        _logOneQuote("mETH->USDC spot(0.01in)", meth, usdc, 1e16);
        _logOneQuote("WETH->USDC spot(0.01in)", weth, usdc, 1e16);
        _logOneQuote("WMNT->USDC (1in)", wmnt, usdc, 1e18);
        _logOneQuote("mETH->USDC (1in)", meth, usdc, 1e18);
        _logOneQuote("WETH->USDC (1in)", weth, usdc, 1e18);
    }

    function _logOneQuote(string memory label, address tokenIn, address tokenOut, uint256 amountIn) private {
        try
            IQuoterV2Like(quoterV2).quoteExactInputSingle(
                IQuoterV2Like.QuoteExactInputSingleParams({
                    tokenIn: tokenIn,
                    tokenOut: tokenOut,
                    amountIn: amountIn,
                    fee: POOL_FEE,
                    sqrtPriceLimitX96: 0
                })
            )
        returns (uint256 amountOut, uint160, uint32, uint256) {
            console2.log(label, "amountOut(mUSDC raw):", amountOut);
            require(amountOut > 0, "quote: amountOut == 0");
        } catch {
            revert("quote: QuoterV2 simulate reverted");
        }
    }
}
