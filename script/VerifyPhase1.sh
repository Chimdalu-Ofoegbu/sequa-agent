#!/usr/bin/env bash
# Verify Phase 1 contracts on Mantle Sepolia Explorer (D-23/D-43).
# Usage: set -a; source .env; set +a; bash script/VerifyPhase1.sh
# Reads addresses from deployments/sepolia.json. Reads MANTLESCAN_API_KEY from env.
# Mirrors VerifyPhase0.sh; the 4 mocks add --constructor-args (name/symbol/decimals).

set -euo pipefail

if [ -z "${MANTLESCAN_API_KEY:-}" ]; then
  echo "MANTLESCAN_API_KEY not set; run \`set -a; source .env; set +a\` first." >&2
  exit 1
fi

# Etherscan V2 unified endpoint with chainid in the URL (RESEARCH Pitfall 4 / foundry.toml).
VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=5003"

j() { jq -r "$1" deployments/sepolia.json | tr -d '\r'; }

USDC=$(j '.contracts.mockUSDC.address')
WMNT=$(j '.contracts.mockWMNT.address')
METH=$(j '.contracts.mockMETH.address')
WETH=$(j '.contracts.mockWETH.address')
FACTORY=$(j '.contracts.univ3Factory.address')
NPM=$(j '.contracts.nonfungiblePositionManager.address')
ROUTER=$(j '.contracts.swapRouter.address')
QUOTER=$(j '.contracts.quoterV2.address')

verify_mock() {
  local addr="$1" name="$2" symbol="$3" decimals="$4"
  echo "Verifying MockERC20 ($symbol) at ${addr}..."
  local args
  args=$(cast abi-encode "constructor(string,string,uint8)" "$name" "$symbol" "$decimals")
  # auto_detect_solc resolves MockERC20's `^0.8.20` pragma to the highest installed 0.8.x
  # (0.8.28 here), which is what was DEPLOYED — verify against that exact version or the
  # bytecode won't match. (foundry.toml no longer hard-pins solc, so we pass it explicitly.)
  forge verify-contract "${addr}" src/mocks/MockERC20.sol:MockERC20 \
    --chain 5003 --verifier etherscan --verifier-url "${VERIFIER_URL}" \
    --etherscan-api-key "${MANTLESCAN_API_KEY}" \
    --compiler-version "0.8.28" --constructor-args "${args}" --watch
}

verify_venue() {
  # Vendored UniV3 venue (0.7.6). Verify against the vendored source path. The factory takes no
  # constructor args; NPM/Router/Quoter take (factory, WETH9[, descriptor]).
  local addr="$1" path="$2" args="${3:-}"
  echo "Verifying ${path} at ${addr}..."
  if [ -n "${args}" ]; then
    forge verify-contract "${addr}" "${path}" \
      --chain 5003 --verifier etherscan --verifier-url "${VERIFIER_URL}" \
      --etherscan-api-key "${MANTLESCAN_API_KEY}" \
      --compiler-version "0.7.6" --constructor-args "${args}" --watch || \
      echo "  (venue verify is best-effort — vendored 0.7.6 multi-file may need --flatten; mocks are the D-23 gate)"
  else
    forge verify-contract "${addr}" "${path}" \
      --chain 5003 --verifier etherscan --verifier-url "${VERIFIER_URL}" \
      --etherscan-api-key "${MANTLESCAN_API_KEY}" \
      --compiler-version "0.7.6" --watch || \
      echo "  (venue verify is best-effort)"
  fi
}

# ---- The D-23 gate: all 4 mocks verified ----
verify_mock "${USDC}" "USD Coin"    "mUSDC" 6
verify_mock "${WMNT}" "Wrapped MNT" "mWMNT" 18
verify_mock "${METH}" "Mantle ETH"  "mMETH" 18
verify_mock "${WETH}" "Wrapped ETH" "mWETH" 18

# ---- Venue (best-effort; the human-verify checkpoint confirms code is present) ----
WETH9="${WMNT}"
verify_venue "${FACTORY}" "lib/v3-core/contracts/UniswapV3Factory.sol:UniswapV3Factory"
verify_venue "${ROUTER}"  "lib/v3-periphery/contracts/SwapRouter.sol:SwapRouter" \
  "$(cast abi-encode 'constructor(address,address)' "${FACTORY}" "${WETH9}")"
verify_venue "${QUOTER}"  "lib/v3-periphery/contracts/lens/QuoterV2.sol:QuoterV2" \
  "$(cast abi-encode 'constructor(address,address)' "${FACTORY}" "${WETH9}")"
verify_venue "${NPM}"     "lib/v3-periphery/contracts/NonfungiblePositionManager.sol:NonfungiblePositionManager" \
  "$(cast abi-encode 'constructor(address,address,address)' "${FACTORY}" "${WETH9}" "0x0000000000000000000000000000000000000000")"

echo "Verification submitted. Update deployments/sepolia.json verified=true for each contract whose"
echo "explorer #code page renders 'Contract Source Code Verified'."
