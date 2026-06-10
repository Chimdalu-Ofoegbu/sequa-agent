// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SourceRegistry} from "../src/SourceRegistry.sol";

/// @title DeploySourceRegistryV1
/// @notice Redeploys the Phase 1 EXTENDED SourceRegistry to Mantle Sepolia (D-31).
/// @dev Reads DEPLOYER_PRIVATE_KEY from env. Run via:
///        forge script script/DeploySourceRegistryV1.s.sol:DeploySourceRegistryV1 \
///          --rpc-url mantle_sepolia \
///          --broadcast \
///          --slow
///      This is a FRESH contract at a NEW address — Phase 0's agentId 1 does NOT carry over
///      (RESEARCH State Inventory). The deployer EOA becomes the Ownable owner (D-08).
///      Per D-31, ONLY SourceRegistry is redeployed here; the follow-side registry is intentionally
///      left untouched and stays at its existing Phase 0 address.
///      The actual on-chain redeploy + verify + manifest update happens in Plan 06 alongside the
///      live smoke (redeploy needs the venue context). This script only needs to COMPILE in Plan 02.
contract DeploySourceRegistryV1 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        SourceRegistry sourceRegistry = new SourceRegistry();

        vm.stopBroadcast();

        console2.log("SourceRegistry:", address(sourceRegistry));
        console2.log("Deployer:", vm.addr(deployerKey));
    }
}
