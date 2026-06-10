// narration/fallback.ts
// The deterministic, on-persona placeholder used whenever the live narration fails or trips a
// guardrail. It is FIDELITY-CORRECT BY CONSTRUCTION (AI-SPEC §6): it is generated directly from
// the signal, so it always names the correct pair and a direction-consistent verb — it can never
// contradict the on-chain action (threat T-1-10). No prices/PnL/percentages/guarantees, no advice.
// No LLM, no I/O — a pure function of the Signal, so it is replay-stable and always schema-valid.

import { baseTokenOf, type Signal } from '../signals/types';

/**
 * Build a deterministic 1-2 sentence thesis from the signal alone.
 * BUY  → "stepping in / long" language for the named pair.
 * SELL → "stepping out / flat" language for the named pair.
 * Output is guaranteed to satisfy thesisSchema (15-280 chars, no { } or backtick).
 */
export function fallbackThesis(signal: Signal): string {
  const base = baseTokenOf(signal.pair);
  if (signal.direction === 'BUY') {
    return (
      `The short average crossed above the long on ${signal.pair}, ` +
      `so I'm stepping in long with the trend on ${base}.`
    );
  }
  // SELL — flat-sell the held token
  return (
    `The short average dropped under the long on ${signal.pair}, ` +
    `so I'm stepping out and going flat on ${base}.`
  );
}
