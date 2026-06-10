// narration/narrateSignal.ts
// ONE single-shot Claude call per deterministic signal (D-08) + the safe wrapper that makes it
// impossible for narration to block or crash the long-running agent (threat T-1-11).
// This is NOT an agent: no loop, no tools, no history. Input = the current signal only.

import { client } from './client';
import { PERSONA_SYSTEM_PROMPT } from './persona';
import { thesisSchema } from './thesisSchema';
import { fallbackThesis } from './fallback';
import type { Signal } from '../signals/types';

/** Locked narration model + decoding params (AI-SPEC §3 / §4). Exported so the eval harness
 *  asserts against the same constants the runtime uses — single source of truth. */
export const NARRATION_MODEL = 'claude-haiku-4-5';
export const NARRATION_MAX_TOKENS = 120;
export const NARRATION_TEMPERATURE = 0.7;

/**
 * Build the user turn — ONLY the current signal's compact facts, no chat history (stateless).
 * Reused verbatim by the promptfoo eval so the regression runs the exact production prompt.
 */
export function buildUserContent(s: Signal): string {
  return (
    `Signal: ${s.direction} ${s.pair}. ` +
    `Short MA ${s.shortMa.toFixed(4)} crossed long MA ${s.longMa.toFixed(4)} ` +
    `(${s.direction === 'BUY' ? 'above' : 'below'}).` +
    (s.sizeUsdc ? ` Sizing ~${s.sizeUsdc} USDC.` : '')
  );
}

/**
 * The raw entry-point call: one awaited messages.create, returns the trimmed text block.
 * Throws on a non-text content block (pitfall #1) or any SDK/transport error — callers MUST
 * go through narrateSignalSafe so a throw degrades to the fallback instead of bubbling up.
 */
export async function narrateSignal(s: Signal): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5', // cheap+fast for a 1-2 sentence narration (=== NARRATION_MODEL)
    max_tokens: 120, // hard ceiling, 1-2 sentences fit well under (D-08) (=== NARRATION_MAX_TOKENS)
    temperature: 0.7, // a little voice/variety without drifting off-persona (=== NARRATION_TEMPERATURE)
    system: PERSONA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserContent(s) }],
  });

  // response.content is an ARRAY of content blocks; read the first text block (pitfall #1 guard).
  const block = msg.content[0];
  if (block?.type !== 'text') throw new Error('Unexpected non-text content block from Claude');
  return block.text.trim();
}

/**
 * narrateSignalSafe — the off-hot-path safety wrapper. It NEVER throws and NEVER blocks:
 *   validate → ONE retry → fallbackThesis on any failure (AI-SPEC §4 / threat T-1-11).
 * The trade has already settled before this runs; a narration failure must never reach the loop.
 */
export async function narrateSignalSafe(signal: Signal, signalId: string): Promise<string> {
  try {
    const raw = await narrateSignal(signal); // timeout-bounded entry-point call
    const parsed = thesisSchema.safeParse({ thesis: raw });
    if (parsed.success) return parsed.data.thesis;

    // ONE structured-output retry before giving up (off the hot path, ~20 calls/day → cheap).
    const retry = await narrateSignal(signal);
    const reparsed = thesisSchema.safeParse({ thesis: retry });
    if (reparsed.success) return reparsed.data.thesis;

    console.warn({ signalId, reason: 'thesis_validation_failed' }); // structured stdout (D-38)
    return fallbackThesis(signal); // deterministic placeholder, still on-persona + fidelity-correct
  } catch (err) {
    // APIError / timeout / connection: log + degrade. The trade already settled — never rethrow.
    console.warn({ signalId, reason: 'thesis_call_failed', err: String(err) });
    return fallbackThesis(signal);
  }
}
