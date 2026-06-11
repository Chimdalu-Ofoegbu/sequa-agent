// index.ts — THE 30s POLL LOOP (the whole agent runtime entry point).
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
//  THE ORDERING INVARIANT (AI-SPEC §4 / RESEARCH Pitfall 5 — the single most important rule):
//    per signal →  const signalId = await recordSignalThenSwap(...)   // HOT PATH, AWAITED
//                  if (signalId === null) return                       // reverted → already invalidated
//                  void narrateAndStore(signal, signalId)              // OFF HOT PATH, NEVER awaited
//  A slow/failed Claude call can NEVER delay or block the next tick or the trade. Narration is
//  fire-and-store; a belt-and-suspenders .catch guards against unhandledRejection (it already never
//  throws via narrateSignalSafe).
// ════════════════════════════════════════════════════════════════════════════════════════════════
//
// Each 30s tick (D-04):
//   1. skip entirely if paused (D-11)
//   2. for each pair in fixed [WMNT, mETH, WETH] order (D-16): quote spot → push to that pair's
//      PriceSeriesBuffer
//   3. run decideSignals (pure, Plan 03) over the buffers + live portfolio
//   4. for each emitted signal, respecting per-pair cooldown (D-06) + daily soft cap (D-10):
//        await recordSignalThenSwap (HOT PATH) → void narrateAndStore (off path)
//   5. update health status (lastTickAt every tick; lastSignalAt on each recorded signal)
//
// Startup: assertConfig() (W3 fail-closed) → build ChainContext → ensureApprovals once → start
// /healthz → begin the loop.

import { assertConfig, baseTokenAddress, COOLDOWN_MS, DAILY_SOFT_CAP, POLL_MS, PRICE_BUFFER_CAPACITY, HEALTH_PORT, QUOTE_PROBE_UNITS } from './config';
import { makePublicClient, makeOperatorWalletClient, operatorAccount } from './chain/clients';
import { recordSignalThenSwap, ensureApprovals, type ChainContext } from './chain/recordSignal';
import { quote, PriceSeriesBuffer } from './chain/quote';
import { decideSignals, DEFAULT_STRATEGY_CONFIG } from './strategy/maCrossover';
import { narrateSignalSafe, NARRATION_MODEL } from './narration/narrateSignal';
import { fallbackThesis } from './narration/fallback';
import { signalFidelity } from '../eval/signalFidelity';
import { bannedPhrases } from '../eval/bannedPhrases';
import { writeThesis } from './store/thesisStore';
import { createHealthStatus, startHealthServer, type HealthStatus } from './health';
import { PAIRS, baseTokenOf, type Pair, type Signal, type PortfolioState } from './signals/types';
import { parseUnits, type Address } from 'viem';
import { erc20Abi } from './chain/abis';
import { isEntry } from './isEntry';

/** Per-pair cooldown + daily-cap bookkeeping the loop owns (non-AI runtime state). */
interface LoopState {
  buffers: Record<Pair, PriceSeriesBuffer>;
  lastSignalAtByPair: Record<Pair, number>; // epoch ms of the last recorded signal per pair (D-06)
  signalsToday: number; // count toward the daily soft cap (D-10)
  dayStartMs: number; // start of the current UTC day window for the cap reset
  health: HealthStatus;
}

/** Decimals per base token (for the spot-quote probe amount). USDC is the quote side. */
function baseDecimals(pair: Pair, decimals: { wmnt: number; meth: number; weth: number }): number {
  switch (baseTokenOf(pair)) {
    case 'WMNT':
      return decimals.wmnt;
    case 'mETH':
      return decimals.meth;
    case 'WETH':
      return decimals.weth;
  }
}

/** Has the per-pair cooldown (D-06) elapsed since the last recorded signal on this pair? */
function cooldownElapsed(state: LoopState, pair: Pair, nowMs: number): boolean {
  const last = state.lastSignalAtByPair[pair];
  return nowMs - last >= COOLDOWN_MS;
}

/** Roll the daily soft-cap window if a new UTC day has started; returns whether the cap has room. */
function dailyCapHasRoom(state: LoopState, nowMs: number): boolean {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (nowMs - state.dayStartMs >= ONE_DAY_MS) {
    state.dayStartMs = nowMs;
    state.signalsToday = 0;
  }
  return state.signalsToday < DAILY_SOFT_CAP;
}

