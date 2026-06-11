// eval/validators.test.ts
// The ALWAYS-ON eval gate (`npm run eval:unit`). Runs the deterministic code validators —
// signalFidelity (dimension 1) + bannedPhrases (dimensions 2/3) + thesisSchema (dimension 5) —
// over every labeled fixture and asserts each matches its expected PASS/FAIL. NO API key, NO
// network: this is the offline backbone that CI hard-fails on (AI-SPEC §5 CI gate policy).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signalFidelity } from './signalFidelity';
import { bannedPhrases } from './bannedPhrases';
import { thesisSchema } from '../src/narration/thesisSchema';
import type { Signal } from '../src/signals/types';

const here = dirname(fileURLToPath(import.meta.url));
const signalsDir = join(here, 'signals');

interface Fixture {
  id: string;
  category: string;
  note?: string;
  signal: Signal;
  thesis: string;
  expected: {
    fidelity: 'PASS' | 'FAIL';
    promotion: 'PASS' | 'FAIL';
    advice: 'PASS' | 'FAIL';
    format: 'PASS' | 'FAIL';
  };
}

function loadFixtures(): Fixture[] {
  return readdirSync(signalsDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(signalsDir, f), 'utf8')) as Fixture);
}

const fixtures = loadFixtures();

describe('eval dataset shape', () => {
  it('contains 12-18 fixtures (ai-evals "10-20 high-quality")', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(12);
    expect(fixtures.length).toBeLessThanOrEqual(18);
  });

  it('covers the 6 happy paths (3 pairs x BUY/SELL) plus adversarial + format-edge', () => {
    const happy = fixtures.filter((f) => f.category === 'happy');
    expect(happy.length).toBe(6);
    expect(fixtures.some((f) => f.category.includes('contradiction'))).toBe(true);
    expect(fixtures.some((f) => f.category === 'promotion-bait')).toBe(true);
    expect(fixtures.some((f) => f.category === 'advice-bait')).toBe(true);
    expect(fixtures.some((f) => f.category === 'fabrication-bait')).toBe(true);
    expect(fixtures.some((f) => f.category === 'format-edge')).toBe(true);
  });

  it('NEVER includes the no-thesis skip cases D-13/D-14/D-15 (out of the dataset, AI-SPEC §5)', () => {
    for (const f of fixtures) {
      const blob = JSON.stringify(f);
      expect(blob).not.toMatch(/D-13|D-14|D-15/);
    }
  });
});

describe.each(fixtures.map((f) => [f.id, f] as const))(
  'fixture %s — code validators match labels',
  (_id, f) => {
    it('signalFidelity matches the expected fidelity label', () => {
      const res = signalFidelity(f.thesis, f.signal);
      expect(res.pass).toBe(f.expected.fidelity === 'PASS');
    });

    it('bannedPhrases matches the expected promotion+advice label', () => {
      const res = bannedPhrases(f.thesis);
      // bannedPhrases is a single gate covering BOTH promotion and advice; the fixture
      // passes the gate only when BOTH promotion and advice are expected to PASS.
      const expectedPass = f.expected.promotion === 'PASS' && f.expected.advice === 'PASS';
      expect(res.pass).toBe(expectedPass);
    });

    it('thesisSchema matches the expected format label', () => {
      const res = thesisSchema.safeParse({ thesis: f.thesis });
      expect(res.success).toBe(f.expected.format === 'PASS');
    });
  },
);

// --- the two acceptance-criteria assertions, named explicitly --------------------------------
describe('acceptance: baits are caught by the deterministic gates', () => {
  it('signalFidelity flags the contradiction-bait (SELL narrated as long) as FAIL', () => {
    const f = fixtures.find((x) => x.id === 'bait-contradiction')!;
    expect(f.signal.direction).toBe('SELL');
    const res = signalFidelity(f.thesis, f.signal);
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/inversion|SELL/i);
  });

  it('bannedPhrases flags the promotion-bait ("guaranteed 40%") as FAIL', () => {
    const f = fixtures.find((x) => x.id === 'bait-promotion')!;
    expect(f.thesis.toLowerCase()).toContain('guaranteed 40%');
    const res = bannedPhrases(f.thesis);
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/promotion/i);
  });

  it('every happy-path fixture PASSES all three deterministic gates', () => {
    for (const f of fixtures.filter((x) => x.category === 'happy')) {
      expect(signalFidelity(f.thesis, f.signal).pass, `${f.id} fidelity`).toBe(true);
      expect(bannedPhrases(f.thesis).pass, `${f.id} banned`).toBe(true);
      expect(thesisSchema.safeParse({ thesis: f.thesis }).success, `${f.id} format`).toBe(true);
    }
  });
});

// --- fail-closed direction-inversion: opposite lexicon present masks the inversion -------------
describe('acceptance: signalFidelity fails CLOSED when BOTH lexicons co-occur (inversion mask)', () => {
  it('SELL narrated bullishly ("going long ... not selling") is fidelity FAIL', () => {
    const f = fixtures.find((x) => x.id === 'bait-inversion-sell-as-long')!;
    expect(f.signal.direction).toBe('SELL');
    const res = signalFidelity(f.thesis, f.signal);
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/inversion|BUY\/long/i);
  });

  it('BUY narrated as exit ("exiting ... staying long") is fidelity FAIL', () => {
    const f = fixtures.find((x) => x.id === 'bait-inversion-buy-as-exit')!;
    expect(f.signal.direction).toBe('BUY');
    const res = signalFidelity(f.thesis, f.signal);
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/inversion|SELL\/exit/i);
  });

  // direct unit cases (independent of fixtures) — the anchor masking bug
  it('inline: SELL with co-occurring long+sell language FAILS regardless of order', () => {
    const sell: Signal = {
      agentId: 'agent-1',
      pair: 'WMNT/USDC',
      direction: 'SELL',
      shortMa: 0.59,
      longMa: 0.61,
    };
    expect(
      signalFidelity('On WMNT/USDC I am going long and riding it, not selling.', sell).pass,
    ).toBe(false);
  });
});

// --- fix #6: pair name match is word-bounded, not a bare substring ----------------------------
describe('signalFidelity pair-name match is word-bounded', () => {
  const methBuy: Signal = {
    agentId: 'agent-1',
    pair: 'mETH/USDC',
    direction: 'BUY',
    shortMa: 3215.44,
    longMa: 3190.12,
    sizeUsdc: 2100,
  };

  it('"method" does NOT false-pass as naming the mETH pair', () => {
    // names no real token; "method" merely *contains* "meth" → must NOT satisfy the pair check
    const res = signalFidelity('Entering long here as the method confirms the trend.', methBuy);
    expect(res.pass).toBe(false);
    expect(res.reason).toMatch(/does not name the pair token/i);
  });

  it('a genuine "mETH" mention (word-bounded) still satisfies the pair check', () => {
    const res = signalFidelity('Entering long on mETH as the short crosses above the long.', methBuy);
    expect(res.pass).toBe(true);
  });

  it('the canonical "mETH/USDC" pair string satisfies the pair check', () => {
    const res = signalFidelity('Stepping into mETH/USDC long as the short crosses above.', methBuy);
    expect(res.pass).toBe(true);
  });
});
