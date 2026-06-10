# Phase 1: Source + signals - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 1-source-signals
**Areas discussed:** Strategy + Claude integration, Sepolia liquidity + token plan, Agent identity/swap/ERC-8004 timing, Track-record surface + runtime hosting, Phase 2 hand-off surface, Phase 1 acceptance + reconciliation, Mainnet path, Time budget split, Initial pool prices + ambient noise, Strategy edge cases, Mirror-engine ordering invariant, Open-source/reproducibility

---

## Strategy + Claude integration

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic rule + Claude narrates | Rule decides trades; Claude writes per-signal thesis | ✓ |
| Claude-in-the-loop every tick | Claude is the decider; max narrative, higher fidelity risk | |
| Pure deterministic, no Claude | Algo only; Claude writes static card blurb | |
| Hybrid: Claude proposes, guardrail filters | Claude candidate + deterministic veto | |

**User's choice:** Deterministic rule + Claude narrates.

| Option | Description | Selected |
|--------|-------------|----------|
| Momentum / breakout | Short MA crosses long MA; flip on opposite cross | ✓ |
| Mean reversion against a band | Trade back toward rolling mean | |
| Scheduled rebalancer | Cron + target weights | |

**User's choice:** Momentum / breakout.

| Option | Selected |
|--------|----------|
| Time-based polling (30–60s) | ✓ |
| On-chain event subscription | |
| Manual demo trigger + time fallback | |

**User's choice:** Time-based polling.

| Option | Selected |
|--------|----------|
| Single confident momentum trader | ✓ |
| Strategy-honest engineering voice | |

**User's choice:** Single confident momentum trader.

| Option | Selected |
|--------|----------|
| All 3 pairs | ✓ |
| mETH/USDC only | |
| WMNT/USDC + mETH/USDC | |

**User's choice:** All 3 pairs.

| Option | Selected |
|--------|----------|
| Short=5, Long=20 @ 30s poll | ✓ |
| Short=10, Long=40 @ 60s poll | |

**User's choice:** Short=5, Long=20 @ 30s poll.

| Option | Selected |
|--------|----------|
| Short cooldown ~3–5 min | ✓ |
| Hold-until-opposite-cross only | |
| No cooldown | |

**User's choice:** Short cooldown ~3–5 min.

| Option | Selected |
|--------|----------|
| Off-chain JSON keyed by (agentId, signalId) | ✓ |
| Hash thesis on-chain (commit-only) | |
| IPFS CID in an event | |

**User's choice:** Off-chain JSON keyed by (agentId, signalId).

| Option | Selected |
|--------|----------|
| Fixed fraction of available USDC per signal | ✓ |
| Equal-notional per pair | |
| Volatility-scaled | |

**User's choice:** Fixed fraction of available USDC (25–33% BUY; SELL flat-sells).

| Option | Selected |
|--------|----------|
| Mock USDC mint + agent-side kill switch | ✓ |
| Conservative 1,000 mUSDC, no separate kill | |

**User's choice:** Mock USDC (~10,000 mUSDC) + agent-side kill switch.

| Option | Selected |
|--------|----------|
| Deterministic replay harness against canned series | ✓ |
| Forge + live Sepolia smoke only | |

**User's choice:** Deterministic replay harness.

| Option | Selected |
|--------|----------|
| Planner drafts name in Claude's voice | ✓ |
| User has a name in mind | |
| Defer to Phase 4 | |

**User's choice:** Planner drafts in Claude's voice.

**Notes:** The deterministic-core/Claude-narrator split was the anchoring decision — it satisfies CON-ai-interaction's "agents as characters" while keeping the mirror hot path (Phase 2) reproducible per the PRD §10 mirror-fidelity risk.

---

## Sepolia liquidity + token plan

| Option | Selected |
|--------|----------|
| Deploy 4 mock ERC20s ourselves | ✓ |
| FusionX testnet tokens + mock the rest | |
| FusionX test USDC + mock volatile side | |

**User's choice:** Deploy 4 mock ERC20s.

| Option | Selected |
|--------|----------|
| All 3 pools, ~5k USDC-equiv each | ✓ |
| All 3 pools, ~25k each | |
| 1 pool only (mETH/USDC) | |

**User's choice:** All 3 pools, modest ~5k each.

| Option | Selected |
|--------|----------|
| 0.30% (3000) uniform | ✓ |
| 0.05% stable-ish + 0.30% rest | |
| 1.00% uniform | |

