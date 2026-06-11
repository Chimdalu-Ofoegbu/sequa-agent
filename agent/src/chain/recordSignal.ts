// chain/recordSignal.ts
// THE HOT PATH (RESEARCH Pattern 3, D-25). For every emitted Signal the operator EOA runs a 2-tx
// flow, in order:
//   1. SourceRegistry.recordSignal(agentId, encoded5FieldTuple)  -> SignalRecorded(signalId)
//   2. SwapRouter.exactInputSingle(8-field router struct derived from the 5-field tuple)
// On a swap REVERT we do NOT hide the miss (D-30): SourceRegistry.invalidateSignal(agentId,signalId,
// reason) is called and the function returns null. On success it returns the signalId.
//
// W2 / D-43 DISCIPLINE: this file contains NO hard-coded address. The SourceRegistry, SwapRouter and
// agentId are passed in (read at runtime from addresses.json by the caller via clients.ts) so the
// acceptance grep `grep -nE "0x[a-fA-F0-9]{40}" recordSignal.ts` is empty. The ONLY 0x literal here
// is the uint256-max approve amount (a number, not an address).
//
// 5-field signal tuple  ≠  8-field router struct — they are derived, never conflated (Pattern 3).

import {
  decodeEventLog,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
} from 'viem';
import { encodeSignal } from './reconcile-shared';
import { sourceRegistryAbi, swapRouterAbi, erc20Abi } from './abis';

/** uint256 max — the one-time max approve amount (D-29). type(uint256).max == 2**256 - 1. */
export const MAX_UINT256 = 2n ** 256n - 1n;

/** Seconds added to `block.timestamp` for the swap deadline (RESEARCH Pattern 3: now + 120). */
export const SWAP_DEADLINE_BUFFER_SECONDS = 120;

/**
 * Per-receipt wait timeout (ms). A stuck/dropped tx must NOT wedge the hot path forever (Pitfall 5):
 * viem's waitForTransactionReceipt rejects after this so we surface the failure and move on. The swap
 * path treats a receipt timeout as a failed swap → invalidate; record/invalidate timeouts propagate so
 * the per-signal handler in index.ts skips that signal (the tick continues with the rest).
 */
export const RECEIPT_TIMEOUT_MS = 120_000;

/** Number of receipt-wait attempts (the initial wait + this-many-minus-1 retries). */
export const RECEIPT_RETRIES = 1;

/**
 * SignalDecodeError — the typed error thrown when the recordSignal tx confirmed but its SignalRecorded
 * log could not be located/parsed (the signal IS on-chain; we just can't recover its signalId). The
 * caller distinguishes this from a pre-confirm failure to avoid leaving an un-invalidatable orphan.
 */
export class SignalDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignalDecodeError';
  }
}

/**
 * waitForReceipt — waitForTransactionReceipt with a bounded timeout + a small retry so a momentarily
 * slow RPC does not abort the flow, but a genuinely stuck tx cannot block forever. Rejects after the
 * last attempt times out (the caller decides record/swap/invalidate semantics).
 */
async function waitForReceipt(
  pub: PublicClient,
  hash: Hex,
  timeout: number = RECEIPT_TIMEOUT_MS,
  retries: number = RECEIPT_RETRIES,
): Promise<Awaited<ReturnType<PublicClient['waitForTransactionReceipt']>>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pub.waitForTransactionReceipt({ hash, timeout });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * SignalParams — the 5-field signal tuple the hot path records + swaps (D-07). amountIn/minAmountOut
 * are raw on-chain units; `minAmountOut` is the slippage bound carried straight into the swap's
 * `amountOutMinimum` (T-1-12). This is the same shape reconcile-shared encodes.
 */
export interface SignalParams {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  fee: number;
}

/** The chain context the hot path needs — all addresses originate from addresses.json (clients.ts). */
export interface ChainContext {
  pub: PublicClient;
  wallet: WalletClient;
  account: Account;
  /** SourceRegistry address — read at runtime from addresses.json (requireSourceRegistry). */
  sourceRegistry: Address;
  /** SwapRouter address — read at runtime from addresses.json venue. */
  swapRouter: Address;
  /** ERC-8004 agentId — captured at mint (NOT 1, Pitfall 6); requireAgentId(addresses.json). */
  agentId: bigint;
}

/**
 * ensureApprovals — one-time `approve(SwapRouter, type(uint256).max)` on each token the agent trades
 * (D-29), so every signal is a clean 2-tx flow, not 3. Idempotent: skips a token whose current
 * allowance is already MAX_UINT256 (re-running the agent does not spam approvals). Called once at
 * startup, OFF the per-signal hot path.
 */
export async function ensureApprovals(ctx: ChainContext, tokens: Address[]): Promise<void> {
  const owner = ctx.account.address;
  for (const token of tokens) {
    const current = (await ctx.pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, ctx.swapRouter],
    })) as bigint;

    if (current >= MAX_UINT256) continue; // already maxed — idempotent skip

    const hash = await ctx.wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ctx.swapRouter, MAX_UINT256],
      account: ctx.account,
      chain: ctx.wallet.chain,
    });
    await ctx.pub.waitForTransactionReceipt({ hash });
  }
}

