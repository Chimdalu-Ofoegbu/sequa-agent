// scripts/reconcile.ts — THE RECONCILER CLI + PHASE 1 ACCEPTANCE GATE (D-40).
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
//  This is BOTH a deliverable AND the Phase 1 success criterion. It proves REQ-06 ("performance from
//  on-chain history only"): every NON-invalidated SignalRecorded must map to a settled swap by the
//  operator EOA. Run with `--assert` to gate — it exits NON-ZERO if any non-invalidated signal is an
//  orphan (orphan == 0 to pass). Phase 4 reuses the SAME classifier behind the agent-card "Verify".
//
//  D-40 DISCIPLINE: the 5-field signal codec (decodeSignal / matchKey) is IMPORTED from
//  agent/src/chain/reconcile-shared.ts — the SAME code the runtime hot path uses, NOT reimplemented.
//
//  Classification (RESEARCH Pattern 4 / D-30 / D-34):
//    - matched     : a non-invalidated signal whose matchKey(tokenIn,tokenOut,amountIn) has a settled
//                    swap from the operator EOA at a block >= the recordSignal block (best-effort, D-34).
//    - invalidated : a signal whose (agentId,signalId) appears in SignalInvalidated — EXCLUDED from
//                    the orphan gate even if it has no swap (an invalidated-without-swap is honest, D-30).
//    - orphan      : a NON-invalidated signal with NO matching settled swap → FAILS --assert.
// ════════════════════════════════════════════════════════════════════════════════════════════════

import { decodeEventLog, decodeFunctionData, getAbiItem, getAddress, type Address, type Hex, type PublicClient } from 'viem';
import { assertConfig } from '../src/config';
import { makePublicClient, operatorAccount } from '../src/chain/clients';
import { sourceRegistryAbi, swapRouterAbi } from '../src/chain/abis';
import { decodeSignal, matchKey } from '../src/chain/reconcile-shared';
import { isEntry } from '../src/isEntry';

/** The typed SignalRecorded / SignalInvalidated event items (for getLogs `event:`). */
const signalRecordedEvent = getAbiItem({ abi: sourceRegistryAbi, name: 'SignalRecorded' });
const signalInvalidatedEvent = getAbiItem({ abi: sourceRegistryAbi, name: 'SignalInvalidated' });

// ---------------------------------------------------------------------------------------------
//  PURE CLASSIFIER (unit-tested with fixture arrays — NO network, NO chain, NO API key).
// ---------------------------------------------------------------------------------------------

/** A recorded signal as the classifier sees it (decoded from SignalRecorded + the 5-field tuple). */
export interface RecordedSignal {
  signalId: string;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  /** block number the recordSignal tx landed in (for the best-effort ordering check, D-34). */
  recordBlock: bigint;
}

/** A settled swap by the operator EOA (from exactInputSingle txs / pool Swap events). */
export interface SettledSwap {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  /** block number the swap tx landed in (>= recordBlock for a valid match, D-34). */
  swapBlock: bigint;
}

/** The per-signal classification outcome. */
export type SignalClass = 'matched' | 'invalidated' | 'orphan';

export interface ClassifiedSignal {
  signalId: string;
  class: SignalClass;
  /** present iff matched — true when the matched swap block >= the recordSignal block (D-34). */
  orderingOk?: boolean;
}

export interface ReconcileReport {
  matched: number;
  invalidated: number;
  orphan: number;
  total: number;
  /** number of matched signals whose swap block was BEFORE the recordSignal block (ordering anomaly). */
  orderingViolations: number;
  signals: ClassifiedSignal[];
}

/**
 * classify — THE PURE CLASSIFIER. Given the recorded signals, the set of invalidated signalIds, and
 * the operator's settled swaps, classify each signal as matched / invalidated / orphan. No I/O — this
 * is the unit-tested core (reconcile.test.ts feeds it fixture arrays).
 *
 *   - A signal whose id is in `invalidatedIds` is `invalidated` (D-30) — NEVER an orphan, even with
 *     no swap. We don't hide misses, but an honest invalidate does not fail the gate.
 *   - Otherwise, a signal with a settled swap sharing its matchKey AND a swap block >= its record
 *     block is `matched`. Each swap is consumed once (a swap matches at most one signal).
 *   - Otherwise it is an `orphan` → fails --assert.
 */
