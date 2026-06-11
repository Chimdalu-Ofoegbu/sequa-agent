// test/reconcileShared.test.ts
// Offline unit gate for the SHARED 5-field signal-tuple codec (D-40, RESEARCH Pattern 3/4).
// Two guarantees:
//   1. encodeSignal -> decodeSignal round-trips EXACTLY (no chain, no network).
//   2. encodeSignal's output is byte-for-byte identical to a `forge cast abi-encode
//      "f(address,address,uint256,uint256,uint24)" ...` fixture — i.e. the TS codec and the
//      Solidity abi.encode of the SourceRegistry D-07 tuple are the SAME wire format. If these
//      ever diverge, recordSignal would store bytes the on-chain SignalDecoded decode (and the
//      reconciler) cannot read.
// Runs with NO live chain and NO API key (the eval:unit / test CI gate).

import { describe, it, expect } from 'vitest';
import { getAddress } from 'viem';
import { encodeSignal, decodeSignal, matchKey } from '../src/chain/reconcile-shared';

// Live token addresses (addresses.json, Plan 01) — checksummed so the round-trip equality
// compares against the same canonical form viem returns from decodeAbiParameters.
const WMNT = getAddress('0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da');
const USDC = getAddress('0xAa606f127F0b40C2ab1ba47498d23C4C769C680E');

describe('reconcile-shared 5-field signal codec (D-40)', () => {
  it('round-trips decodeSignal(encodeSignal(x)) === x for a fee=3000 WMNT->USDC signal', () => {
    const input = {
      tokenIn: WMNT,
      tokenOut: USDC,
      amountIn: 3_000_000000000000000000n, // 3000 WMNT (18 dec)
      minAmountOut: 1_790_000000n, // 1790 USDC (6 dec) — slippage-bounded
      fee: 3000,
    };

    const encoded = encodeSignal(input.tokenIn, input.tokenOut, input.amountIn, input.minAmountOut, input.fee);
    const decoded = decodeSignal(encoded);

    expect(decoded).toEqual(input);
  });

  it('round-trips a generic small signal (1e18 in / 9e17 out, fee=3000)', () => {
    const tokenIn = getAddress('0x1111111111111111111111111111111111111111');
    const tokenOut = getAddress('0x2222222222222222222222222222222222222222');
    const amountIn = 1_000000000000000000n;
    const minAmountOut = 900000000000000000n;
    const fee = 3000;

    const decoded = decodeSignal(encodeSignal(tokenIn, tokenOut, amountIn, minAmountOut, fee));

    expect(decoded).toEqual({ tokenIn, tokenOut, amountIn, minAmountOut, fee });
  });

  // The codec's wire format MUST equal the Solidity abi.encode of (address,address,uint256,uint256,uint24).
  // These fixtures were produced OFFLINE by Foundry `cast` (no chain), so the assertion proves the TS
  // encoder and the on-chain SourceRegistry.decodeSignalTuple / SignalDecoded share one byte layout:
  //   cast abi-encode "f(address,address,uint256,uint256,uint24)" \
  //     0x55dAF03C1690a8E13cB1348d9693Cd25E89F74da \
  //     0xAa606f127F0b40C2ab1ba47498d23C4C769C680E 3000000000000000000000 1790000000 3000
  it('matches a forge/cast abi-encode fixture of (address,address,uint256,uint256,uint24) — WMNT->USDC', () => {
    const castFixture =
      '0x00000000000000000000000055daf03c1690a8e13cb1348d9693cd25e89f74da' +
      '000000000000000000000000aa606f127f0b40c2ab1ba47498d23c4c769c680e' +
      '0000000000000000000000000000000000000000000000a2a15d09519be00000' +
      '000000000000000000000000000000000000000000000000000000006ab13b80' +
      '0000000000000000000000000000000000000000000000000000000000000bb8';

    const encoded = encodeSignal(WMNT, USDC, 3_000_000000000000000000n, 1_790_000000n, 3000);

    // viem returns lowercase hex; cast also lowercases — compare directly.
    expect(encoded).toBe(castFixture);
    // And the fixture decodes back to the exact tuple (the on-chain bytes the reconciler reads).
    expect(decodeSignal(castFixture as `0x${string}`)).toEqual({
      tokenIn: WMNT,
      tokenOut: USDC,
      amountIn: 3_000_000000000000000000n,
      minAmountOut: 1_790_000000n,
      fee: 3000,
    });
  });

  it('matches a forge/cast abi-encode fixture for a generic small signal', () => {
    const tokenIn = getAddress('0x1111111111111111111111111111111111111111');
    const tokenOut = getAddress('0x2222222222222222222222222222222222222222');
    const castFixture =
      '0x0000000000000000000000001111111111111111111111111111111111111111' +
      '0000000000000000000000002222222222222222222222222222222222222222' +
      '0000000000000000000000000000000000000000000000000de0b6b3a7640000' +
      '0000000000000000000000000000000000000000000000000c7d713b49da0000' +
      '0000000000000000000000000000000000000000000000000000000000000bb8';

    expect(encodeSignal(tokenIn, tokenOut, 1_000000000000000000n, 900000000000000000n, 3000)).toBe(castFixture);
  });
});

describe('matchKey (reconciler ⨝ runtime join key)', () => {
  it('builds a stable, address-case-insensitive key from (tokenIn, tokenOut, amountIn)', () => {
    const k1 = matchKey(WMNT, USDC, 3_000_000000000000000000n);
    // Same tokens in a DIFFERENT case must produce the SAME key (the reconciler matches a
    // recorded signal to a settled swap whose log addresses may be lowercased).
    const k2 = matchKey(WMNT.toLowerCase() as `0x${string}`, USDC.toLowerCase() as `0x${string}`, 3_000_000000000000000000n);
    expect(k1).toBe(k2);
  });

  it('distinguishes different amounts and token directions', () => {
    const base = matchKey(WMNT, USDC, 1n);
    expect(matchKey(WMNT, USDC, 2n)).not.toBe(base); // different amount
    expect(matchKey(USDC, WMNT, 1n)).not.toBe(base); // reversed direction
  });
});