/**
 * narrateAndStore — the OFF-HOT-PATH narration branch (AI-SPEC §4). Runs the pre-publish guardrails
 * (signal-fidelity + banned-phrase, AI-SPEC §6) and substitutes the deterministic fidelity-correct
 * fallbackThesis on any trip, then persists the thesis JSON (D-09/D-37). Emits ONE structured stdout
 * log line per narration (AI-SPEC §7). NEVER throws — the trade already settled before this runs.
 */
async function narrateAndStore(signal: Signal, signalId: string, health: HealthStatus): Promise<void> {
  const startedMs = Date.now();
  let fallbackUsed = false;
  let reason: string | undefined;

  // narrateSignalSafe never throws: validate → one retry → fallbackThesis on failure.
  let thesis = await narrateSignalSafe(signal, signalId);

  // Pre-publish guardrails (AI-SPEC §6): block a fidelity mismatch or a promotion/advice phrase by
  // substituting the deterministic fallback (which is fidelity-correct by construction).
  const fidelity = signalFidelity(thesis, signal);
  if (!fidelity.pass) {
    thesis = fallbackThesis(signal);
    fallbackUsed = true;
    reason = `signal_fidelity_mismatch: ${fidelity.reason}`;
  } else {
    const banned = bannedPhrases(thesis);
    if (!banned.pass) {
      thesis = fallbackThesis(signal);
      fallbackUsed = true;
      reason = banned.reason;
    }
  }

  // If narrateSignalSafe itself fell back, the output already equals fallbackThesis(signal) — detect
  // that so the fallbackRate counter is accurate even when the guardrails passed the fallback text.
  if (!fallbackUsed && thesis === fallbackThesis(signal)) {
    fallbackUsed = true;
    reason = reason ?? 'narration_fallback';
  }

  await writeThesis(signal.agentId, signalId, thesis);

  health.narrationsTotal += 1;
  if (fallbackUsed) health.narrationsFallback += 1;

  // One structured log line per narration (AI-SPEC §7 / D-38).
  console.log({
    event: 'narration',
    signalId,
    agentId: signal.agentId,
    pair: signal.pair,
    direction: signal.direction,
    model: NARRATION_MODEL,
    durationMs: Date.now() - startedMs,
    fallbackUsed,
    ...(reason ? { reason } : {}),
  });
}

/**
 * handleSignal — the per-signal controller. HOT PATH first (awaited), narration fire-and-store after.
 * Returns true iff the on-chain record+swap settled (so the caller updates cooldown/cap/lastSignalAt).
 */
async function handleSignal(
  ctx: ChainContext,
  signal: Signal,
  amountIn: bigint,
  minAmountOut: bigint,
  fee: number,
  tokenIn: Address,
  tokenOut: Address,
  health: HealthStatus,
): Promise<boolean> {
  // --- HOT PATH: must complete regardless of Claude. Awaited. ---
  const signalId = await recordSignalThenSwap(ctx, {
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    fee,
  });
  if (signalId === null) return false; // swap reverted → invalidateSignal already emitted (D-30)

  // --- OFF HOT PATH: narration is fire-and-store. NEVER awaited. ---
  // Belt-and-suspenders .catch against unhandledRejection (narrateAndStore already never throws).
  void narrateAndStore(signal, signalId, health).catch((err) => {
    console.warn({ signalId, reason: 'narrate_and_store_unexpected', err: String(err) });
  });

  return true;
}

/** Read the agent's on-chain portfolio (USDC balance + per-base-token holdings) for the strategy. */
async function readPortfolio(
  pub: ChainContext['pub'],
  owner: Address,
  tokens: { usdc: Address; wmnt: Address; meth: Address; weth: Address },
  decimals: { usdc: number; wmnt: number; meth: number; weth: number },
): Promise<PortfolioState> {
  async function bal(token: Address): Promise<bigint> {
    return (await pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })) as bigint;
  }
  const [usdcRaw, wmntRaw, methRaw, wethRaw] = await Promise.all([
    bal(tokens.usdc),
    bal(tokens.wmnt),
    bal(tokens.meth),
    bal(tokens.weth),
  ]);
  const toNum = (raw: bigint, d: number) => Number(raw) / 10 ** d;
  return {
    usdc: toNum(usdcRaw, decimals.usdc),
    holdings: {
      WMNT: toNum(wmntRaw, decimals.wmnt),
      mETH: toNum(methRaw, decimals.meth),
      WETH: toNum(wethRaw, decimals.weth),
    },
  };
}