export function classify(
  signals: readonly RecordedSignal[],
  invalidatedIds: ReadonlySet<string>,
  swaps: readonly SettledSwap[],
): ReconcileReport {
  // index available swaps by matchKey → a queue of (block, consumed?) so each swap matches once.
  const swapsByKey = new Map<string, { block: bigint; used: boolean }[]>();
  for (const s of swaps) {
    const key = matchKey(s.tokenIn, s.tokenOut, s.amountIn);
    const list = swapsByKey.get(key) ?? [];
    list.push({ block: s.swapBlock, used: false });
    swapsByKey.set(key, list);
  }

  const out: ClassifiedSignal[] = [];
  let matched = 0;
  let invalidated = 0;
  let orphan = 0;
  let orderingViolations = 0;

  for (const sig of signals) {
    if (invalidatedIds.has(sig.signalId)) {
      invalidated += 1;
      out.push({ signalId: sig.signalId, class: 'invalidated' });
      continue;
    }

    const key = matchKey(sig.tokenIn, sig.tokenOut, sig.amountIn);
    const candidates = swapsByKey.get(key);
    // prefer the earliest unused swap at/after the record block (best-effort ordering, D-34).
    let chosen: { block: bigint; used: boolean } | undefined;
    if (candidates) {
      for (const c of candidates) {
        if (!c.used && c.block >= sig.recordBlock) {
          chosen = c;
          break;
        }
      }
      // fall back to ANY unused swap on the key (ordering anomaly, still a real settled swap).
      if (!chosen) {
        chosen = candidates.find((c) => !c.used);
      }
    }

    if (chosen) {
      chosen.used = true;
      const orderingOk = chosen.block >= sig.recordBlock;
      if (!orderingOk) orderingViolations += 1;
      matched += 1;
      out.push({ signalId: sig.signalId, class: 'matched', orderingOk });
    } else {
      orphan += 1;
      out.push({ signalId: sig.signalId, class: 'orphan' });
    }
  }

  return {
    matched,
    invalidated,
    orphan,
    total: signals.length,
    orderingViolations,
    signals: out,
  };
}

// ---------------------------------------------------------------------------------------------
//  CHAIN I/O (walks the registry logs + the operator's swaps). Kept OUT of the pure classifier.
// ---------------------------------------------------------------------------------------------

