// test/strategy.replay.test.ts
// Deterministic replay over canned price series. Mirror fidelity is the whole product
// premise (D-01/D-02): the core MUST return identical signals on repeated runs over the
// same series. Covers crossover BUY/SELL, determinism, D-13/D-14/D-15 skips (ZERO signals
// emitted), D-16 serial order [WMNT, mETH, WETH], and D-05 up-to-3 concurrent positions.
//
// No chain I/O, no API key, no clock — pure-function input → output.

import { describe, it, expect } from 'vitest';
import {
  decideSignals,
  decideSignalsDetailed,
  DEFAULT_STRATEGY_CONFIG,
} from '../src/strategy/maCrossover';
import type { PortfolioState, Pair } from '../src/signals/types';

const AGENT_ID = 'agent-1';

// --- price-series fixtures -------------------------------------------------
// A series long enough to fill the 20-tick long window, ending in an UP-cross
// (short MA finishes above long MA, having been EQUAL on the prior tick) → BUY.
// 24 flat ticks (short MA == long MA == 100) then one sharp jump pulls the 5-MA
// above the 20-MA on the FINAL tick — a clean cross *on the last tick*.
function bullishCrossSeries(): number[] {
  const flat = Array.from({ length: 24 }, () => 100);
  return [...flat, 130]; // last-tick jump → short MA 106 > long MA 101.5 (was 100 == 100)
}

// A series ending in a DOWN-cross (short finishes below long, was equal on prior tick) → SELL.
function bearishCrossSeries(): number[] {
  const flat = Array.from({ length: 24 }, () => 100);
  return [...flat, 70]; // last-tick drop → short MA 94 < long MA 98.5 (was 100 == 100)
}

// A flat / no-cross series → HOLD (short never crosses long).
function flatSeries(): number[] {
  return Array.from({ length: 25 }, () => 100);
}

function emptyPortfolio(usdc = 10_000): PortfolioState {
  return { usdc, holdings: {} };
}

describe('decideSignals — crossover detection (D-02/D-03)', () => {
  it('emits BUY when the short MA crosses ABOVE the long MA', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    const signals = decideSignals(series, emptyPortfolio(), DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.pair).toBe('WMNT/USDC');
    expect(signals[0]!.direction).toBe('BUY');
    expect(signals[0]!.shortMa).toBeGreaterThan(signals[0]!.longMa);
    // BUY is sized at the fixed fraction of available USDC (D-07 = 0.30)
    expect(signals[0]!.sizeUsdc).toBeCloseTo(0.3 * 10_000, 6);
  });

  it('emits SELL when the short MA crosses BELOW the long MA (holding the token)', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bearishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    // must be holding WMNT for the SELL to be valid (else D-15 skip)
    const portfolio: PortfolioState = { usdc: 1_000, holdings: { WMNT: 5_000 } };
    const signals = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.pair).toBe('WMNT/USDC');
    expect(signals[0]!.direction).toBe('SELL');
    expect(signals[0]!.shortMa).toBeLessThan(signals[0]!.longMa);
    // SELL flat-sells the held token → no USDC sizing on a flat-sell (D-07)
    expect(signals[0]!.sizeUsdc).toBeUndefined();
  });

  it('emits NOTHING on a flat / no-cross series (HOLD)', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': flatSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    const signals = decideSignals(series, emptyPortfolio(), DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(0);
  });
});

describe('decideSignals — determinism (mirror fidelity, D-01)', () => {
  it('returns an IDENTICAL signal sequence on two runs over the same canned series', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': bearishCrossSeries(),
      'WETH/USDC': flatSeries(),
    };
    const portfolio: PortfolioState = { usdc: 10_000, holdings: { mETH: 2 } };
    const run1 = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    const run2 = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(run2).toEqual(run1);
    // and a third run to be sure it is not accidentally order-/state-dependent
    const run3 = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(run3).toEqual(run1);
  });
});

describe('decideSignals — skip edge cases emit ZERO signals (D-13/D-14/D-15)', () => {
  it('D-13: BUY but available USDC < minimum → NO signal emitted', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    // usdc below the configured minimum → BUY must be skipped
    const portfolio: PortfolioState = { usdc: 10, holdings: {} };
    const signals = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(0);

    const detailed = decideSignalsDetailed(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    const wmnt = detailed.find((d) => d.pair === 'WMNT/USDC')!;
    expect(wmnt.kind).toBe('skip');
    expect(wmnt.reason).toBe('usdc_below_min');
  });

  it('D-14: BUY but already holding that token → NO signal emitted', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    // already holding WMNT → no doubling up
    const portfolio: PortfolioState = { usdc: 10_000, holdings: { WMNT: 1_000 } };
    const signals = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(0);

    const detailed = decideSignalsDetailed(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    const wmnt = detailed.find((d) => d.pair === 'WMNT/USDC')!;
    expect(wmnt.kind).toBe('skip');
    expect(wmnt.reason).toBe('already_holding');
  });

  it('D-15: SELL but holding nothing for that token → NO signal emitted', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bearishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    // not holding WMNT → cannot sell
    const portfolio: PortfolioState = { usdc: 10_000, holdings: {} };
    const signals = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(0);

    const detailed = decideSignalsDetailed(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    const wmnt = detailed.find((d) => d.pair === 'WMNT/USDC')!;
    expect(wmnt.kind).toBe('skip');
    expect(wmnt.reason).toBe('holding_nothing');
  });
});

describe('decideSignals — D-16 serial order + D-05 concurrent positions', () => {
  it('D-16: when multiple pairs cross on the same tick, signals come out in [WMNT, mETH, WETH] order', () => {
    // all three cross UP on the same tick → three BUY signals in fixed order
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': bullishCrossSeries(),
      'WETH/USDC': bullishCrossSeries(),
    };
    const signals = decideSignals(series, emptyPortfolio(), DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals.map((s) => s.pair)).toEqual(['WMNT/USDC', 'mETH/USDC', 'WETH/USDC']);
  });

  it('D-16: order is fixed even when only mETH and WETH cross (WMNT flat)', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': flatSeries(),
      'mETH/USDC': bullishCrossSeries(),
      'WETH/USDC': bullishCrossSeries(),
    };
    const signals = decideSignals(series, emptyPortfolio(), DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals.map((s) => s.pair)).toEqual(['mETH/USDC', 'WETH/USDC']);
  });

  it('D-05: all 3 pairs cross in one tick → up to 3 concurrent BUY positions can open', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': bullishCrossSeries(),
      'WETH/USDC': bullishCrossSeries(),
    };
    const signals = decideSignals(series, emptyPortfolio(), DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    expect(signals).toHaveLength(3);
    expect(signals.every((s) => s.direction === 'BUY')).toBe(true);
    // every emitted signal carries the agentId so it can key the thesis JSON (D-09)
    expect(signals.every((s) => s.agentId === AGENT_ID)).toBe(true);
  });
});

describe('decideSignals — purity (no I/O, no clock)', () => {
  it('mutating the inputs after the call does not change a prior result (no shared refs leaked)', () => {
    const series: Record<Pair, number[]> = {
      'WMNT/USDC': bullishCrossSeries(),
      'mETH/USDC': flatSeries(),
      'WETH/USDC': flatSeries(),
    };
    const portfolio = emptyPortfolio();
    const signals = decideSignals(series, portfolio, DEFAULT_STRATEGY_CONFIG, AGENT_ID);
    const snapshot = JSON.parse(JSON.stringify(signals));
    // mutate caller-owned inputs
    portfolio.usdc = 0;
    series['WMNT/USDC'].push(999);
    expect(signals).toEqual(snapshot);
  });
});
