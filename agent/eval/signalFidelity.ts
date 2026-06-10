// eval/signalFidelity.ts
// Deterministic SIGNAL-FIDELITY assertion (AI-SPEC §5 dimension 1, the anchor; threat T-1-10).
// Given a thesis string + the Signal it should describe, confirm:
//   1. the thesis names the correct pair token(s) (the base symbol, optionally with USDC), AND
//   2. a direction-lexicon match agrees with signal.direction
//      (BUY  ⇄ long / entering / stepping in / in with the trend)
//      (SELL ⇄ out  / exiting  / flat        / stepping out / rolled over)
// Returns { pass, reason }. NO model call — pure string analysis, runs offline in eval:unit and
// as the pre-publish online gate. A thesis that implies the wrong direction or wrong pair FAILS.

import { baseTokenOf, type Signal } from '../src/signals/types';

export interface FidelityResult {
  pass: boolean;
  reason: string;
}

// Direction lexicons — the vocabulary each direction is allowed to read as.
// Phrases are context-anchored to avoid false matches (e.g. the bullish idiom "breaking out"
// must NOT register as a SELL "out"): SELL "out" only counts in an exit context.
const BUY_LEXICON =
  /\b(go(?:ing)? long|longing|(?:i'?m |i am )?long\b|enter(?:ing)?|stepping in|step(?:ping)? in|in with the trend|buy(?:ing)?\b|bought|added|riding the trend|riding the confirmation|pushed? above|punched? above|crossed above)\b/i;
// SELL "out" is anchored to a genuine exit context ("stepping out", "i'm out", "out fast", "out
// before the reversal") so the bullish idiom "breaking out" never registers as a SELL. Bare `out`
// and the loose "out and" are intentionally excluded.
const SELL_LEXICON =
  /\b(exit(?:ing)?|going flat|go flat|(?:i'?m |i am )?flat\b|stepping out|step(?:ping)? out|(?:i'?m |i am )out\b|out fast|out before the|rolled over|sell(?:ing)?\b|sold|trimming|trimmed|cutting|cut\b|slipped under|dropped under|dropped below|crossed below)\b/i;

/**
 * Assert a thesis is faithful to its Signal. Deterministic; the LLM judge is only a secondary
 * backstop for subtle rationale contradictions (AI-SPEC §5). Fail-closed: any mismatch → FAIL.
 */
export function signalFidelity(thesis: string, signal: Signal): FidelityResult {
  const base = baseTokenOf(signal.pair); // e.g. "WMNT"
  const text = thesis;
  const lower = thesis.toLowerCase();

  // (1) the correct pair/base token must appear (canonical symbol match)
  const namesBase = text.includes(base) || lower.includes(base.toLowerCase());
  if (!namesBase) {
    return { pass: false, reason: `thesis does not name the pair token "${base}"` };
  }

  // (2) direction lexicon must agree with signal.direction — and must NOT assert the opposite.
  const saysBuy = BUY_LEXICON.test(text);
  const saysSell = SELL_LEXICON.test(text);

  if (signal.direction === 'BUY') {
    if (saysSell && !saysBuy) {
      return { pass: false, reason: 'BUY signal narrated with SELL/exit language (direction inversion)' };
    }
    if (!saysBuy) {
      return { pass: false, reason: 'BUY signal missing entering/long language' };
    }
    return { pass: true, reason: 'pair + BUY direction consistent' };
  }

  // signal.direction === 'SELL'
  if (saysBuy && !saysSell) {
    return { pass: false, reason: 'SELL signal narrated with BUY/long language (direction inversion)' };
  }
  if (!saysSell) {
    return { pass: false, reason: 'SELL signal missing exiting/flat language' };
  }
  return { pass: true, reason: 'pair + SELL direction consistent' };
}
