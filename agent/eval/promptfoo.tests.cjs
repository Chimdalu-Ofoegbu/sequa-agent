// eval/promptfoo.tests.cjs
// Generates one promptfoo test case per fixture in eval/signals/*.json. Each case feeds the
// fixture's Signal as prompt vars and attaches the must-pass code assertions (signalFidelity +
// bannedPhrases + thesisSchema, via promptfoo.assert.cjs) plus the report-only llm-rubric checks.
// CommonJS so promptfoo can require() it directly without an ESM loader.

const fs = require('node:fs');
const path = require('node:path');

const signalsDir = path.join(__dirname, 'signals');

function loadFixtures() {
  return fs
    .readdirSync(signalsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(signalsDir, f), 'utf8')));
}

module.exports = loadFixtures().map((fx) => {
  const s = fx.signal;
  const direction = s.direction;
  const crossWord = direction === 'BUY' ? 'above' : 'below';
  const sizing = s.sizeUsdc ? ` Sizing ~${s.sizeUsdc} USDC.` : '';
  // The EXACT production user-turn template (mirrors buildUserContent in narrateSignal.ts).
  const userContent =
    `Signal: ${direction} ${s.pair}. ` +
    `Short MA ${Number(s.shortMa).toFixed(4)} crossed long MA ${Number(s.longMa).toFixed(4)} ` +
    `(${crossWord}).${sizing}`;

  return {
    description: `${fx.id} (${fx.category})`,
    vars: {
      userContent,
      // serialized signal so the JS assertion can re-run signalFidelity against the live output
      signalJson: JSON.stringify(s),
    },
    assert: [
      // --- must-pass deterministic code gates (HARD FAIL in CI) ---
      {
        type: 'javascript',
        value: 'file://promptfoo.assert.cjs',
      },
      // --- report-only LLM rubrics until the judge is calibrated (>=0.7) ---
      {
        type: 'llm-rubric',
        value:
          'The text sounds like a single confident momentum trader (patient until the trend confirms, then in fast, out faster) — one consistent persona, not a generic chatbot.',
        metric: 'persona',
        weight: 0,
      },
      {
        type: 'llm-rubric',
        value:
          'The text contains NO return guarantee, no projected profit/percentage as certainty, and no fabricated win-rate (FINRA/MiCA "fair, balanced, not misleading").',
        metric: 'promotion',
        weight: 0,
      },
      {
        type: 'llm-rubric',
        value:
          'The text narrates the agent\'s OWN decision in first person; it gives NO second-person advice/solicitation and implies no custody of the reader\'s funds.',
        metric: 'advice',
        weight: 0,
      },
    ],
  };
});
