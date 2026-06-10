---
phase: 1
slug: source-signals
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `01-RESEARCH.md` § Validation Architecture. Thesis-narration eval detail is owned by `01-AI-SPEC.md` §5 (referenced, not duplicated).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Foundry `forge test` (Solidity contracts/mocks/seed) + Vitest (TS replay + unit) + promptfoo (thesis eval, AI-SPEC §5) |
| **Config file** | `foundry.toml` (exists); `agent/package.json` + `agent/eval/promptfooconfig.yaml` (Wave 0 installs) |
| **Quick run command** | `forge test` · `cd agent && npx vitest run test/` |
| **Full suite command** | `forge test && cd agent && npm run eval:ci && npx tsx scripts/reconcile.ts --assert` |
| **Estimated runtime** | `forge test` <30s; Vitest replay <10s; full suite includes a live-testnet `reconcile.ts` pass (~1–3 min, network-bound) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched layer — `forge test` (Solidity) and/or `npx vitest run` (changed TS). Target <30s.
- **After every plan wave:** Run full `forge test` + `agent` unit/eval + a dry-run `reconcile.ts` against the testnet over that wave's signals.
- **Before `/gsd-verify-work`:** `reconcile.ts --assert` reports `orphan == 0` over the full live signal history AND `forge test` green AND thesis `eval:ci` green.
- **Max feedback latency:** ~30s for unit/replay; reconciliation is an integration gate (network-bound, not on the per-commit hot path).

---

## Per-Task Verification Map

> Task IDs reconciled to the concrete IDs assigned across Plans 01-01..01-06 (`{plan}-T{n}`). Each impl (auto/tdd) task carries its real `<automated>` verify command and its `T-1-NN` threat ref where one applies. Checkpoint tasks are marked manual / N-A. Wave is the PLAN frontmatter `wave:` integer.

