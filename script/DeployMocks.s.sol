// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Phase1Deployer} from "./Phase1Deployer.sol";

/// @title DeployMocks
/// @notice Deploy the 4 mock ERC-20s (D-17/D-18) and mint 10k mUSDC to the operator (D-11).
/// @dev Reads DEPLOYER_PRIVATE_KEY + OPERATOR_PRIVATE_KEY. Logs the 4 token addresses for the
///      SequaConstants.sol / addresses.json write-back. Runnable standalone or via DeployPhase1.
///        forge script script/DeployMocks.s.sol:DeployMocks --rpc-url mantle_sepolia --broadcast --slow
contract DeployMocks is Phase1Deployer {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.addr(vm.envUint("OPERATOR_PRIVATE_KEY"));

        vm.startBroadcast(deployerKey);
        _deployMocks(deployer, operator);
        vm.stopBroadcast();
    }
}