/**
 * runTick — one poll iteration. Quotes each pair, runs the pure strategy, and routes each emitted
 * signal through handleSignal under the cooldown (D-06) + daily-cap (D-10) gates.
 */
async function runTick(cfg: ReturnType<typeof assertConfig>, ctx: ChainContext, state: LoopState): Promise<void> {
  const nowMs = Date.now();
  state.health.lastTickAt = new Date(nowMs).toISOString();

  // D-11: paused → skip all trading this tick (still bumped lastTickAt above for liveness).
  if (state.health.paused) {
    console.log({ event: 'tick_skipped_paused', at: state.health.lastTickAt });
    return;
  }

  const decimals = cfg.addrs.decimals;

  // (2) quote each pair in fixed order (D-16) and push into its price-series buffer.
  for (const pair of PAIRS) {
    const baseAddr = baseTokenAddress(pair, cfg.tokens);
    const probeIn = parseUnits(String(QUOTE_PROBE_UNITS), baseDecimals(pair, decimals));
    try {
      const amountOut = await quote(ctx.pub, cfg.quoterV2, baseAddr, cfg.tokens.usdc, probeIn, cfg.fee);
      // store the spot price as a number (USDC out per 1 base unit) for the MA windows.
      state.buffers[pair].push(amountOut);
    } catch (err) {
      console.warn({ event: 'quote_failed', pair, err: String(err) });
    }
  }

  // (3) read the live portfolio + run the PURE strategy over the per-pair series.
  const portfolio = await readPortfolio(ctx.pub, ctx.account.address, cfg.tokens, decimals);
  const seriesByPair = {
    'WMNT/USDC': bufToNumberSeries(state.buffers['WMNT/USDC']),
    'mETH/USDC': bufToNumberSeries(state.buffers['mETH/USDC']),
    'WETH/USDC': bufToNumberSeries(state.buffers['WETH/USDC']),
  } as Record<Pair, readonly number[]>;

  const signals = decideSignals(seriesByPair, portfolio, DEFAULT_STRATEGY_CONFIG, cfg.agentId.toString());

  // (4) route each emitted signal (already in D-16 order) through the cooldown + cap gates.
  for (const signal of signals) {
    if (!dailyCapHasRoom(state, nowMs)) {
      console.log({ event: 'signal_skipped_daily_cap', pair: signal.pair, cap: DAILY_SOFT_CAP });
      break; // cap reached → no further signals this tick
    }
    if (!cooldownElapsed(state, signal.pair, nowMs)) {
      console.log({ event: 'signal_skipped_cooldown', pair: signal.pair });
      continue;
    }

    // Derive the on-chain amounts from the signal + the latest quote.
    const { amountIn, minAmountOut, tokenIn, tokenOut } = await deriveSwapAmounts(cfg, ctx, signal);

    const settled = await handleSignal(
      ctx,
      signal,
      amountIn,
      minAmountOut,
      cfg.fee,
      tokenIn,
      tokenOut,
      state.health,
    );

    if (settled) {
      state.lastSignalAtByPair[signal.pair] = nowMs;
      state.signalsToday += 1;
      state.health.lastSignalAt = new Date(nowMs).toISOString();
    }
  }
}

/** Convert a buffer of raw bigint spot reads into the number series the pure strategy consumes. */
function bufToNumberSeries(buf: PriceSeriesBuffer): readonly number[] {
  return buf.series().map((v) => Number(v));
}

/**
 * deriveSwapAmounts — turn a Signal into the on-chain (tokenIn, tokenOut, amountIn, minAmountOut).
 *   BUY  → spend sizeUsdc of USDC for the base token (tokenIn=USDC, tokenOut=base).
 *   SELL → flat-sell the full base-token holding for USDC (tokenIn=base, tokenOut=USDC).
 * minAmountOut is the QuoterV2 spot quote minus a slippage allowance (the T-1-12 bound carried into
 * the swap's amountOutMinimum by recordSignalThenSwap).
 */