**User's choice:** 0.30% uniform (matches Phase 0 test signal).

| Option | Selected |
|--------|----------|
| Full-range LP | ✓ |
| Wide concentrated range | |

**User's choice:** Full-range LP.

| Option | Selected |
|--------|----------|
| Deployer mints; public mint() open | ✓ |
| Deployer-only mint | |
| Owner-only + drip faucet | |

**User's choice:** Deployer + public mint().

| Option | Selected |
|--------|----------|
| Mirror mainnet decimals (6/18) | ✓ |
| All 18 | |

**User's choice:** Mirror mainnet decimals.

| Option | Selected |
|--------|----------|
| Foundry script + SequaConstants.sol pins | ✓ |
| Foundry script + addresses.json only | |
| Hand-deploy via Cast | |

**User's choice:** Foundry script + SequaConstants.sol pins.

| Option | Selected |
|--------|----------|
| Idempotent script + admin top-up | ✓ |
| Manual Cast reseed | |

**User's choice:** Idempotent script + admin top-up.

| Option | Selected |
|--------|----------|
| Verify all 4 mocks on Explorer | ✓ |
| Leave unverified | |

**User's choice:** Verify all 4 mocks.

**Notes:** Mainnet-mirroring decimals chosen specifically to avoid mirror-engine adapter code when crossing to mainnet later.

---

## Agent identity, swap pattern + ERC-8004 timing

| Option | Selected |
|--------|----------|
| recordSignal then swap (same params) | ✓ |
| Swap first, then recordSignal | |
| Signals only, no swaps | |

**User's choice:** recordSignal-then-swap.

| Option | Selected |
|--------|----------|
| Single agent-operator EOA | ✓ |
| Split owner/operator keys | |

**User's choice:** Single operator EOA.

| Option | Selected |
|--------|----------|
| Pull ERC-8004 mint up to Phase 1 | ✓ |
| Defer to Phase 3 | |
| Hybrid (mint now, getSummary later) | |

**User's choice:** Pull up to Phase 1.

| Option | Selected |
|--------|----------|
| Static GitHub-Pages JSON agentURI | ✓ |
| IPFS CID | |
| Inline data: URI | |

**User's choice:** Static GitHub-Pages JSON.

| Option | Selected |
|--------|----------|
| One-time max approve at startup | ✓ |
| Approve-per-swap exact-amount | |
| Permit2 | |

**User's choice:** One-time max approve.

| Option | Selected |
|--------|----------|
| On-chain invalidateSignal event | ✓ |
| Off-chain divergence log only | |
| Pre-quote slippage + skip | |

**User's choice:** On-chain invalidateSignal event.

| Option | Selected |
|--------|----------|
| Redeploy SourceRegistry + update DEPLOYMENT.md | ✓ |
| Sidecar SignalReconciler.sol | |
| Off-chain only (no redeploy) | |

**User's choice:** Redeploy SourceRegistry + update DEPLOYMENT.md.

**Notes:** Pulling the ERC-8004 mint forward keeps the "on-chain identity from signal #1" verifiability story intact. The redeploy is justified by Phase 0's explicit "skeleton, NOT production-final" framing.

---

## Track-record surface + agent runtime hosting

| Option | Selected |
|--------|----------|
| Keep (signalCount, lastSignalAt); UI computes rest | ✓ |
| Extend with realized PnL aggregate | |
| Mid: add invalidatedCount + lastSignalAt | |

**User's choice:** Keep minimal; UI computes off-chain.

| Option | Selected |
|--------|----------|
| Lightweight VPS / Railway / Fly | ✓ |
| GitHub Actions cron | |
| Local script during demo | |
| Vercel cron | |

**User's choice:** Lightweight VPS / Railway / Fly.

| Option | Selected |
|--------|----------|
| Boot when Phase 1 smoke passes | ✓ |
| Boot on ship day | |

**User's choice:** Boot when Phase 1 smoke passes (2–5 day track record by demo).

| Option | Selected |
|--------|----------|
| Public GitHub repo JSON via PAT | ✓ |
| Vercel KV / Upstash | |
| Phase 4 Vercel app webhook | |

**User's choice:** Public GitHub repo JSON via PAT.

| Option | Selected |
|--------|----------|
| Structured logs + /healthz + uptime pinger | ✓ |
| Stdout logs only | |
| Logs + Discord webhook per signal | |

**User's choice:** Structured logs + /healthz + uptime pinger.

| Option | Selected |
|--------|----------|
| Documented local-run fallback | ✓ |
| Hot standby second host | |
| Accept the risk | |

