// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Phase1Deployer} from "./Phase1Deployer.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title SeedLiquidity
/// @notice Create + initialize the 3 full-range fee=3000 pools (WMNT/USDC, mETH/USDC,
///         WETH/USDC) at the D-20 mainnet-like prices and mint LP (D-19/D-21/D-22).
/// @dev Idempotent create+init (D-22). sqrtPriceX96 is encoded from the SORTED raw seed
///      amounts (PriceMath.encodePriceSqrt) so the pool price and the LP reserve ratio are
///      consistent by construction; slot0 is read back and round-trip-asserted to within 1%
///      of the seeded ratio (Pitfall 3 — a 6-vs-18 decimal-gap error is off by ~10^12).
///      The seed amounts + pair set are NAMED CONSTANTS in Phase1Deployer (user requirement).
///      Runnable standalone (pass token env addrs + NPM_ADDR) or via DeployPhase1.
///        USDC_ADDR=.. WMNT_ADDR=.. METH_ADDR=.. WETH_ADDR=.. FACTORY_ADDR=.. NPM_ADDR=.. \
///          forge script script/SeedLiquidity.s.sol:SeedLiquidity --rpc-url mantle_sepolia --broadcast --slow
contract SeedLiquidity is Phase1Deployer {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        usdc = vm.envAddress("USDC_ADDR");
        wmnt = vm.envAddress("WMNT_ADDR");
        meth = vm.envAddress("METH_ADDR");
        weth = vm.envAddress("WETH_ADDR");
        factory = vm.envAddress("FACTORY_ADDR");
        npm = vm.envAddress("NPM_ADDR");
        quoterV2 = vm.envOr("QUOTER_ADDR", address(0));

        vm.startBroadcast(deployerKey);
        // Ensure the deployer holds enough of each token to seed (idempotent re-depth, D-22).
        MockERC20(usdc).mint(deployer, DEPLOYER_USDC_MINT);
        MockERC20(wmnt).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(meth).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(weth).mint(deployer, DEPLOYER_TOKEN18_MINT);
        _seedAllPools(deployer);
        vm.stopBroadcast();

        if (quoterV2 != address(0)) {
            _logQuotes();
        }
    }

    /// @notice Admin re-depth path (D-22): mint more tokens + add more full-range LP to a pool
    ///         for a <60s top-up if a long session drains it. Pool is created already, so this
    ///         just re-runs create+init (no-op) + a fresh mint.
    function topUp() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        usdc = vm.envAddress("USDC_ADDR");
        wmnt = vm.envAddress("WMNT_ADDR");
        meth = vm.envAddress("METH_ADDR");
        weth = vm.envAddress("WETH_ADDR");
        factory = vm.envAddress("FACTORY_ADDR");
        npm = vm.envAddress("NPM_ADDR");

        vm.startBroadcast(deployerKey);
        MockERC20(usdc).mint(deployer, DEPLOYER_USDC_MINT);
        MockERC20(wmnt).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(meth).mint(deployer, DEPLOYER_TOKEN18_MINT);
        MockERC20(weth).mint(deployer, DEPLOYER_TOKEN18_MINT);
        _seedAllPools(deployer);
        vm.stopBroadcast();
    }
}
