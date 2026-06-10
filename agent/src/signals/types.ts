// signals/types.ts
// The shared signal shape across the strategy core, the narration module, and (Plan 05)
// the on-chain recordSignal/swap path. Greenfield TS — this is the single source of truth
// for the Signal tuple the whole agent agrees on (AI-SPEC §3 lines 182-189, CONTEXT D-07).

/** A trade direction. The deterministic MA-crossover rule emits BUY or SELL only;
 *  HOLD/skip outcomes are represented as the *absence* of a Signal, not a Signal. */
export type Direction = 'BUY' | 'SELL';

/** The three locked USDC-quoted pairs (DEC-002). Order is the canonical D-16 serial order. */
export const PAIRS = ['WMNT/USDC', 'mETH/USDC', 'WETH/USDC'] as const;
export type Pair = (typeof PAIRS)[number];

/** The base token symbol of each pair (everything is quoted in USDC). */
export type BaseToken = 'WMNT' | 'mETH' | 'WETH';

/** Map a pair to its base token symbol (the asset bought/sold against USDC). */
export function baseTokenOf(pair: Pair): BaseToken {
  return pair.split('/')[0] as BaseToken;
}

/**
 * Signal — the object emitted by the deterministic strategy core for every trade.
 * Mirrors AI-SPEC §3. The narration reads it; Plan 05 ABI-encodes the D-07 5-field
 * tuple (tokenIn,tokenOut,amountIn,minAmountOut,fee) from it for recordSignal → swap.
 */
export interface Signal {
  agentId: string; // ERC-8004 agentId (D-27) — keys the off-chain thesis JSON (D-09)
  pair: Pair; // e.g. "WMNT/USDC"
  direction: Direction; // BUY (cross above) | SELL (cross below)
  shortMa: number; // 5-tick MA (D-03)
  longMa: number; // 20-tick MA (D-03)
  sizeUsdc?: number; // fixed-fraction sizing on BUY (D-07); omitted on flat-sell
}

/**
 * PortfolioState — the (non-AI) state the strategy core reads to apply the D-13/D-14/D-15
 * skip rules and size positions. `holdings` is keyed by base token symbol → amount of the
 * base token currently held (0 / absent means flat on that token).
 */
export interface PortfolioState {
  usdc: number; // available USDC balance
  holdings: Record<string, number>; // baseToken symbol → amount held (base-token units)
}

/**
 * StrategyConfig — the tunable, deterministic knobs. Defaulted in maCrossover.ts; passing
 * them explicitly keeps the core pure and replay-reproducible (no env reads, no magic numbers).
 */
export interface StrategyConfig {
  shortWindow: number; // MA short window in ticks (D-03 = 5)
  longWindow: number; // MA long window in ticks (D-03 = 20)
  buyFraction: number; // fixed fraction of available USDC committed per BUY (D-07 = 0.30)
  minUsdc: number; // BUY skipped if available USDC < this (D-13)
}

/**
 * Decision — the per-pair outcome of evaluating one tick. The core decides one of these
 * for every pair every tick; only `emit` decisions become Signals. `skip`/`hold` carry a
 * machine-readable reason so the runtime (Plan 05) can log D-13/D-14/D-15 misses (D-38).
 */
export type DecisionKind = 'emit' | 'skip' | 'hold';

export type SkipReason =
  | 'usdc_below_min' // D-13: BUY but available USDC < minimum
  | 'already_holding' // D-14: BUY but already holding that token
  | 'holding_nothing'; // D-15: SELL but holding nothing for that token

export interface Decision {
  pair: Pair;
  kind: DecisionKind;
  /** present iff kind === 'emit' — the Signal that will be recorded + narrated */
  signal?: Signal;
  /** present iff kind === 'skip' — why no signal was emitted (D-13/D-14/D-15) */
  reason?: SkipReason;
}