**User's choice:** Documented local-run fallback.
**Notes:** ⚠️ The user's answer text included a pasted "implementation note" describing an arb bot watching mCLA/mGPT/mGEM pools, a "key #4 arb-only" pattern, a "trade-loop orchestrator EOA", and "Phase 6" — none of which exist in Sequa. Flagged to the user as an apparent cross-project paste; user confirmed "Ignore the pasted note — just use Option 1." Only the local-run fallback decision was recorded.

| Option | Selected |
|--------|----------|
| Soft cap ~20 signals/day | ✓ |
| No cap (cooldown only) | |
| Hard cap ~5/day | |

**User's choice:** Soft cap ~20 signals/day.

---

## Phase 2 hand-off surface

| Option | Selected |
|--------|----------|
| signalAt() view + typed decoded event | ✓ |
| Minimal (signalCount, lastSignalAt) + opaque bytes | |
| signalAt() view only | |

**User's choice:** signalAt() view + typed decoded event.

---

## Phase 1 acceptance + reconciliation tooling

| Option | Selected |
|--------|----------|
| Phase 1 Node CLI + used as acceptance proof | ✓ |
| Phase 4 owns it entirely | |
| Phase 1 reconciler + Phase 4 API reuse | |

**User's choice:** Phase 1 ships the reconciler CLI; 100%-match is the acceptance gate; Phase 4 reuses it.

---

## Mainnet path during Phase 1

| Option | Selected |
|--------|----------|
| Sepolia-only; mainnet deferred | ✓ |
| Contracts to mainnet, agent on Sepolia | |
| Full mainnet with real assets | |

**User's choice:** Sepolia-only; mainnet deferred to Phase 5.

---

## Time budget split for Phase 1

| Option | Selected |
|--------|----------|
| Let the planner decide | ✓ |
| Soft target half-day per workstream | |
| Hard schedule with Phase 2 hand-off | |

**User's choice:** Let the planner decide (workstreams captured, sequencing deferred to PLAN.md).

---

## Initial pool prices + ambient market noise

| Option | Selected |
|--------|----------|
| Ambient noise bot nudges prices | ✓ |
| Manual price nudge by hand | |
| No noise (agent moves prices alone) | |

**User's choice:** Ambient noise bot (separate EOA).

| Option | Selected |
|--------|----------|
| Mainnet-like reference prices | ✓ |
| Convenient round numbers | |

**User's choice:** Mainnet-like reference prices.

---

## Strategy edge cases

| Option | Selected |
|--------|----------|
| Pin canonical answers in CONTEXT | ✓ |
| Let the planner decide each case | |

**User's choice:** Pin canonical answers (insufficient-USDC skip, already-holding skip, sell-with-nothing skip, multi-cross serial in fixed pair order).

---

## Mirror-engine ordering invariant

| Option | Selected |
|--------|----------|
| Best-effort: same-block ideal, ~30s acceptable | ✓ |
| Atomic bundle via helper contract | |
| Defer to Phase 2 planning | |

**User's choice:** Best-effort (~30s), reconciler shows source vs follower fills side-by-side.

---

## Open-source + reproducibility

| Option | Selected |
|--------|----------|
| Public repo: rule + prompts + reconciler + RUN.md | ✓ |
| Public but prompts redacted | |
| Public but EOA/agentId vague | |

**User's choice:** Full public repo + RUN.md; operator key gitignored.

---

## Claude's Discretion

- Time budget / wave sequencing for Phase 1 (workstreams captured; planner sequences in PLAN.md).
- VPS provider choice, exact poll interval (30–60s), mock-token contract style, replay-harness layout, thesis-file rotation scheme, ambient-noise randomization params, TS runtime repo layout.
- Exact callsign/persona copy (within the momentum-trader constraint).
- SequaConstants.sol codegen vs addresses.json mechanism for the TS runtime.

## Deferred Ideas

- SequaExecutor.sol + scoped-allowance mirror execution + follower-side mirror engine → Phase 2.
- ITradeExecutor unused-import lint resolution (pending todo) → Phase 2.
- Live ERC-8004 reputation accrual (giveFeedback / getSummary / clientAddresses[] allowlist) → Phase 3.
- Agent card / leaderboard / "Verify" button UI → Phase 4 (reuses Phase 1 reconciler).
- Mainnet deployment + real-asset trading → Phase 5 ship.
- Multiple source agents → out of scope (scope-cut #1).
