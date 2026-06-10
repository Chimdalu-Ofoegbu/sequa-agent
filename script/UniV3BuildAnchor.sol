// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;
pragma abicoder v2;

// Build anchor (01-SPIKE-FINDINGS §e, D-43).
//
// The vendored canonical Uniswap V3 contracts live in lib/ and are NOT in the default
// compilation graph because nothing in src/ imports them (src/ is 0.8.x and CANNOT import
// the 0.7.6 periphery/core across the version boundary). Without an anchor, `forge build`
// skips them, so `vm.getCode("UniswapV3Pool.sol:UniswapV3Pool")` (PoolInitCodeHash.t.sol)
// and `deployCode(...)` (DeployUniV3Fork.s.sol) find no artifact.
//
// This file is itself 0.7.6, so it CAN import them — its only job is to pull the four
// venue contracts (+ the pool) into the build so their artifacts are always produced.
// It declares no logic and is never deployed.
import {UniswapV3Factory} from "@uniswap/v3-core/contracts/UniswapV3Factory.sol";
import {UniswapV3Pool} from "@uniswap/v3-core/contracts/UniswapV3Pool.sol";
import {NonfungiblePositionManager} from "@uniswap/v3-periphery/contracts/NonfungiblePositionManager.sol";
import {SwapRouter} from "@uniswap/v3-periphery/contracts/SwapRouter.sol";
import {QuoterV2} from "@uniswap/v3-periphery/contracts/lens/QuoterV2.sol";

abstract contract UniV3BuildAnchor {}