/**
 * decodeSignalId — recover the indexed signalId by scanning ALL receipt logs for the SignalRecorded
 * event emitted by the registry address (we do NOT assume the log is at a fixed position — the swap
 * router or other contracts in the same tx could interleave logs, and the registry could grow events).
 * Throws a typed SignalDecodeError if no SignalRecorded log from the registry is present, so the caller
 * can tell "signal is on-chain but unparseable" apart from a generic failure.
 */
function decodeSignalId(logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[], registry: Address): bigint {
  for (const log of logs) {
    if (log.address.toLowerCase() !== registry.toLowerCase()) continue;
    try {
      const parsed = decodeEventLog({
        abi: sourceRegistryAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (parsed.eventName === 'SignalRecorded') {
        return (parsed.args as { signalId: bigint }).signalId;
      }
    } catch {
      // not a SourceRegistry event we model — keep scanning the rest of the receipt logs.
    }
  }
  throw new SignalDecodeError('SignalRecorded log not found in recordSignal receipt (signal may be on-chain but signalId unparseable)');
}

/**
 * recordSignalThenSwap — the hot path. Returns the signalId (as a string) on success, or null if the
 * swap reverted (after invalidating the signal on-chain, D-30). MUST be awaited by the poll loop
 * (Plan 05) — narration is fired off-path AFTER this returns, never inside it.
 */
export async function recordSignalThenSwap(ctx: ChainContext, signal: SignalParams): Promise<string | null> {
  const { pub, wallet, account, sourceRegistry, swapRouter, agentId } = ctx;

  // 1) Record the decision on-chain — encode the 5-FIELD signal tuple (shared codec, D-40).
  //    The record tx + signalId decode are wrapped together: if the record tx itself fails (or its
  //    receipt times out), we have NO on-chain signal → propagate so the per-signal handler in
  //    index.ts skips this signal (the rest of the tick continues). If the record CONFIRMED but the
  //    signalId could not be decoded (signal IS on-chain, id unparseable), we log loudly and return
  //    null so the tick continues — there is no recoverable signalId to invalidate.
  const encoded = encodeSignal(signal.tokenIn, signal.tokenOut, signal.amountIn, signal.minAmountOut, signal.fee);
  let signalId: bigint;
  try {
    const recTx = await wallet.writeContract({
      address: sourceRegistry,
      abi: sourceRegistryAbi,
      functionName: 'recordSignal',
      args: [agentId, encoded],
      account,
      chain: wallet.chain,
    });
    const recReceipt = await waitForReceipt(pub, recTx);
    signalId = decodeSignalId(recReceipt.logs, sourceRegistry);
  } catch (err) {
    if (err instanceof SignalDecodeError) {
      // The record tx confirmed (signal is on-chain) but the signalId is unparseable. We cannot
      // invalidate an id we don't have — log LOUDLY and continue the tick (return null, no swap).
      console.error({
        event: 'record_signal_decode_failed',
        reason: 'signal_recorded_but_signalId_unparseable',
        err: String(err),
      });
      return null;
    }
    // The record tx failed / timed out before confirming a signalId — no signal on-chain to clean up.
    // Propagate so index.ts's per-signal try/catch isolates this one and the tick continues.
    throw err;
  }

  // 2) Settle the swap — DERIVE the 8-FIELD router struct from the 5-field tuple (NOT the same shape).
  //    recipient = operator EOA; deadline = now + buffer; amountOutMinimum = the signal's minAmountOut
  //    (the slippage bound, T-1-12); sqrtPriceLimitX96 = 0 (no price limit).
  const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS);
  try {
    const swapTx = await wallet.writeContract({
      address: swapRouter,
      abi: swapRouterAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: signal.tokenIn,
          tokenOut: signal.tokenOut,
          fee: signal.fee,
          recipient: account.address,
          deadline,
          amountIn: signal.amountIn,
          amountOutMinimum: signal.minAmountOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
      account,
      chain: wallet.chain,
    });
    // A receipt timeout here (stuck swap tx) is treated EXACTLY like a swap revert: the catch below
    // invalidates the signal (D-30) and returns null. A stuck tx must not wedge the hot path forever.
    await waitForReceipt(pub, swapTx);
  } catch (err) {
    // D-30: surface the miss on-chain — we don't hide misses. Then return null (no successful swap).
    const reason = `swap_reverted: ${err instanceof Error ? err.message : String(err)}`.slice(0, 256);
    try {
      const invTx = await wallet.writeContract({
        address: sourceRegistry,
        abi: sourceRegistryAbi,
        functionName: 'invalidateSignal',
        args: [agentId, signalId, reason],
        account,
        chain: wallet.chain,
      });
      await waitForReceipt(pub, invTx);
    } catch (invErr) {
      // If even the invalidate fails (e.g. RPC), log — but still return null; the swap did not settle.
      console.warn({ signalId: signalId.toString(), reason: 'invalidate_failed', err: String(invErr) });
    }
    return null;
  }

  return signalId.toString();
}
