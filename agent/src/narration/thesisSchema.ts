// narration/thesisSchema.ts
// The output is a single short string, so the schema is intentionally tiny — its real job is
// enforcing the 1-2 sentence / length budget and rejecting empty or JSON-breaking output
// (critical failure mode #5) BEFORE it reaches the off-chain thesis file the frontend consumes.
// Reused verbatim by the eval harness (AI-SPEC §5 dimension 5) — do not fork this validator.

import { z } from 'zod';

export const thesisSchema = z.object({
  thesis: z
    .string()
    .trim()
    .min(15, 'thesis too short / empty') // guards the empty-output failure mode
    .max(280, 'thesis exceeds 1-2 sentence budget') // ~tweet-length ceiling for 1-2 sentences (D-08)
    .refine((t) => !/[\{\}`]/.test(t), 'thesis contains JSON/markdown-breaking characters'),
});

export type Thesis = z.infer<typeof thesisSchema>;
