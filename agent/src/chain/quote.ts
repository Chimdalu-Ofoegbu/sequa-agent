// chain/quote.ts
// QuoterV2 spot-price read for the 30s MA poll (D-02/D-03).
//
// CRITICAL (RESEARCH Pitfall 2): QuoterV2.quoteExactInputSingle is NON-VIEW — it reverts internally
// and ABI-decodes the revert, so a plain view/static call REVERTS. It MUST be called via viem
// `simulateContract` (the eth_call simulation that captures the would-be return). This file uses
// simulateContract exclusively — no view/static read of the quoter appears here, by design.

import { type Address, type PublicClient } from 'viem';
import { quoterV2Abi } from './abis';

/**
 * PriceSeriesBuffer — a bounded ring of raw spot reads the CALLER owns (D-02 replay determinism).
 * The strategy core consumes these as the MA windows; persisting the raw series lets the replay
 * harness re-run the exact decision. `push` trims to `capacity` (FIFO) so the long-running agent
 * does not grow unbounded.
 */
export class PriceSeriesBuffer {
  private readonly values: bigint[] = [];
  constructor(private readonly capacity: number = 256) {}

  push(amountOut: bigint): void {
    this.values.push(amountOut);
    if (this.values.length > this.capacity) this.values.shift();
  }

  /** A copy of the current series, oldest → newest. */
  series(): bigint[] {
    return [...this.values];
  }

  get length(): number {
    return this.values.length;
  }
}

/**
 * quote — read the amountOut for swapping `amountIn` of tokenIn → tokenOut at the given fee tier,
 * via simulateContract (non-view). Returns amountOut as a bigint (raw on-chain units). The caller
 * pushes this into its own PriceSeriesBuffer for the MA windows.
 *
 * @param pub        a viem public client (Mantle Sepolia)
 * @param quoterV2   the QuoterV2 address read at runtime from addresses.json (never hard-coded)
 * @param tokenIn    input token
 * @param tokenOut   output token
 * @param amountIn   input amount in raw units (e.g. parseUnits('1', decimalsIn) for a per-unit price)
 * @param fee        the fee tier (addresses.json `fee` = 3000)
 */
export async function quote(
  pub: PublicClient,
  quoterV2: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
): Promise<bigint> {
  // simulateContract — the ONLY correct way to read QuoterV2 (Pitfall 2). A view/static read reverts.
  const { result } = await pub.simulateContract({
    address: quoterV2,
    abi: quoterV2Abi,
    functionName: 'quoteExactInputSingle',
    args: [
      {
        tokenIn,
        tokenOut,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n, // 0 = no price limit; we want the true spot quote
      },
    ],
  });
  // QuoterV2 returns (amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate).
  const [amountOut] = result;
  return amountOut;
}

/**
 * quoteAndRecord — convenience wrapper: take a spot quote AND persist it into the caller's price
 * buffer in one call (D-02). Returns the amountOut just read.
 */
export async function quoteAndRecord(
  pub: PublicClient,
  quoterV2: Address,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
  buffer: PriceSeriesBuffer,
): Promise<bigint> {
  const amountOut = await quote(pub, quoterV2, tokenIn, tokenOut, amountIn, fee);
  buffer.push(amountOut);
  return amountOut;
}