/** Read SignalRecorded logs for the agentId and decode each 5-field tuple via the shared codec. */
export async function fetchRecordedSignals(
  pub: PublicClient,
  sourceRegistry: Address,
  agentId: bigint,
  fromBlock: bigint,
  toBlock: bigint | 'latest',
): Promise<RecordedSignal[]> {
  const logs = await pub.getLogs({
    address: sourceRegistry,
    event: signalRecordedEvent,
    args: { agentId },
    fromBlock,
    toBlock,
  });
  const out: RecordedSignal[] = [];
  for (const log of logs) {
    const parsed = decodeEventLog({
      abi: sourceRegistryAbi,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (parsed.eventName !== 'SignalRecorded') continue;
    const args = parsed.args as { signalId: bigint; signal: Hex };
    const decoded = decodeSignal(args.signal); // shared codec (D-40)
    out.push({
      signalId: args.signalId.toString(),
      tokenIn: decoded.tokenIn,
      tokenOut: decoded.tokenOut,
      amountIn: decoded.amountIn,
      recordBlock: log.blockNumber ?? 0n,
    });
  }
  return out;
}

/** Read SignalInvalidated logs for the agentId → the set of invalidated signalIds (D-30). */
export async function fetchInvalidatedIds(
  pub: PublicClient,
  sourceRegistry: Address,
  agentId: bigint,
  fromBlock: bigint,
  toBlock: bigint | 'latest',
): Promise<Set<string>> {
  const logs = await pub.getLogs({
    address: sourceRegistry,
    event: signalInvalidatedEvent,
    args: { agentId },
    fromBlock,
    toBlock,
  });
  const ids = new Set<string>();
  for (const log of logs) {
    const parsed = decodeEventLog({
      abi: sourceRegistryAbi,
      data: log.data,
      topics: log.topics as [Hex, ...Hex[]],
    });
    if (parsed.eventName !== 'SignalInvalidated') continue;
    const args = parsed.args as { signalId: bigint };
    ids.add(args.signalId.toString());
  }
  return ids;
}

/**
 * Fetch the operator EOA's settled swaps over the block range by decoding exactInputSingle calldata
 * on its transactions to the SwapRouter. A settled swap = a successful tx FROM the operator TO the
 * SwapRouter whose input decodes to exactInputSingle (we read tokenIn/tokenOut/amountIn from params).
 */
export async function fetchOperatorSwaps(
  pub: PublicClient,
  swapRouter: Address,
  operator: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<SettledSwap[]> {
  const out: SettledSwap[] = [];
  const routerLc = swapRouter.toLowerCase();
  const operatorLc = operator.toLowerCase();
  // Walk blocks in the range; for each, inspect txs to the router from the operator. (Range is small
  // on a Sepolia demo agent; for large ranges a log-based path would be used — see fetchOperatorSwaps note.)
  for (let b = fromBlock; b <= toBlock; b++) {
    const block = await pub.getBlock({ blockNumber: b, includeTransactions: true });
    for (const tx of block.transactions) {
      if (typeof tx === 'string') continue;
      if (!tx.to || tx.to.toLowerCase() !== routerLc) continue;
      if (tx.from.toLowerCase() !== operatorLc) continue;
      try {
        const { functionName, args } = decodeFunctionDataSafe(tx.input);
        if (functionName !== 'exactInputSingle') continue;
        const params = (args as readonly { tokenIn: Address; tokenOut: Address; amountIn: bigint }[])[0];
        if (!params) continue;
        // confirm the tx actually settled (receipt status === 'success').
        const receipt = await pub.getTransactionReceipt({ hash: tx.hash });
        if (receipt.status !== 'success') continue;
        out.push({
          tokenIn: getAddress(params.tokenIn),
          tokenOut: getAddress(params.tokenOut),
          amountIn: params.amountIn,
          swapBlock: b,
        });
      } catch {
        // not an exactInputSingle we model — skip.
      }
    }
  }
  return out;
}

/** Decode exactInputSingle calldata via the router ABI; throws if it does not match. */
function decodeFunctionDataSafe(input: Hex): { functionName: string; args: readonly unknown[] } {
  const decoded = decodeFunctionData({ abi: swapRouterAbi, data: input });
  return { functionName: decoded.functionName, args: decoded.args as readonly unknown[] };
}

// ---------------------------------------------------------------------------------------------
//  CLI ENTRY
// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const assertMode = process.argv.includes('--assert');

  // W3 fail-closed guard — refuse to reconcile against an unset agentId/registry (no silent no-op).
  const cfg = assertConfig();
  const pub = makePublicClient();
  const operator = operatorAccount(cfg.operatorKey).address;

  const fromBlock = BigInt(process.env.RECONCILE_FROM_BLOCK ?? '0');
  const latest = await pub.getBlockNumber();

  const [signals, invalidatedIds] = await Promise.all([
    fetchRecordedSignals(pub, cfg.sourceRegistry, cfg.agentId, fromBlock, latest),
    fetchInvalidatedIds(pub, cfg.sourceRegistry, cfg.agentId, fromBlock, latest),
  ]);
  const swaps = await fetchOperatorSwaps(pub, cfg.swapRouter, operator, fromBlock, latest);

  const report = classify(signals, invalidatedIds, swaps);

  // JSON report + per-signal table.
  console.log(JSON.stringify({ matched: report.matched, invalidated: report.invalidated, orphan: report.orphan, total: report.total, orderingViolations: report.orderingViolations }, null, 2));
  console.table(
    report.signals.map((s) => ({ signalId: s.signalId, class: s.class, orderingOk: s.orderingOk ?? '' })),
  );

  if (report.orderingViolations > 0) {
    console.warn({ event: 'ordering_anomaly', count: report.orderingViolations, note: 'matched swap block < recordSignal block (D-34 best-effort)' });
  }

  // --assert: exit NON-ZERO if any NON-invalidated signal is an orphan (the D-40 gate).
  if (assertMode) {
    if (report.orphan > 0) {
      console.error({ event: 'reconcile_assert_failed', orphan: report.orphan, note: 'non-invalidated signals with no settled swap (D-40 gate FAILED)' });
      process.exit(1);
    }
    console.log({ event: 'reconcile_assert_passed', orphan: 0, matched: report.matched, invalidated: report.invalidated });
  }
}

// Only run when executed directly (not when imported by the unit test).
if (isEntry(import.meta.url)) {
  main().catch((err) => {
    console.error({ event: 'reconcile_fatal', err: String(err) });
    process.exit(1);
  });
}
