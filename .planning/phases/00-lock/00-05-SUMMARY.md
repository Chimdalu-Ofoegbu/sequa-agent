---
phase: 00-lock
plan: 05
subsystem: e2e-test-and-deployment-packet
tags: [foundry, mantle-sepolia, e2e-test, recordSignal, mirror, dorahacks, req-02, req-12, phase-0-close]
dependency_graph:
  requires:
    - 00-04 (verified contracts on Mantle Sepolia; deployments/sepolia.json with verified=true)
    - .env (DEPLOYER_PRIVATE_KEY + FOLLOWER_PRIVATE_KEY + MANTLE_SEPOLIA_RPC populated)
  provides:
    - e2e-recordSignal-mirror-tx-sequence-live-on-sepolia
    - deployments-sepolia-manifest-with-testTransaction-populated
    - dorahacks-submission-packet (DEPLOYMENT.md)
    - phase-0-complete-deployment-award-technical-bar-cleared
  affects:
    - Phase 1 planning (consumes deployments/sepolia.json addresses for live signal stream)
    - Phase 5 submission (DEPLOYMENT.md is the literal text pasted into DoraHacks)
tech_stack:
  added: []
  patterns:
    - "Anchored tx-hash extraction: grep -E '^transactionHash' <log> | grep -oE '0x[a-fA-F0-9]{64}' | head -1 — the plan's unanchored pattern returned blockHash (first hex in cast send output); fix applied across all three Task 2 steps"
    - "cast keccak <event-signature> for topic[0] derivation, used to filter the receipt logs precisely"
    - "Independent follower EOA (option-a) — distinct from deployer for honest 'a real follower mirrored the source' narrative on Explorer"
    - "Sentinel executor placeholder pattern — deployer EOA satisfies ZeroExecutor guard while Phase 2 SequaExecutor is under construction; documented inline in DEPLOYMENT.md for judge readability"
    - "7-item REQ-12 checklist mirroring live DoraHacks fine print (3 Technical + 3 Product Completeness + 1 Documentation) — supersedes the 6-item template from the plan"
key_files:
  created:
    - .planning/phases/00-lock/DEPLOYMENT.md
  modified:
    - deployments/sepolia.json (testTransaction block populated)
decisions:
  - "Used option-a (independent follower EOA 0xeC31...B615) per spawn-prompt pre-resolved checkpoint — distinct from deployer 0x0C83...B21. Honest 'independent follower mirrored the source' narrative for DoraHacks submission and Phase 1/2 demo continuity."
  - "Switched to 7-item REQ-12 checklist (3 Technical + 3 Product Completeness + 1 Documentation) per confirmed-verbatim DoraHacks fine print, not the 6-item plan template. Aligns DEPLOYMENT.md with the official award rules exactly."
  - "Anchored tx-hash extraction on '^transactionHash' instead of taking the first hex string — cast send output prints blockHash before transactionHash; the plan's unanchored grep would have captured the wrong 32-byte value."
  - "Executor placeholder = deployer EOA (not address(0), not a third wallet) — FollowRegistry.mirror() rejects address(0) with ZeroExecutor, and minting a third EOA just to satisfy the guard would muddy the narrative. Sentinel-placeholder pattern documented inline in DEPLOYMENT.md so judges reading the mirror tx Explorer page can reconcile."
metrics:
  duration_seconds: 360
  tasks_completed: 3
  files_created: 1
  files_modified: 1
  commits: 3
  completed_date: "2026-06-08"
commits:
  - hash: 6a21d47
    type: feat
    subject: "submit e2e registerSource → recordSignal → mirror sequence"
  - hash: 5105051
    type: docs
    subject: "add DoraHacks-ready DEPLOYMENT.md submission packet"
---

# Phase 0 Plan 05: End-to-end Test + Deployment Packet Summary

**One-liner:** Closing wave of Phase 0 — submitted live `registerSource → recordSignal → mirror` transaction sequence on Mantle Sepolia using an independent follower EOA, captured all three tx hashes plus full gas accounting in `deployments/sepolia.json`, and wrote the DoraHacks-ready `DEPLOYMENT.md` with the 7-item REQ-12 checklist mirroring the official award fine print verbatim. The 20 Project Deployment Award **Technical Deployment** bar is now literally cleared with seven days of buffer to the 2026-06-15 deadline.

## What Was Built

### Live on-chain transaction sequence (Mantle Sepolia, chain 5003)

