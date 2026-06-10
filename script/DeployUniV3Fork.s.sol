// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Phase1Deployer} from "./Phase1Deployer.sol";

/// @title DeployUniV3Fork
/// @notice Deploy the canonical Uniswap V3 venue (factory + NonfungiblePositionManager +
///         SwapRouter + QuoterV2) on Mantle Sepolia (D-43). FusionX V3 is verifiably absent
///         from chain 5003 (RESEARCH Pitfall 1) so we self-deploy the venue.
/// @dev The venue is 0.7.6; this 0.8.x script instantiates it via vm.deployCode across the
///      version boundary (01-SPIKE-FINDINGS §e). Pre-req: PoolAddress.POOL_INIT_CODE_HASH
///      patched in Task 1. WETH9 = the MockWMNT address (env WMNT_ADDR), since the venue is
///      internal. Asserts fee=3000 / tickSpacing 60 is enabled (D-19). Runnable standalone
///      (after DeployMocks, pass WMNT_ADDR) or via DeployPhase1.
///        WMNT_ADDR=0x.. forge script script/DeployUniV3Fork.s.sol:DeployUniV3Fork \
///          --rpc-url mantle_sepolia --broadcast --slow
contract DeployUniV3Fork is Phase1Deployer {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address weth9 = vm.envAddress("WMNT_ADDR"); // MockWMNT deployed by DeployMocks

        vm.startBroadcast(deployerKey);
        _deployVenue(weth9);
        vm.stopBroadcast();
    }
}