| Task ID | Plan | Wave | Type | Requirement | Threat Ref | Secure Behavior | Automated Command | Status |
|---------|------|------|------|-------------|------------|-----------------|-------------------|--------|
| 01-01-T1 | 01-01 | 1 | auto | REQ-01 | T-1-02 | MockERC20 6/18 decimals + public mint (testnet-only); canonical UniV3 periphery vendored @0.7.6 | `forge build && forge test --match-contract MockERC20Test -vvv` | ⬜ pending |
| 01-01-T2 | 01-01 | 1 | auto | REQ-01 | T-1-06, T-1-09 | venue/mocks/pools codesize>0 fail-closed; slot0 round-trip ≈ D-20; deploy-time write-back (no stale FusionX addr) | `forge build && bash -c '…for a in $(jq … addresses.json); do cast codesize "$a" …; [ "$cs" -gt 0 ] \|\| exit 1; done'` | ⬜ pending |
| 01-01-T3 | 01-01 | 1 | checkpoint:human-verify | REQ-01 | T-1-09 | verified-source pages render; pools quote mainnet-like prices | manual (human-verify) | ⬜ pending |
| 01-02-T1 | 01-02 | 1 | tdd | REQ-01 | T-1-03, T-1-04, T-1-05 | `NotSourceOwner` gate + `nonReentrant` on new fns; guarded decode never reverts recordSignal | `forge build && forge test --match-contract SourceRegistryTest -vvv` | ⬜ pending |
| 01-02-T2 | 01-02 | 1 | tdd | REQ-01 | T-1-03, T-1-05 | signalAt round-trip; opaque payload still records; ≥6 new tests; FollowRegistry not redeployed | `forge build && forge test --match-contract SourceRegistryTest -vvv` | ⬜ pending |
| 01-03-T1 | 01-03 | 1 | tdd | REQ-06 | — | pure MA-crossover core; D-13/14/15 emit zero signals; D-16 fixed order; deterministic replay | `cd agent && npm install && npx vitest run test/strategy.replay.test.ts` | ⬜ pending |
| 01-03-T2 | 01-03 | 1 | tdd | REQ-06 | T-1-07, T-1-08, T-1-10, T-1-11 | thesisSchema enforcement; narrateSignalSafe never throws; locked model/timeout params | `cd agent && npx vitest run test/narration.test.ts` | ⬜ pending |
| 01-03-T3 | 01-03 | 1 | auto | REQ-06 (AI-SPEC §5) | T-1-07, T-1-10 | banned-phrase + signal-fidelity validators flag baits; eval:unit green offline | `cd agent && npx vitest run eval/` | ⬜ pending |
| 01-04-T1 | 01-04 | 2 | tdd | REQ-01, REQ-06 | — | shared 5-field codec written once (D-40); QuoterV2 via simulateContract only (no readContract) | `cd agent && npx vitest run test/reconcileShared.test.ts` | ⬜ pending |
| 01-04-T2 | 01-04 | 2 | auto | REQ-06 | T-1-01, T-1-12, T-1-06 | recordSignal→swap 8-field struct; `amountOutMinimum` slippage bound; invalidate-on-revert; runtime addr read (W2) | `cd agent && npx tsc --noEmit` | ⬜ pending |
| 01-04-T3 | 01-04 | 2 | checkpoint:human-action | REQ-06 | T-1-13 | agentId captured from mint event (not 1); ownerOf==operator (gated on Plan-06 AGENT_URI) | manual (human-action) | ⬜ pending |
| 01-05-T1 | 01-05 | 3 | auto | REQ-01, REQ-06 | T-1-11, T-1-15 | hot path awaited, narration fire-and-store (never awaited); cooldown/cap/pause; fail-closed config guard (W3) | `cd agent && npx tsc --noEmit` | ⬜ pending |
| 01-05-T2 | 01-05 | 3 | auto | REQ-06 | — | reconciler imports shared codec (D-40); `--assert` exits non-zero on orphan; invalidated≠orphan (D-30) | `cd agent && npx vitest run test/reconcile.test.ts` | ⬜ pending |
| 01-05-T3 | 01-05 | 3 | auto | REQ-06 | — | ambient noise bot on separate EOA; never records signals (not in track record) | `cd agent && npx tsc --noEmit` | ⬜ pending |
| 01-06-T1 | 01-06 | 4 | auto | REQ-01, REQ-06 | T-1-06 | extended SourceRegistry redeployed+verified; signalAt callable; manifest/DEPLOYMENT.md updated; AGENT_URI published | `bash -c '…A=$(jq … sourceRegistry.address …); cast codesize "$A" …; cast call "$A" "performance(uint256)(uint256,uint64)" 1 …'` | ⬜ pending |
| 01-06-T2 | 01-06 | 4 | checkpoint:human-action | REQ-06 | T-1-13 | live ERC-8004 mint; agentId captured (not 1); ownerOf==operator; registerSource lands | manual (human-action) | ⬜ pending |
| 01-06-T3 | 01-06 | 4 | checkpoint:human-verify | REQ-01, REQ-06 | T-1-01, T-1-16 | hosted always-on; first live recordSignal→swap; /healthz + UptimeRobot; RUN.md local-run failover | manual (human-verify) | ⬜ pending |
| **01-06-T4** | 01-06 | 4 | checkpoint:human-verify | REQ-06 | — | **D-40 ACCEPTANCE GATE — `reconcile.ts --assert` reports `{matched:N, invalidated:M, orphan:0}` and exits 0** | `cd agent && npx tsx scripts/reconcile.ts --assert` (manual gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Venue self-deploy + address-liveness check (D-43)** — `cast codesize` > 0 for the self-deployed factory/NPM/SwapRouter/QuoterV2 before any address is pinned; fail-closed on zero code (Pitfall 1 / DEC-001 amendment). Gates the LP-seed and swap tasks.
- [ ] `test/MockERC20.t.sol` — decimals (6/18) + public mint (REQ-01, D-17/D-18)
- [ ] `script/SeedLiquidity.s.sol` + a fork/sim test — REQ-01 LP seed (now run against the self-deployed venue, D-43)
- [ ] `agent/test/strategy.replay.test.ts` + canned price-series fixtures — REQ-06 deterministic core (D-02/D-03/D-13..D-16)
- [ ] `agent/scripts/reconcile.ts` with `--assert` mode — REQ-06 / D-40 acceptance gate (exit non-zero on any orphan)
- [ ] `agent/eval/signals/*.json` + `promptfooconfig.yaml` + `signalFidelity.ts`/`bannedPhrases.ts` — AI-SPEC §5 thesis eval
- [ ] `agent/` Vitest config + `agent/package.json` eval scripts
- [ ] Framework install: `cd agent && npm i -D vitest promptfoo tsx typescript`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Contract verified-source page renders on Mantlescan | REQ-01 (D-23/D-31) | Explorer click-through is visual; `forge verify-contract` reports success but the verified-source UI is checked by eye | Run `VerifyPhase1.sh`; open each contract on `sepolia.mantlescan.xyz`, confirm "Contract Source Code Verified" |
| Multi-day continuous track record accrued | D-36 | Time-based — agent must run for 2–5 days before the demo recording | Boot agent post-smoke; confirm `signalCount` grows across days on Explorer |
| `/healthz` liveness + UptimeRobot alerting | D-38 | UptimeRobot monitor config lives in its UI, not the repo | `curl /healthz` returns fresh `lastTickAt`; confirm UptimeRobot monitor green + Discord/Slack alert fires on a forced outage |
| Local-run failover boots <3 min against same identity/registry | D-39 | End-to-end operational drill on a second machine | Follow `RUN.md`: pull repo + `.env` + `npm run agent`; confirm it resumes against the same `agentId`/`SourceRegistry` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every impl (auto/tdd) task carries an automated verify; checkpoints are manual/N-A
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (longest checkpoint run is 01-06-T2/T3 → broken by 01-06-T4 automated gate)
- [x] Wave 0 test files are task outputs (MockERC20.t.sol, SeedLiquidity, strategy.replay, reconcile, eval) — created by 01-01-T1/T2, 01-03-T1/T2/T3, 01-05-T2
- [x] No watch-mode flags — all verify commands use `vitest run` / `forge test` / `tsc --noEmit` (no `--watch`)
- [x] Feedback latency < 30s (unit/replay tier); reconciliation is a network-bound integration gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-10
