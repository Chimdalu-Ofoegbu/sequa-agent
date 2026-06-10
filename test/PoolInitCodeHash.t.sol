// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

/// @title PoolInitCodeHashTest
/// @notice Asserts the PATCHED PoolAddress.POOL_INIT_CODE_HASH equals the hash of THIS
///         build's locally-compiled UniswapV3Pool creation code (01-SPIKE-FINDINGS §d, D-43).
/// @dev The vendored periphery ships the 2021 mainnet constant, which does NOT match the
///      pool bytecode produced under this repo's settings (200 runs / paris / ipfs). If they
///      diverge, SwapRouter/NPM compute the wrong pool address off-chain and deploy/mint REVERTS.
///
///      We CANNOT `import {PoolAddress}` here: that 0.7.6 library uses the pre-0.8
///      `address(uint256(...))` cast and will not compile under this 0.8.24 test. Instead we
///      mirror the patched constant as a local literal (kept byte-identical to
///      lib/v3-periphery/contracts/libraries/PoolAddress.sol) and assert it against the live
///      build's hash read via vm.getCode. The build itself (which DOES compile the real
///      PoolAddress.sol at 0.7.6) is what consumes the file constant, so a mismatch between
///      this literal and the file would surface as a deploy/mint revert in Task 2 — this test
///      is the fast pre-flight guard. RE-RUN + RE-PATCH after ANY optimizer/evm_version change.
contract PoolInitCodeHashTest is Test {
    // Must stay byte-identical to PoolAddress.POOL_INIT_CODE_HASH in the vendored periphery.
    bytes32 internal constant PATCHED_POOL_INIT_CODE_HASH =
        0x3c168cc5d3311f0933f08b32142d0998baeecd13571089b4bb0cdeeaf401d70b;

    function test_PoolInitCodeHash_MatchesLiveBuild() public {
        // Explicit artifact JSON path so vm.getCode reads the 0.7.6 pool bytecode from disk
        // regardless of the test run's 0.8 compile set (PRE-REQ: `forge build`). See §e.
        bytes memory poolCreationCode = vm.getCode("out/UniswapV3Pool.sol/UniswapV3Pool.json");
        bytes32 liveHash = keccak256(poolCreationCode);
        emit log_named_bytes32("live UniswapV3Pool init code hash", liveHash);
        emit log_named_bytes32("patched POOL_INIT_CODE_HASH        ", PATCHED_POOL_INIT_CODE_HASH);
        assertEq(
            PATCHED_POOL_INIT_CODE_HASH,
            liveHash,
            "POOL_INIT_CODE_HASH mismatch: patch lib/v3-periphery/.../PoolAddress.sol AND this literal to the live hash logged above"
        );
    }
}