| Step | Function call | From | Tx hash | Gas |
|---|---|---|---|---|
| 1 | `SourceRegistry.registerSource(1, "phase0-demo-source-v1")` | Deployer `0x0C837aDA52E8Dd4b16Ae39D864FD5eEB82B80b21` | [`0x0ebb8ba0...`](https://sepolia.mantlescan.xyz/tx/0x0ebb8ba06db5a30521c06adc08ba7a9cad0777fbf892ee3d32a5063c63c468c0) | 96,941 |
| 2 | `SourceRegistry.recordSignal(1, ExactInputSingleParams_bytes)` — **the AI-callable on-chain function** | Deployer | [`0x58eda28a...`](https://sepolia.mantlescan.xyz/tx/0x58eda28ab912bbeb29d3329e546f00914919f62f4d1f9b2f56bbc9fb7eba4e1e) | 58,639 |
| 3 | `FollowRegistry.mirror(1, 1e18, deployerSentinel)` | Follower `0xeC31eFDd7F62b418cA4938D22b32C3930C35B615` | [`0x23bed06b...`](https://sepolia.mantlescan.xyz/tx/0x23bed06b125f90a62ed6f2072952eda239f219612627bb43a07679d927c331d2) | 188,009 |

**Total demo gas:** 343,589 (a useful Phase 1/2 reference for sizing the live mirror engine's mainnet budget).

### Final contract state on Mantle Sepolia

| Read call | Returns | Meaning |
|---|---|---|
| `SourceRegistry.performance(1)` | `(signalCount=1, lastSignalAt=0x6a26597f / 1780899199)` | AI signal advanced the on-chain track record |
| `FollowRegistry.followersOf(1)` | `[0xeC31eFDd7F62b418cA4938D22b32C3930C35B615]` | Follow graph captured the mirror authorization from an independent EOA |
| `FollowRegistry.following(0xeC31...B615)` | `[1]` | Bidirectional index intact |

### Event topics emitted and confirmed against `cast keccak`

| Event | Topic[0] | Confirmed in tx |
|---|---|---|
| `SourceRegistered(uint256,address,string)` | `0x98996457a35f62b9de68ac7dfff0630b1567518cecd7399eabb3898772d46bc1` | step 1 |
| `SignalRecorded(uint256,uint256,bytes,uint64)` | `0x7891497d451a0f147598b8343c1af23636dde3dd80b83907d55ee3102b141c24` | step 2 |
| `Mirrored(uint256,address,uint256,address)` | `0x3212bde75751a36f8939226036d2fffc980201bb7f58e790b20578e7f209b375` | step 3 |

All three event-topic hashes were derived inline via `cast keccak <signature>` and matched against the receipt `logs[0].topics[0]` of each tx.

### Final contracts on Mantle Sepolia (still verified from Plan 04)

| Contract | Address | Verification |
|---|---|---|
| SourceRegistry | `0x97a724ca8d70aee206b8d56925a735511d3cd5c8` | [Verified](https://sepolia.mantlescan.xyz/address/0x97a724ca8d70aee206b8d56925a735511d3cd5c8#code) |
| FollowRegistry | `0x8d5593076161321af5433742f7514172f2786aec` | [Verified](https://sepolia.mantlescan.xyz/address/0x8d5593076161321af5433742f7514172f2786aec#code) |

### Submission packet

- `.planning/phases/00-lock/DEPLOYMENT.md` — single-page, copy-paste-ready submission paragraph. Contains both contract addresses, both verification URLs, all three test tx hashes + Explorer URLs, the AI-callable-function narrative, the executor-placeholder rationale paragraph, the 7-item REQ-12 checklist, Mantle Sepolia chain context, and toolchain provenance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's tx-hash extraction grep returned `blockHash`, not `transactionHash`**

- **Found during:** Task 2 Step 1 (first `cast send` invocation)
- **Issue:** The plan-prescribed extraction `grep -oE '0x[a-fA-F0-9]{64}' /tmp/cast-XXX.log | head -1` takes the first 32-byte hex string in `cast send` output. Cast prints `blockHash` BEFORE `transactionHash` in its plaintext receipt format, so the first hit captures the wrong value. The plan's stated intent was "the first 32-byte hex string is the tx hash on every Foundry version since 2022," but Foundry 1.5.1's receipt format breaks that assumption.
- **Investigation:** Visual scan of the first `cast-register.log` showed `blockHash 0x599312...` printed on line 1 and `transactionHash 0x0ebb8b...` printed later. The receipt's `logs[].transactionHash` field also confirmed the correct value.
- **Fix:** Anchored the regex on the `^transactionHash` line: `grep -E '^transactionHash' /tmp/cast-XXX.log | grep -oE '0x[a-fA-F0-9]{64}' | head -1`. Applied uniformly across Task 2 Steps 1, 2, 3.
- **Verification:** All three captured tx hashes resolved to live, public Mantle Explorer pages with the expected event topics. `cast call` post-state queries returned the expected mutations.
- **Files modified:** None on disk — the fix was inline in the executor commands. The pattern is documented in this SUMMARY for future agents.
- **Commit:** Rolled into `6a21d47`.

**2. [Rule 2 — Hygiene] DEPLOYMENT.md placeholder gate caught `<ABI-encoded ExactInputSingleParams>` literal-description**

- **Found during:** Task 3 Verify Step 4/4
- **Issue:** Original draft included `<ABI-encoded ExactInputSingleParams>` as a literal description of the signal payload format. The strict placeholder-gate regex `<[a-zA-Z][^>]*>` (intended to catch unresolved template `<address>`-style tokens) caught it as a false positive — but the plan's acceptance criteria explicitly states "NO unresolved `<placeholder>` angle-brackets remain anywhere in the file body." Gate is strict; description must be rephrased.
- **Fix:** Reworded the table row to `recordSignal(1, signal_bytes) ... signal_bytes is the ABI-encoded ExactInputSingleParams tuple described below` — preserves the meaning, removes the angle brackets. Same content, different phrasing.
- **Files modified:** `.planning/phases/00-lock/DEPLOYMENT.md`
- **Commit:** Rolled into `5105051` (Task 3 commit).

**3. [Rule 2 — Required-by-criteria] Switched to 7-item REQ-12 checklist per official DoraHacks fine print**

- **Found during:** Task 3 (DEPLOYMENT.md draft)
- **Issue:** Plan template prescribed a 6-item REQ-12 checklist. The spawn-prompt `<official_award_criteria>` block (verbatim from the live DoraHacks page during this session) specifies SEVEN items in three sections: Technical Deployment (3), Product Completeness (3), Documentation (1).
- **Fix:** Restructured the REQ-12 section to mirror the official 7-item layout. Phase 0 marks all 3 Technical Deployment items as `[x]` (cleared); Phases 4 + 5 carry the remaining `[ ]` items. The "first-come, first-served — 20 spots only" race-condition note added at the bottom to anchor the urgency story.
- **Files modified:** `.planning/phases/00-lock/DEPLOYMENT.md` REQ-12 section.
- **Commit:** Rolled into `5105051` (Task 3 commit).

### No Architectural Changes (Rule 4) needed

The plan's task structure was sound; only the tx-hash extraction pattern, one wording, and the checklist shape required adjustment. All adjustments preserve the plan's intent and the locked decisions (D-07 signal shape, D-08 access control, D-09 reentrancy, D-10 manifest content).

## Verify Block Evidence (all steps passed)

```
=== Task 2 Verify ===
Step 1/5: registerSourceTx well-formed ........... true
Step 2/5: recordSignalTx well-formed ............. true
Step 3/5: mirrorTx well-formed .................. true
Step 4/5: performance(1) signalCount non-zero ... 0x00...01 (signalCount=1)
Step 5/5: followersOf(1) contains follower ...... OK (0xec31...b615 present)

=== Task 3 Verify ===
Step 1/4: required phrases all present .......... OK (5/5 phrases)
Step 2/4: both contract addresses present ....... OK (2/2)
Step 3/4: all three tx hashes present ........... OK (3/3)
Step 4/4: placeholder gate (no <word...> tokens). OK (clean after rephrase)
```

## Authentication Gates

None blocked execution. Task 1 (the option-a vs option-b decision checkpoint) was pre-resolved by the user before this executor was spawned (`<user_setup_status>` block confirmed option-a + both private keys + both wallets funded). The executor skipped the wait-for-user gate entirely and proceeded straight from environment-load to Task 2.

Final remaining gate: **Task 4 (`checkpoint:human-verify`)** — orchestrator presents the Mantle Explorer eyeball-check + DoraHacks portal fine-print confirmation to the user. This executor stops here and returns the structured payload.

## DoraHacks Fine-Print Spot Check

The spawn prompt's `<official_award_criteria>` block was already a verbatim capture of the live DoraHacks page made during this session. DEPLOYMENT.md mirrors that 7-item structure literally. Task 4 checkpoint asks the user to do a final visual confirmation on the live portal; no Phase 5 gap is currently anticipated.

## Known Stubs

None. Deployment manifest is fully populated; testTransaction is no longer null; both contracts respond to their locked surfaces with non-default state (signalCount=1, followersOf=1-element array, following=1-element array). The executor address on the mirror tx is intentionally a documented sentinel placeholder — the substantive executor (`SequaExecutor.sol` with scoped allowances + whitelisted router + per-token caps + slippage + kill switch) lands in Phase 2 and the inline DEPLOYMENT.md paragraph narrates that explicitly.

## Threat Flags

None new beyond the plan's `<threat_model>` register:

- **T-00-T-01 (Spoofing signal payload claims)** — recordSignal tx is on Explorer with the exact ABI-encoded payload AND emitted event topics; anyone can decode and verify the signal `bytes` round-trip to `(tokenIn, tokenOut, amountIn, minAmountOut, fee)`.
- **T-00-T-02 (Repudiation wrong tx hash pasted)** — All three captured tx hashes verified live on Mantle Explorer (`cast receipt` for each, event topic match for each). DEPLOYMENT.md addresses + tx hashes are grep-matched against `deployments/sepolia.json` (Task 3 Verify Step 2/4 + 3/4). The placeholder gate (Step 4/4) prevented a half-filled template from shipping.
- **T-00-T-03 (Information Disclosure)** — All values in DEPLOYMENT.md are public chain data + repo info; both private keys remained env-loaded only, never echoed.
- **T-00-T-04 (DoraHacks criteria drift)** — Mitigated by orchestrator-side eyeball check at Task 4 + the 7-item checklist that was confirmed verbatim during this session.
- **T-00-T-05 (Submission claims AI-callable but path not exercised)** — recordSignal tx exists ON CHAIN with the actual call AND the actual mirror call from an independent EOA; Explorer-verifiable events back the narrative.

## Phase 0 Closure

| Phase 0 success criterion | Status |
|---|---|
| SourceRegistry + FollowRegistry deployed on Mantle Sepolia with verified source on Mantle Explorer | DONE (Plan 04) |
| End-to-end `recordSignal → mirror` test tx executes on Sepolia; tx hash demonstrates AI-callable on-chain function | DONE (this plan) |
| Deployment addresses captured in `.planning/` notes ready to paste into DoraHacks submission | DONE (`.planning/phases/00-lock/DEPLOYMENT.md`) |
| 20 Project Deployment Award Technical Deployment bar cleared | DONE — all 3 of 3 official Technical Deployment items checked |

**Phase 0 complete — ready for Phase 1 planning.** Next action: `/gsd-plan-phase 1` (Source + signals — Claude-driven source agent on locked FusionX V3 pair set).

## Self-Check: PASSED

- FOUND: `.planning/phases/00-lock/DEPLOYMENT.md` (single page, 7-item checklist, all placeholders resolved, placeholder gate passes)
- FOUND: `deployments/sepolia.json` — `testTransaction` populated with all three tx hashes (66-char `0x...`), three Explorer URLs, narrative, executor-placeholder rationale, signal payload metadata, full gas accounting
- FOUND: Commit `6a21d47` (Task 2 — feat: e2e tx sequence)
- FOUND: Commit `5105051` (Task 3 — docs: DEPLOYMENT.md submission packet)
- VERIFIED: `cast call 0x97a724ca... "performance(uint256)" 1 --rpc-url <RPC>` returns `(1, 0x6a26597f)`
- VERIFIED: `cast call 0x8d559307... "followersOf(uint256)" 1 --rpc-url <RPC>` returns array `[0xeC31eFDd7F62b418cA4938D22b32C3930C35B615]`
- VERIFIED: `cast call 0x8d559307... "following(address)" 0xeC31...B615 --rpc-url <RPC>` returns array `[1]`
- VERIFIED: All three event topics (`SourceRegistered`, `SignalRecorded`, `Mirrored`) match `cast keccak <signature>` derivations and appear in their respective tx receipts
- VERIFIED: `.env` NOT in `git status` at any point during execution (gitignored via `.gitignore:4`)
- VERIFIED: DEPLOYMENT.md placeholder gate (`grep -vE '^(#|<!--|.*TBD)' | grep -qE '<[a-zA-Z][^>]*>'`) returns NO matches
- VERIFIED: All 5 required literal phrases present in DEPLOYMENT.md (recordSignal → mirror, Mantle Sepolia, chain ID 5003, AI-callable on-chain function, Mantle Mainnet or Testnet)