async function deriveSwapAmounts(
  cfg: ReturnType<typeof assertConfig>,
  ctx: ChainContext,
  signal: Signal,
): Promise<{ amountIn: bigint; minAmountOut: bigint; tokenIn: Address; tokenOut: Address }> {
  const decimals = cfg.addrs.decimals;
  const baseAddr = baseTokenAddress(signal.pair, cfg.tokens);
  const baseDec = baseDecimals(signal.pair, decimals);
  const SLIPPAGE_BPS = 100n; // 1% slippage allowance (bound, T-1-12)
  const BPS = 10_000n;

  if (signal.direction === 'BUY') {
    const amountIn = parseUnits(String(signal.sizeUsdc ?? 0), decimals.usdc);
    const expectedOut = await quote(ctx.pub, cfg.quoterV2, cfg.tokens.usdc, baseAddr, amountIn, cfg.fee);
    const minAmountOut = (expectedOut * (BPS - SLIPPAGE_BPS)) / BPS;
    return { amountIn, minAmountOut, tokenIn: cfg.tokens.usdc, tokenOut: baseAddr };
  }

  // SELL — flat-sell the full holding of the base token.
  const held = (await ctx.pub.readContract({
    address: baseAddr,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [ctx.account.address],
  })) as bigint;
  const expectedOut = await quote(ctx.pub, cfg.quoterV2, baseAddr, cfg.tokens.usdc, held, cfg.fee);
  const minAmountOut = (expectedOut * (BPS - SLIPPAGE_BPS)) / BPS;
  void baseDec; // base decimals implicit in `held` (already raw on-chain units)
  return { amountIn: held, minAmountOut, tokenIn: baseAddr, tokenOut: cfg.tokens.usdc };
}

/** Boot the runtime: fail-closed config → chain context → approvals → /healthz → poll loop. */
async function main(): Promise<void> {
  // W3 fail-closed guard FIRST — throws before any chain call if agentId/venues/key are unset.
  const cfg = assertConfig();

  const pub = makePublicClient();
  const wallet = makeOperatorWalletClient(cfg.operatorKey);
  const account = operatorAccount(cfg.operatorKey);

  const ctx: ChainContext = {
    pub,
    wallet,
    account,
    sourceRegistry: cfg.sourceRegistry,
    swapRouter: cfg.swapRouter,
    agentId: cfg.agentId,
  };

  // Startup: one-time max approvals on every token the agent trades (D-29), OFF the hot path.
  await ensureApprovals(ctx, [cfg.tokens.usdc, cfg.tokens.wmnt, cfg.tokens.meth, cfg.tokens.weth]);

  const health = createHealthStatus();
  startHealthServer(health, HEALTH_PORT);

  const now = Date.now();
  const state: LoopState = {
    buffers: {
      'WMNT/USDC': new PriceSeriesBuffer(PRICE_BUFFER_CAPACITY),
      'mETH/USDC': new PriceSeriesBuffer(PRICE_BUFFER_CAPACITY),
      'WETH/USDC': new PriceSeriesBuffer(PRICE_BUFFER_CAPACITY),
    },
    lastSignalAtByPair: {
      'WMNT/USDC': 0,
      'mETH/USDC': 0,
      'WETH/USDC': 0,
    },
    signalsToday: 0,
    dayStartMs: now,
    health,
  };

  console.log({ event: 'agent_boot', agentId: cfg.agentId.toString(), pollMs: POLL_MS, model: NARRATION_MODEL });

  // The 30s poll loop. A thrown tick is logged and the loop continues — one bad tick never kills the
  // long-running process (the next tick re-quotes). lastTickAt staleness is the /healthz liveness signal.
  const runForever = async () => {
    for (;;) {
      try {
        await runTick(cfg, ctx, state);
      } catch (err) {
        console.warn({ event: 'tick_failed', err: String(err) });
      }
      await sleep(POLL_MS);
    }
  };
  await runForever();
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// Only run the loop when executed directly (not when imported by a test).
if (isEntry(import.meta.url)) {
  main().catch((err) => {
    console.error({ event: 'agent_fatal', err: String(err) });
    process.exitCode = 1;
  });
}

export { runTick, handleSignal, narrateAndStore, deriveSwapAmounts, readPortfolio, main };
