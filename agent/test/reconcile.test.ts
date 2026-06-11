// test/reconcile.test.ts
// Unit tests for the PURE reconciler classifier (scripts/reconcile.ts `classify`). The classifier
// takes fixture arrays — recorded signals, the invalidated-id set, and settled swaps — and returns
// {matched, invalidated, orphan}. It is exercised with NO network, NO chain, NO API key: the chain
// I/O (getLogs / swap decode) lives in separate functions that are NOT called here, which is the
// whole point of keeping the classifier pure (D-40: same codec via matchKey, unit-testable core).
//
// Coverage required by the plan:
//   - matched: a non-invalidated signal with a settled swap on the same matchKey (block >= record).
//   - invalidated WITHOUT a swap → counted `invalidated`, NEVER `orphan` (D-30 — honest miss).
//   - non-invalidated WITHOUT a swap → `orphan` (would fail `reconcile.ts --assert`).
//   - direction sensitivity ((in,out) ≠ (out,in)) and one-swap-per-signal consumption.

import { describe, it, expect } from 'vitest';
import { classify, type RecordedSignal, type SettledSwap } from '../scripts/reconcile';
import type { Address } from 'viem';

// Stable mock token addresses (checksum-irrelevant — matchKey lowercases).
const USDC = '0xAa606f127F0b40C2ab1ba47498d23C4C769C680E' as Address;
const WMNT = '0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da' as Address;
const METH = '0xEDD7219bD5DBF25B44B891ccf25a26550277Bd3B' as Address;

function sig(signalId: string, tokenIn: Address, tokenOut: Address, amountIn: bigint, recordBlock = 100n): RecordedSignal {
  return { signalId, tokenIn, tokenOut, amountIn, recordBlock };
}
function swap(tokenIn: Address, tokenOut: Address, amountIn: bigint, swapBlock = 101n): SettledSwap {
  return { tokenIn, tokenOut, amountIn, swapBlock };
}

describe('classify — the pure reconciler classifier (D-40 acceptance gate core)', () => {
  it('matches a non-invalidated signal to a settled swap on the same (in,out,amount)', () => {
    const signals = [sig('1', USDC, WMNT, 1_000_000n)];
    const swaps = [swap(USDC, WMNT, 1_000_000n, 101n)];
    const report = classify(signals, new Set(), swaps);

    expect(report.matched).toBe(1);
    expect(report.invalidated).toBe(0);
    expect(report.orphan).toBe(0);
    expect(report.total).toBe(1);
    expect(report.signals[0]).toMatchObject({ signalId: '1', class: 'matched', orderingOk: true });
  });

  it('D-30: an INVALIDATED signal with NO matching swap is `invalidated`, NOT `orphan`', () => {
    // The swap reverted → invalidateSignal was emitted → no settled swap exists for this id.
    const signals = [sig('7', USDC, METH, 500_000n)];
    const invalidated = new Set<string>(['7']);
    const swaps: SettledSwap[] = []; // no swap settled for the invalidated signal

    const report = classify(signals, invalidated, swaps);

    expect(report.invalidated).toBe(1);
    expect(report.orphan).toBe(0); // CRITICAL: an invalidated-without-swap must NOT count as orphan
    expect(report.matched).toBe(0);
    expect(report.signals[0]).toMatchObject({ signalId: '7', class: 'invalidated' });
  });

  it('a NON-invalidated signal with NO settled swap is an `orphan` (would fail --assert)', () => {
    const signals = [sig('9', WMNT, USDC, 2_000_000n)];
    const report = classify(signals, new Set(), []); // no swap, not invalidated

    expect(report.orphan).toBe(1);
    expect(report.matched).toBe(0);
    expect(report.invalidated).toBe(0);
    expect(report.signals[0]).toMatchObject({ signalId: '9', class: 'orphan' });
  });

  it('classifies a mixed batch: 2 matched, 1 invalidated (no swap), 1 orphan', () => {
    const signals = [
      sig('1', USDC, WMNT, 1_000_000n, 100n), // matched
      sig('2', USDC, METH, 1_000_000n, 102n), // matched
      sig('3', WMNT, USDC, 9n, 104n), // invalidated (no swap)
      sig('4', METH, USDC, 7n, 106n), // orphan (no swap, not invalidated)
    ];
    const invalidated = new Set<string>(['3']);
    const swaps = [
      swap(USDC, WMNT, 1_000_000n, 101n),
      swap(USDC, METH, 1_000_000n, 103n),
    ];

    const report = classify(signals, invalidated, swaps);

    expect(report.matched).toBe(2);
    expect(report.invalidated).toBe(1);
    expect(report.orphan).toBe(1);
    expect(report.total).toBe(4);
    expect(report.signals.map((s) => s.class)).toEqual(['matched', 'matched', 'invalidated', 'orphan']);
  });

  it('is DIRECTION-sensitive: (USDC->WMNT) does not match a (WMNT->USDC) swap', () => {
    const signals = [sig('1', USDC, WMNT, 1_000_000n)];
    const swaps = [swap(WMNT, USDC, 1_000_000n)]; // reversed direction
    const report = classify(signals, new Set(), swaps);

    expect(report.matched).toBe(0);
    expect(report.orphan).toBe(1); // direction mismatch → orphan, never a false match
  });

  it('consumes each swap at most once: two identical signals, one swap → one matched, one orphan', () => {
    const signals = [
      sig('1', USDC, WMNT, 1_000_000n, 100n),
      sig('2', USDC, WMNT, 1_000_000n, 100n),
    ];
    const swaps = [swap(USDC, WMNT, 1_000_000n, 101n)]; // only ONE settled swap
    const report = classify(signals, new Set(), swaps);

    expect(report.matched).toBe(1);
    expect(report.orphan).toBe(1); // the second identical signal has no remaining swap
  });

  it('flags an ordering anomaly: a matched swap whose block is BEFORE the recordSignal block (D-34)', () => {
    const signals = [sig('1', USDC, WMNT, 1_000_000n, 200n)];
    const swaps = [swap(USDC, WMNT, 1_000_000n, 150n)]; // swap block < record block
    const report = classify(signals, new Set(), swaps);

    expect(report.matched).toBe(1); // still a real settled swap on the same key
    expect(report.orderingViolations).toBe(1);
    expect(report.signals[0]).toMatchObject({ class: 'matched', orderingOk: false });
  });

  it('PASSES the --assert gate condition (orphan === 0) when every non-invalidated signal matched', () => {
    const signals = [
      sig('1', USDC, WMNT, 1n, 100n),
      sig('2', USDC, METH, 2n, 100n),
      sig('3', WMNT, USDC, 3n, 100n), // invalidated, no swap — excluded from the gate
    ];
    const invalidated = new Set<string>(['3']);
    const swaps = [swap(USDC, WMNT, 1n, 101n), swap(USDC, METH, 2n, 101n)];

    const report = classify(signals, invalidated, swaps);
    expect(report.orphan).toBe(0); // the D-40 acceptance condition
  });

  it('is a PURE function: identical fixture inputs yield identical reports across calls (no network/state)', () => {
    const signals = [sig('1', USDC, WMNT, 1_000_000n, 100n), sig('2', METH, USDC, 5n, 100n)];
    const invalidated = new Set<string>();
    const swaps = [swap(USDC, WMNT, 1_000_000n, 101n)];

    const a = classify(signals, invalidated, swaps);
    const b = classify(signals, invalidated, swaps);
    expect(a).toEqual(b);
    // no module-level mutation leaked between calls:
    expect(a.matched).toBe(1);
    expect(a.orphan).toBe(1);
  });
});
