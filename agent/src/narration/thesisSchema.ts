// narration/thesisSchema.ts
// The output is a single short string, so the schema is intentionally tiny — its real job is
// enforcing the 1-2 sentence / length budget and rejecting empty, JSON-breaking, or signal-LEAKING
// output (critical failure mode #5) BEFORE it reaches the off-chain thesis file the frontend
// consumes. This is the AI-SPEC §5/§6 format+containment gate: it must enforce BOTH the
// <=2-sentence budget AND a leakage scan, not merely length + a few stray characters.
// Reused verbatim by the eval harness (AI-SPEC §5 dimension 5) and the live narration gate
// (narrateSignalSafe) — do not fork this validator.

import { z } from 'zod';

/** Count sentences by splitting on terminal punctuation and counting non-empty trimmed segments.
 *  Per AI-SPEC §6 the thesis budget is 1-2 sentences (D-08); 3+ is a format failure. */
function sentenceCount(t: string): number {
  return t
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0).length;
}

/** Leakage scan (AI-SPEC §6 containment): the thesis is a public, human-readable card — it must
 *  NOT leak the raw signal/tuple. Reject a 40-hex address, any swap-tuple field name, embedded
 *  newlines/carriage-returns, or a double-quote (which would also break the JSON the frontend reads). */
const LEAKAGE =
  /0x[0-9a-fA-F]{40}|\b(?:tokenIn|tokenOut|amountIn|minAmountOut|sqrtPriceLimit)\b|[\r\n"]/;

export const thesisSchema = z.object({
  thesis: z
    .string()
    .trim()
    .min(15, 'thesis too short / empty') // guards the empty-output failure mode
    .max(280, 'thesis exceeds 1-2 sentence budget') // ~tweet-length ceiling for 1-2 sentences (D-08)
    .refine((t) => !/[\{\}`]/.test(t), 'thesis contains JSON/markdown-breaking characters')
    .refine((t) => sentenceCount(t) <= 2, 'thesis exceeds the 1-2 sentence budget (3+ sentences)')
    .refine(
      (t) => !LEAKAGE.test(t),
      'thesis leaks raw signal/tuple data (hex address, tuple field, newline, or double-quote)',
    ),
});

export type Thesis = z.infer<typeof thesisSchema>;
