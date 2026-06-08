// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {SourceRegistry} from "../src/SourceRegistry.sol";
import {FollowRegistry} from "../src/FollowRegistry.sol";

/// @title DeployPhase0
/// @notice Deploys SourceRegistry + FollowRegistry to Mantle Sepolia.
/// @dev Reads DEPLOYER_PRIVATE_KEY from env. Run via:
///        forge script script/DeployPhase0.s.sol:DeployPhase0 \
///          --rpc-url mantle_sepolia \
///          --broadcast \
///          --slow
///      The deployer EOA becomes Ownable owner on both contracts (Phase 0 owner is the deployer per D-08).
contract DeployPhase0 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        SourceRegistry sourceRegistry = new SourceRegistry();
        FollowRegistry followRegistry = new FollowRegistry();

        vm.stopBroadcast();

        console2.log("SourceRegistry:", address(sourceRegistry));
        console2.log("FollowRegistry:", address(followRegistry));
        console2.log("Deployer:", vm.addr(deployerKey));
    }
}
