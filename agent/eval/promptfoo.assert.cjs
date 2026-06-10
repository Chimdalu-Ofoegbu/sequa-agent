// eval/promptfoo.assert.cjs
// The must-pass deterministic gate promptfoo runs against the LIVE model output for each fixture.
// Reuses the SAME validators the runtime uses (signalFidelity + bannedPhrases + thesisSchema) so a
// prompt/model edit cannot silently regress fidelity/safety/format (AI-SPEC §5 dimension 1/2/3/5).
//
// CommonJS wrapper using dynamic import() to load the ESM/TS validators through tsx at eval time.
// Returns the promptfoo GradingResult shape { pass, score, reason }.

module.exports = async (output, context) => {
  // lazy dynamic import so this CJS file can pull in the ESM TS validators
  const { signalFidelity } = await import('./signalFidelity.ts');
  const { bannedPhrases } = await import('./bannedPhrases.ts');
  const { thesisSchema } = await import('../src/narration/thesisSchema.ts');

  const text = typeof output === 'string' ? output : String(output ?? '');
  const signal = JSON.parse(context.vars.signalJson);

  // dimension 5 — format/containment
  const fmt = thesisSchema.safeParse({ thesis: text });
  if (!fmt.success) {
    return { pass: false, score: 0, reason: `format: ${fmt.error.issues[0]?.message ?? 'invalid'}` };
  }
  // dimension 1 — signal fidelity (anchor)
  const fid = signalFidelity(text, signal);
  if (!fid.pass) return { pass: false, score: 0, reason: `fidelity: ${fid.reason}` };
  // dimensions 2/3 — banned promotion / advice phrasing
  const banned = bannedPhrases(text);
  if (!banned.pass) return { pass: false, score: 0, reason: banned.reason };

  return { pass: true, score: 1, reason: 'format + fidelity + banned-phrase gates passed' };
};
