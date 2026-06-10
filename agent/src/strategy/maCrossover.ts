// strategy/maCrossover.ts
// PURE deterministic MA-crossover trade brain (D-01/D-02/D-03). Given a price series per
// pair + the current portfolio + config, it returns the Signals to record THIS tick — the
// SAME output every run over the same inputs. This determinism is the whole product premise
// (mirror fidelity): nothing here may read the network, the filesystem, or the clock.
//
// The ONLY import is the shared signal types. No Anthropic, no fetch, no fs, no Date.now.

import {
  PAIRS,
  baseTokenOf,
  type Pair,
  type Signal,
  type PortfolioState,
  type StrategyConfig,
  type Decision,
} from '../signals/types';

/** Locked defaults: 5/20 MA windows (D-03), 0.30 fixed-fraction BUY sizing (D-07),
 *  and a minimum USDC floor for the D-13 skip. Pass a custom config to override in tests. */
export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  shortWindow: 5,
  longWindow: 20,
  buyFraction: 0.3,
  minUsdc: 100,
};

/** Simple moving average of the last `window` ticks of `series`.
 *  Returns null if the series is too short to fill the window (no decision possible yet). */
function movingAverage(series: readonly number[], window: number): number | null {
  if (window <= 0) return null;
  if (series.length < window) return null;
  let sum = 0;
  for (let i = series.length - window; i < series.length; i++) {
    sum += series[i]!;
  }
  return sum / window;
}

type CrossDirection = 'BUY' | 'SELL' | null;

/**
 * Detect a crossover on the FINAL tick of the series:
 *   - the short MA at the last tick is compared to the long MA at the last tick, AND
 *   - to their relationship one tick earlier.
 * BUY  = short was <= long on the prior tick and is strictly above on the last tick (cross up).
 * SELL = short was >= long on the prior tick and is strictly below on the last tick (cross down).
 * Otherwise null (no fresh cross → HOLD). Pure function of the series.
 */
function detectCross(series: readonly number[], cfg: StrategyConfig): {
  direction: CrossDirection;
  shortMa: number | null;
  longMa: number | null;
} {
  // current tick MAs
  const shortNow = movingAverage(series, cfg.shortWindow);
  const longNow = movingAverage(series, cfg.longWindow);
  if (shortNow === null || longNow === null) {
    return { direction: null, shortMa: shortNow, longMa: longNow };
  }
  // prior tick MAs (drop the last element)
  const prior = series.slice(0, -1);
  const shortPrev = movingAverage(prior, cfg.shortWindow);
  const longPrev = movingAverage(prior, cfg.longWindow);
  if (shortPrev === null || longPrev === null) {
    // not enough history to know the prior relationship → cannot confirm a *cross*
    return { direction: null, shortMa: shortNow, longMa: longNow };
  }

  const wasBelowOrEqual = shortPrev <= longPrev;
  const wasAboveOrEqual = shortPrev >= longPrev;
  const isAbove = shortNow > longNow;
  const isBelow = shortNow < longNow;

  let direction: CrossDirection = null;
  if (wasBelowOrEqual && isAbove) direction = 'BUY'; // cross up (D-02)
  else if (wasAboveOrEqual && isBelow) direction = 'SELL'; // cross down (D-02)

  return { direction, shortMa: shortNow, longMa: longNow };
}

/**
 * Evaluate ONE pair this tick and return a Decision. Applies the D-13/D-14/D-15 skip rules.
 * Does not mutate the portfolio (pure); the caller (Plan 05 runtime) applies fills.
 */
function decidePair(
  pair: Pair,
  series: readonly number[],
  portfolio: PortfolioState,
  cfg: StrategyConfig,
  agentId: string,
): Decision {
  const { direction, shortMa, longMa } = detectCross(series, cfg);

  // no fresh cross, or not enough history yet → HOLD (no signal, no skip-reason)
  if (direction === null || shortMa === null || longMa === null) {
    return { pair, kind: 'hold' };
  }

  const base = baseTokenOf(pair);
  const held = portfolio.holdings[base] ?? 0;

  if (direction === 'BUY') {
    // D-14: already holding that token → skip, no doubling up
    if (held > 0) return { pair, kind: 'skip', reason: 'already_holding' };
    // D-13: available USDC below the minimum → skip
    if (portfolio.usdc < cfg.minUsdc) return { pair, kind: 'skip', reason: 'usdc_below_min' };

    const sizeUsdc = round6(cfg.buyFraction * portfolio.usdc); // fixed-fraction BUY (D-07)
    const signal: Signal = {
      agentId,
      pair,
      direction: 'BUY',
      shortMa,
      longMa,
      sizeUsdc,
    };
    return { pair, kind: 'emit', signal };
  }

  // direction === 'SELL'
  // D-15: holding nothing for that token → cannot flat-sell → skip
  if (held <= 0) return { pair, kind: 'skip', reason: 'holding_nothing' };

  // flat-sell the full holding back to USDC (D-07) → no USDC sizing on a flat-sell
  const signal: Signal = {
    agentId,
    pair,
    direction: 'SELL',
    shortMa,
    longMa,
  };
  return { pair, kind: 'emit', signal };
}

/** Round to 6 decimals deterministically (avoids float dust drifting replay equality). */
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Evaluate ALL 3 locked pairs independently this tick and return a full Decision[] in the
 * canonical D-16 serial order [WMNT, mETH, WETH]. Useful for asserting skip reasons (D-13..D-15)
 * and for the runtime's structured logs (D-38). Pure — no I/O, no mutation of inputs.
 */
export function decideSignalsDetailed(
  priceSeriesByPair: Record<Pair, readonly number[]>,
  portfolio: PortfolioState,
  cfg: StrategyConfig = DEFAULT_STRATEGY_CONFIG,
  agentId: string,
): Decision[] {
  // PAIRS is the fixed [WMNT, mETH, WETH] order → D-16 serial ordering by construction.
  return PAIRS.map((pair) =>
    decidePair(pair, priceSeriesByPair[pair] ?? [], portfolio, cfg, agentId),
  );
}

/**
 * The strategy core entry point: evaluate all 3 pairs and return ONLY the Signals to record
 * this tick, in fixed [WMNT, mETH, WETH] order (D-16). Skips (D-13/D-14/D-15) and holds emit
 * nothing. Up to 3 concurrent BUY positions can open in a single tick (D-05).
 *
 * PURE: identical inputs → identical Signal[] on every run. No network, no fs, no clock.
 */
export function decideSignals(
  priceSeriesByPair: Record<Pair, readonly number[]>,
  portfolio: PortfolioState,
  cfg: StrategyConfig = DEFAULT_STRATEGY_CONFIG,
  agentId: string,
): Signal[] {
  const signals: Signal[] = [];
  for (const decision of decideSignalsDetailed(priceSeriesByPair, portfolio, cfg, agentId)) {
    if (decision.kind === 'emit' && decision.signal) {
      signals.push(decision.signal);
    }
  }
  return signals;
}
