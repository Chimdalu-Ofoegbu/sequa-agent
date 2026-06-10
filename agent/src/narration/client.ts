// narration/client.ts
// The single module-level Anthropic client singleton (AI-SPEC §3 pitfall #5: never construct one
// per call). Locked transport params: 8s per-call timeout so a slow/rate-limited Claude can never
// delay the swap (failure mode #2), and maxRetries 2 (SDK default — retries happen OFF the hot path).

import Anthropic from '@anthropic-ai/sdk';

export const client = new Anthropic({
  // apiKey defaults to process.env.ANTHROPIC_API_KEY — shown for clarity, can be omitted.
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 2, // SDK auto-retries 429/408/409/>=500/connection errs with backoff
  timeout: 8_000, // 8s hard cap PER CALL — the thesis is off the hot path, never let it hang (D-01/D-09)
});
