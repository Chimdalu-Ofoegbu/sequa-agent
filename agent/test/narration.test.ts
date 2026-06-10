// test/narration.test.ts
// Narration is the agent's VOICE, off the on-chain hot path. The contract:
//   (a) thesisSchema enforces the 15-280 char / no {}`  budget (AI-SPEC §4b)
//   (b) fallbackThesis is deterministic + fidelity-correct (names the pair + a direction verb)
//   (c) narrateSignalSafe NEVER throws and NEVER blocks: validate → one retry → fallback
//       on a thrown call AND on a schema-failing response.
//
// The Anthropic client is MOCKED (vitest) — NO live network call, NO ANTHROPIC_API_KEY needed.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Anthropic SDK BEFORE importing any module that constructs the client singleton.
// The mock lets each test drive what `client.messages.create` returns / throws.
// `vi.hoisted` is required because vi.mock is hoisted above plain const declarations — the
// factory would otherwise reference createMock before initialization.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: createMock };
    constructor(public opts: unknown) {}
  }
  return { default: MockAnthropic };
});

import { thesisSchema } from '../src/narration/thesisSchema';
import { fallbackThesis } from '../src/narration/fallback';
import { narrateSignal, narrateSignalSafe } from '../src/narration/narrateSignal';
import type { Signal } from '../src/signals/types';

function buyWmnt(): Signal {
  return {
    agentId: 'agent-1',
    pair: 'WMNT/USDC',
    direction: 'BUY',
    shortMa: 0.6123,
    longMa: 0.6011,
    sizeUsdc: 3000,
  };
}

function sellMeth(): Signal {
  return {
    agentId: 'agent-1',
    pair: 'mETH/USDC',
    direction: 'SELL',
    shortMa: 3180.42,
    longMa: 3201.77,
  };
}

/** A clean text-block Anthropic response. */
function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

beforeEach(() => {
  createMock.mockReset();
});

describe('thesisSchema (AI-SPEC §4b)', () => {
  it('accepts a clean 1-2 sentence string', () => {
    const ok = thesisSchema.safeParse({
      thesis: 'The short average punched above the long on WMNT/USDC, so I am stepping in with the trend.',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an empty / too-short string', () => {
    expect(thesisSchema.safeParse({ thesis: '' }).success).toBe(false);
    expect(thesisSchema.safeParse({ thesis: 'too short' }).success).toBe(false);
  });

  it('rejects an overlong string (> 280 chars)', () => {
    const overlong = 'a'.repeat(281);
    expect(thesisSchema.safeParse({ thesis: overlong }).success).toBe(false);
  });

  it('rejects JSON/markdown-breaking characters ({ } backtick)', () => {
    expect(
      thesisSchema.safeParse({ thesis: 'Stepping into WMNT now { raw: tuple }' }).success,
    ).toBe(false);
    expect(
      thesisSchema.safeParse({ thesis: 'Stepping into WMNT now `code` fenced' }).success,
    ).toBe(false);
  });
});

describe('fallbackThesis (deterministic, fidelity-correct by construction)', () => {
  it('BUY WMNT/USDC names "WMNT" and reads as entering/long', () => {
    const t = fallbackThesis(buyWmnt());
    expect(t).toContain('WMNT');
    expect(t.toLowerCase()).toMatch(/long|entering|stepping in|in with the trend/);
    // and it must itself pass the schema (a fallback that fails its own gate is useless)
    expect(thesisSchema.safeParse({ thesis: t }).success).toBe(true);
  });

  it('SELL mETH/USDC names "mETH" and reads as exiting/out', () => {
    const t = fallbackThesis(sellMeth());
    expect(t).toContain('mETH');
    expect(t.toLowerCase()).toMatch(/out|exiting|flat|stepping out/);
    expect(thesisSchema.safeParse({ thesis: t }).success).toBe(true);
  });

  it('is deterministic — same signal yields the same text', () => {
    expect(fallbackThesis(buyWmnt())).toBe(fallbackThesis(buyWmnt()));
  });
});

describe('narrateSignal (locked model/params + text-block guard)', () => {
  it('returns the trimmed text of a clean response', async () => {
    createMock.mockResolvedValueOnce(textResponse('  Stepping into WMNT/USDC with the trend.  '));
    const out = await narrateSignal(buyWmnt());
    expect(out).toBe('Stepping into WMNT/USDC with the trend.');
  });

  it('throws on a non-text content block (pitfall #1 guard)', async () => {
    createMock.mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }] });
    await expect(narrateSignal(buyWmnt())).rejects.toThrow();
  });
});

describe('narrateSignalSafe — NEVER throws, NEVER blocks (AI-SPEC §4 / threat T-1-11)', () => {
  it('returns the valid thesis on first-call success', async () => {
    createMock.mockResolvedValueOnce(
      textResponse('Short average crossed above the long on WMNT/USDC, so I am stepping in with the trend.'),
    );
    const out = await narrateSignalSafe(buyWmnt(), 'sig-1');
    expect(out).toContain('WMNT');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('resolves to the FALLBACK (does NOT reject) when narrateSignal throws', async () => {
    // every call throws → both the first call and the retry path go through catch
    createMock.mockRejectedValue(new Error('boom: simulated timeout'));
    const out = await narrateSignalSafe(buyWmnt(), 'sig-2');
    expect(out).toBe(fallbackThesis(buyWmnt())); // deterministic fallback
    expect(out).toContain('WMNT');
  });

  it('retries ONCE then falls back on a schema-failing response, without throwing', async () => {
    // first response is too short (fails schema), retry also fails schema → fallback
    createMock
      .mockResolvedValueOnce(textResponse('nope'))
      .mockResolvedValueOnce(textResponse('still nope'));
    const out = await narrateSignalSafe(sellMeth(), 'sig-3');
    expect(out).toBe(fallbackThesis(sellMeth()));
    expect(createMock).toHaveBeenCalledTimes(2); // exactly one retry
  });

  it('uses the retry result when the FIRST fails schema but the SECOND passes', async () => {
    createMock
      .mockResolvedValueOnce(textResponse('bad')) // fails schema (too short)
      .mockResolvedValueOnce(
        textResponse('Momentum rolled over on mETH/USDC, so I am stepping out before the reversal deepens.'),
      );
    const out = await narrateSignalSafe(sellMeth(), 'sig-4');
    expect(out).toContain('mETH');
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
