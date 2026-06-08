#!/usr/bin/env bash
# Verify Phase 0 contracts on Mantle Sepolia Explorer.
# Usage: set -a; source .env; set +a; bash script/VerifyPhase0.sh
# Reads addresses from deployments/sepolia.json. Reads MANTLESCAN_API_KEY from env.
# Env-load policy: matches Plan 04 Task 3 (`source .env`) — forge has no --env-file flag.

set -euo pipefail

if [ -z "${MANTLESCAN_API_KEY:-}" ]; then
  echo "MANTLESCAN_API_KEY not set; run \`set -a; source .env; set +a\` first." >&2
  exit 1
fi

SOURCE_ADDR=$(jq -r '.contracts.sourceRegistry.address' deployments/sepolia.json)
FOLLOW_ADDR=$(jq -r '.contracts.followRegistry.address' deployments/sepolia.json)

if [ "${SOURCE_ADDR}" = "null" ] || [ "${FOLLOW_ADDR}" = "null" ]; then
  echo "deployments/sepolia.json missing contract addresses." >&2
  exit 1
fi

echo "Verifying SourceRegistry at ${SOURCE_ADDR}..."
forge verify-contract \
  "${SOURCE_ADDR}" \
  src/SourceRegistry.sol:SourceRegistry \
  --chain 5003 \
  --verifier etherscan \
  --verifier-url "https://api-sepolia.mantlescan.xyz/api" \
  --etherscan-api-key "${MANTLESCAN_API_KEY}" \
  --watch

echo "Verifying FollowRegistry at ${FOLLOW_ADDR}..."
forge verify-contract \
  "${FOLLOW_ADDR}" \
  src/FollowRegistry.sol:FollowRegistry \
  --chain 5003 \
  --verifier etherscan \
  --verifier-url "https://api-sepolia.mantlescan.xyz/api" \
  --etherscan-api-key "${MANTLESCAN_API_KEY}" \
  --watch

echo "Verification submitted. Update deployments/sepolia.json verified=true and verificationUrl=https://sepolia.mantlescan.xyz/address/<addr>#code"
