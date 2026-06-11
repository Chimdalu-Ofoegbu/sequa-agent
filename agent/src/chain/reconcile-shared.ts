// chain/reconcile-shared.ts
//
// ============================================================================================
//  THE 5-FIELD SIGNAL TUPLE — NOT the 8-field router struct (RESEARCH Pattern 3).
// ============================================================================================
//  This file is the SINGLE source of the D-07 signal-payload codec (D-40: "same code reused, not
//  reimplemented"). It is imported by BOTH the runtime hot path (recordSignal.ts) AND the
//  reconciler CLI (scripts/reconcile.ts) so the bytes recorded on-chain and the bytes the
//  reconciler decodes are produced by ONE encoder.
//
//  The signal tuple has 5 fields:   (address tokenIn, address tokenOut, uint256 amountIn,
//                                     uint256 minAmountOut, uint24 fee)
//  It is what SourceRegistry.recordSignal stores opaquely and SourceRegistry.SignalDecoded /
//  decodeSignalTuple re-decode on-chain. It is DELIBERATELY DISTINCT from the 8-field UniV3
//  ExactInputSingleParams router struct (tokenIn, tokenOut, fee, recipient, deadline, amountIn,
//  amountOutMinimum, sqrtPriceLimitX96) — that struct is derived from this tuple at swap time in
//  recordSignal.ts and lives nowhere near this codec. NEVER conflate the two (RESEARCH anti-pattern).
// ============================================================================================

import { encodeAbiParameters, decodeAbiParameters, getAddress, type Address, type Hex } from 'viem';

/** The 5-field tuple ABI parameter shape — the ONE definition both encode and decode use. */
const SIGNAL_TUPLE_PARAMS = [
  { name: 'tokenIn', type: 'address' },
  { name: 'tokenOut', type: 'address' },
  { name: 'amountIn', type: 'uint256' },
  { name: 'minAmountOut', type: 'uint256' },
  { name: 'fee', type: 'uint24' },
] as const;

/** The decoded 5-field signal tuple (the opaque D-07 payload, NOT the router struct). */
export interface DecodedSignal {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  fee: number;
}

/**
 * encodeSignal — ABI-encode the D-07 5-field signal tuple to the exact bytes recordSignal stores.
 * Byte-for-byte identical to Solidity `abi.encode(address,address,uint256,uint256,uint24)` (asserted
 * against a `cast abi-encode` fixture in test/reconcileShared.test.ts).
 */
export function encodeSignal(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  minAmountOut: bigint,
  fee: number,
): Hex {
  return encodeAbiParameters(SIGNAL_TUPLE_PARAMS, [tokenIn, tokenOut, amountIn, minAmountOut, fee]);
}

/**
 * decodeSignal — inverse of encodeSignal. Used by the reconciler to read the bytes from
 * SignalRecorded / signalAt back into the 5 fields it matches against settled swaps.
 * Addresses are returned EIP-55-checksummed (viem default) for stable equality/printing.
 */
export function decodeSignal(encoded: Hex): DecodedSignal {
  const [tokenIn, tokenOut, amountIn, minAmountOut, fee] = decodeAbiParameters(SIGNAL_TUPLE_PARAMS, encoded);
  return {
    tokenIn: getAddress(tokenIn),
    tokenOut: getAddress(tokenOut),
    amountIn,
    minAmountOut,
    fee: Number(fee),
  };
}

/**
 * matchKey — the reconciler⨝runtime join key over (tokenIn, tokenOut, amountIn). A recorded signal
 * matches a settled swap when their keys are equal (RESEARCH Pattern 4). Addresses are lowercased so
 * a log-derived (lowercase) address and a checksummed runtime address join correctly; `amountIn` is a
 * bigint so the key is exact (no float). Direction matters: (in,out) ≠ (out,in).
 */
export function matchKey(tokenIn: Address, tokenOut: Address, amountIn: bigint): string {
  return `${tokenIn.toLowerCase()}:${tokenOut.toLowerCase()}:${amountIn.toString()}`;
}
