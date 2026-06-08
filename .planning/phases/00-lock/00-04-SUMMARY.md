---
phase: 00-lock
plan: 04
subsystem: deploy-and-verify
tags: [foundry, mantle-sepolia, deploy, verify, mantlescan, etherscan-v2, req-12]
dependency_graph:
  requires:
    - 00-01 (foundry-toolchain-pinned, etherscan endpoint configured)
    - 00-02 (source-registry-contract artifact + bytecode)
    - 00-03 (follow-registry-skeleton artifact + bytecode)
  provides:
    - sourceregistry-deployed-sepolia
    - followregistry-deployed-sepolia
    - both-contracts-verified-on-mantle-explorer
    - deployments-sepolia-manifest
    - verify-phase0-wrapper-v2-endpoint
  affects:
    - 00-05 (e2e test consumes deployments/sepolia.json addresses for recordSignal → mirror)
    - Phase 5 mainnet redeploy (same deploy script reused; same verify wrapper with chainid=5000)
    - DoraHacks submission packet (verification URLs + addresses paste into the submission)
tech_stack:
  added: []
  patterns:
    - "forge script --rpc-url <alias> --broadcast --slow" — broadcast policy for L2 where gas estimates can be flaky
    - "set -a; source .env; set +a" — locked env-load pattern (forge script has no --env-file flag)
    - "forge verify-contract --watch" with Etherscan V2 unified endpoint + chainid query param
    - Parse `broadcast/<script>/<chainid>/run-latest.json` for canonical addresses + tx hashes (machine-truth, not log-scrape)
    - "cast call <addr> <fn> <arg> --rpc-url <url>" for post-deploy bytecode-responds-to-locked-surface sanity check
key_files:
  created:
    - script/DeployPhase0.s.sol
    - script/VerifyPhase0.sh
    - deployments/sepolia.json
  modified:
    - .gitignore (added deploy-phase0.log + verify-phase0.log transient artifacts)
decisions:
  - "Etherscan V2 unified endpoint (https://api.etherscan.io/v2/api?chainid=5003) — the Mantlescan V1 endpoint (api-sepolia.mantlescan.xyz/api) was decommissioned. Forge 1.5.1 does not yet pass chainid for V2 natively, so embedding it as a URL query param is the working pattern."
  - "Parse broadcast/.../run-latest.json (Foundry machine-generated truth source) for addresses + tx hashes — log-scrape is the fallback only."
  - "Locked env-load pattern: `set -a; source .env; set +a` — consistent across Task 3 and Task 5; the VerifyPhase0.sh header instructs the same."
  - "deploy-phase0.log + verify-phase0.log gitignored — transient measurement artifacts; the broadcast/.../run-latest.json JSON is the authoritative source for forensics."
metrics:
  duration_seconds: 542
  tasks_completed: 5
  files_created: 3
  files_modified: 1
  commits: 4
  completed_date: "2026-06-08"
commits:
  - hash: 98e2c44
    type: feat
    subject: "add Phase 0 deploy forge-script"
  - hash: 39a2cad
    type: feat
    subject: "deploy SourceRegistry + FollowRegistry to Mantle Sepolia"
  - hash: 26a375b
    type: feat
    subject: "add Mantle Explorer verification wrapper"
  - hash: e86a0e4
    type: feat
    subject: "verify both Phase 0 contracts on Mantle Explorer"
---

# Phase 0 Plan 04: Deploy + Verify on Mantle Sepolia Summary

**One-liner:** SourceRegistry + FollowRegistry deployed and verified on Mantle Sepolia (chain 5003) via a 4-commit deploy/verify flow that auto-recovered from Mantlescan's V1-endpoint decommissioning by switching the verifier to the Etherscan V2 unified API with `?chainid=5003` embedded in the URL — REQ-12's "deployed AND verified on Mantle Explorer" technical bar is literally cleared.

## What Was Built

