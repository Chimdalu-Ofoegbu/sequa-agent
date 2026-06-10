// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
pragma abicoder v2;

import {console2} from "forge-std/Script.sol";
import {Phase1Deployer} from "./Phase1Deployer.sol";

/// @title DeployPhase1
/// @notice Atomic Wave-0 venue deploy (D-43): UniV3 fork + 4 mocks + 3 seeded pools in one
///         broadcast, so the seeded pool prices and the deployer's LP token balances are
///         mutually consistent and the round-trip price guards run against fresh state.
/// @dev Reads DEPLOYER_PRIVATE_KEY (pays gas, holds LP) and OPERATOR_PRIVATE_KEY (receives the
///      10k mUSDC, D-11). Run:
///        forge script script/DeployPhase1.s.sol:DeployPhase1 --rpc-url mantle_sepolia \
///          --broadcast --slow
///      Simulate first WITHOUT --broadcast to catch script bugs before spending gas.
contract DeployPhase1 is Phase1Deployer {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address operator = vm.addr(vm.envUint("OPERATOR_PRIVATE_KEY"));

        vm.startBroadcast(deployerKey);

        // 1. Mocks first (the venue's WETH9 is MockWMNT, so mocks precede the venue).
        _deployMocks(deployer, operator);
        // 2. Venue, wrapping MockWMNT as WETH9.
        _deployVenue(wmnt);
        // 3. Seed the 3 full-range pools at D-20 prices; LP NFTs go to the deployer.
        _seedAllPools(deployer);

        vm.stopBroadcast();

        // 4. Post-deploy QuoterV2 sanity (non-broadcast read): each pool quotes > 0.
        _logQuotes();

        console2.log("Deployer:", deployer);
        console2.log("Operator:", operator);
    }
}