### Deployment artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Deploy forge-script | `script/DeployPhase0.s.sol` | Broadcasts both `new` calls in one `vm.startBroadcast` window; emits addresses via `console2.log` for capture |
| Verify wrapper | `script/VerifyPhase0.sh` | Idempotent `forge verify-contract --watch` against Etherscan V2 unified API; reads addresses from manifest (single source of truth) |
| Deployment manifest | `deployments/sepolia.json` | Canonical record: addresses + tx hashes + explorer URLs + verification URLs + verified flags — Plan 05 consumes this |

### Live on-chain state (Mantle Sepolia, chain 5003)

| Contract | Address | Deploy tx | Verification URL |
|----------|---------|-----------|------------------|
| SourceRegistry | `0x97a724ca8d70aee206b8d56925a735511d3cd5c8` | `0xffd279be92b4cf4c7b02b38c15a5b7f860a9d66c5fb841f2ecb9451db9fea08a` | [sepolia.mantlescan.xyz/...#code](https://sepolia.mantlescan.xyz/address/0x97a724ca8d70aee206b8d56925a735511d3cd5c8#code) |
| FollowRegistry | `0x8d5593076161321af5433742f7514172f2786aec` | `0x111aac30b8e73a5bdc576da3cebbb21e52e971274a06b6e74ed7c68ccb7e49fc` | [sepolia.mantlescan.xyz/...#code](https://sepolia.mantlescan.xyz/address/0x8d5593076161321af5433742f7514172f2786aec#code) |

**Deployer (Ownable owner on both contracts):** `0x0C837aDA52E8Dd4b16Ae39D864FD5eEB82B80b21` (D-08 — Phase 0 owner = deployer EOA; ownership-transfer-to-multisig deferred).

### Deploy gas (informs Phase 1/2 gas budgeting and mainnet deploy cost projection)

| Contract | gasUsed | Hex |
|----------|---------|-----|
| SourceRegistry | 605,810 | 0x93e72 |
| FollowRegistry | 701,662 | 0xab4de |
| **Total** | **1,307,472** | — |

At Mantle Sepolia's ~100 gwei estimated gas price, total deploy spend ≈ 0.131 MNT (testnet). Mainnet at ~0.02 gwei (typical L2) would be roughly 0.000026 MNT (~$0.00002 at $0.80 MNT) — a reference number for the Phase 5 mainnet deploy budget.

### Bytecode-responds-to-locked-surface sanity check (passed before manifest commit)

```
$ cast call 0x97a724ca... "performance(uint256)" 0 --rpc-url https://rpc.sepolia.mantle.xyz
0x0000...0000 0x0000...0000   # (signalCount=0, lastSignalAt=0) — locked SourceRegistry surface

$ cast call 0x8d5593... "followersOf(uint256)" 0 --rpc-url https://rpc.sepolia.mantle.xyz
0x0...0020 0x0...0000          # ABI-encoded empty address[] — locked FollowRegistry surface
```

Two independent confirmations (parsed `run-latest.json` + `cast call` against locked surface) before the address was trusted — T-00-D-02 (address-misrecording) mitigation per the plan's threat model.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking fix] Mantlescan V1 verification endpoint was decommissioned**

- **Found during:** Task 5 (first `forge verify-contract` invocation)
- **Issue:** The plan's verifier URL `https://api-sepolia.mantlescan.xyz/api` returned:
  > `Error: Failed to obtain contract ABI ... You are using a deprecated V1 endpoint, switch to Etherscan API V2 using https://docs.etherscan.io/v2-migration`
- **Investigation:** Direct curl against the V2 unified endpoint `https://api.etherscan.io/v2/api?chainid=5003&...apikey=...` with the same Mantlescan API key returned the expected "Contract source code not verified" JSON — confirming the V2 endpoint accepts Mantlescan keys and operates correctly. The remaining issue was that Foundry 1.5.1's `forge verify-contract` does NOT yet pass `chainid` as a query param for V2 (it still uses the V1 path-based scheme), even when `--chain 5003` is set.
- **Fix:** Embedded the chainid directly in the verifier URL: `https://api.etherscan.io/v2/api?chainid=5003`. Foundry passes this URL verbatim and V2 routes correctly.
- **Verification:**
  ```
  Submitting verification for [src/SourceRegistry.sol:SourceRegistry] 0x97A...5C8.
  Submitted contract for verification: Response: OK
  Contract verification status: Response: OK / Details: Pass - Verified
  Contract successfully verified
  ```
  Same flow for FollowRegistry. Both contracts now show the green "Contract Source Code Verified (Exact Match)" badge on Mantle Explorer.
- **Files modified:** `script/VerifyPhase0.sh` (replaced hardcoded V1 URL with `VERIFIER_URL` constant + NatSpec comment explaining why V2 + chainid-in-URL is required)
- **Commit:** `e86a0e4`
- **Impact on later phases:** Phase 5 mainnet deploy MUST use the same V2 endpoint (`https://api.etherscan.io/v2/api?chainid=5000` for Mantle Mainnet). Phase 5's verify wrapper can be parameterized on chainid for cleanliness. The Plan 01 `[etherscan]` block in `foundry.toml` still pins the deprecated V1 URL (`https://api-sepolia.mantlescan.xyz/api`); if a downstream agent runs `forge verify-contract` without `--verifier-url`, it will hit the V1 endpoint and fail. Recommend Phase 1 or Phase 5 plans add a follow-up to update `foundry.toml`'s etherscan endpoint to the V2 URL with chainid. Flagged as deferred-item.

**2. [Rule 2 — Hygiene] Gitignore `deploy-phase0.log` + `verify-phase0.log`**

- **Found during:** Task 3 (post-deploy `git status` showed `deploy-phase0.log` as untracked)
- **Issue:** Forge's `tee deploy-phase0.log` and `tee verify-phase0.log` produce local transient artifacts the plan never instructed to commit, but the existing `.gitignore` (Plan 01) didn't cover them. Leaving them untracked violates the executor "never leave generated files untracked" policy.
- **Fix:** Added both log filenames to `.gitignore` with a comment block explaining `broadcast/.../run-latest.json` is the canonical truth source.
- **Files modified:** `.gitignore`
- **Commit:** `39a2cad` (rolled into Task 3 commit)
- **Impact:** None — strictly hygiene; the `broadcast/` directory was already gitignored by Plan 01 for the same reason.

### Style/Documentation Notes (Not Auto-Fixed)

- **`foundry.toml` `[etherscan]` block still points at V1 URL.** Not modified in this plan because the wrapper script overrides via `--verifier-url`. If downstream agents run `forge verify-contract` without explicit `--verifier-url`, they will hit V1 and fail. Flagged for a future plan to update.

## Verify Block Evidence (all 5 steps pass)

```
=== Verify Step 1/5: verified=true on both contracts ===
true
=== Verify Step 2/5: sourceRegistry verificationUrl ends with #code ===
true
=== Verify Step 3/5: followRegistry verificationUrl ends with #code ===
true
=== Verify Step 4/5: SourceRegistry verification page returns HTTP 200 ===
HTTP 200
=== Verify Step 5/5: FollowRegistry verification page returns HTTP 200 ===
HTTP 200
=== All 5 verify steps passed ===
```

## Authentication Gates

The plan's checkpoint 2 (`human-action` — deployer key + Mantlescan API key + funded EOA) was satisfied by the user BEFORE this executor was spawned (state pre-confirmed in the executor's spawn prompt). The executor skipped the wait-for-user gate entirely and proceeded straight from Task 1 → Task 3 → Task 4 → Task 5. The deployer EOA balance was confirmed at 100 MNT (1e20 wei) before broadcast.

Final remaining gate: **Task 6 (`checkpoint:human-verify`)** — the orchestrator owns presenting the verify-on-Explorer eyeball check to the user. This executor stops here and returns the structured checkpoint payload.

## Verify Retries / Gotchas

- **Retry count:** 1 retry on SourceRegistry (V1 endpoint failed; V2 succeeded on first attempt with the URL fix). 0 retries on FollowRegistry (V2 succeeded first try with the same fix). No bytecode-mismatch failures, no "Already Verified" passes — both went through the "Pass - Verified" path cleanly.
- **Verification time:** ~30 seconds each (Mantle Explorer responded to GUID polling after 15s; the second poll returned `Pass - Verified`).
- **Mantle Explorer page render:** Both `#code` pages returned HTTP 200 immediately after verification — no eventual-consistency delay observed.

## Known Stubs

None. Deployment manifest is fully populated; both contracts respond to their locked surfaces; both verification pages render the verified source.

`testTransaction` field in `deployments/sepolia.json` is `null` by design — Plan 05 (the next plan in this phase) is the one that submits the `recordSignal → mirror` end-to-end test tx and fills it in.

## Threat Flags

None new beyond the plan's `<threat_model>` register:

- **T-00-D-01 (.env leak)** — `.env` confirmed NOT in `git status` at every checkpoint; gitignore rule `:4:.env` matches.
- **T-00-D-02 (address misrecording)** — addresses parsed from `broadcast/.../run-latest.json` AND independently confirmed via `cast call` against the locked surface. Two-source confirmation honored.
- **T-00-D-03 (wrong contract verified at right address)** — `forge verify-contract --watch` reported "Pass - Verified" with exact-match bytecode hash for both contracts. Mantle Explorer cryptographically asserts the match.
- **T-00-D-04 (verification page not publicly accessible)** — HTTP 200 asserted via `curl -s -o /dev/null -w '%{http_code}'` returning the literal string `200` for both `#code` pages. `curl -f` intentionally NOT used (would mask failure modes — per plan's anti-`-f` policy).
- **T-00-D-05 (Sepolia RPC instability)** — accepted; no RPC instability observed during this execution.
- **T-00-D-06 (deployer EOA loss)** — accepted; user holds the key out-of-band.

## Self-Check: PASSED

- FOUND: `script/DeployPhase0.s.sol` (compiles clean under Solc 0.8.24)
- FOUND: `script/VerifyPhase0.sh` (uses Etherscan V2 endpoint with chainid=5003)
- FOUND: `deployments/sepolia.json` (valid JSON, both addresses 42-char `0x...`, both tx hashes 66-char `0x...`, chainId=5003, both `verified: true`, both `verificationUrl` end with `#code`)
- FOUND: Commit `98e2c44` (Task 1 — feat: deploy forge-script)
- FOUND: Commit `39a2cad` (Task 3 — feat: deploy SourceRegistry + FollowRegistry to Mantle Sepolia)
- FOUND: Commit `26a375b` (Task 4 — feat: Mantle Explorer verification wrapper)
- FOUND: Commit `e86a0e4` (Task 5 — feat: verify both Phase 0 contracts on Mantle Explorer)
- VERIFIED: `cast call 0x97a724ca... "performance(uint256)" 0 --rpc-url https://rpc.sepolia.mantle.xyz` returns two 32-byte zero values
- VERIFIED: `cast call 0x8d559307... "followersOf(uint256)" 0 --rpc-url https://rpc.sepolia.mantle.xyz` returns ABI-encoded empty `address[]`
- VERIFIED: HTTP 200 from both `#code` pages
- VERIFIED: `.env` NOT in `git status` at any point during execution (`git check-ignore -v .env` matches `.gitignore:4`)
- VERIFIED: REQ-12 "Contracts deployed on Mantle Testnet" + "Contracts verified on Mantle Explorer" — both literal sub-criteria cleared

## Deferred Items (flagged for future plans)

- **`foundry.toml [etherscan] mantle_sepolia` URL still points at V1 endpoint.** A future plan should update this to `https://api.etherscan.io/v2/api?chainid=5003` so `forge verify-contract` works without explicit `--verifier-url`. Out of scope for Plan 04 (the wrapper script overrides via flag; downstream consumers can copy the wrapper pattern).
