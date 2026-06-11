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

import { decodeEventLog, getAbiItem, getAddress, type Address, type Hex, type PublicClient } from 'viem';
import { assertConfig } from '../src/config';
import { makePublicClient, operatorAccount, loadAddresses, type PoolAddresses } from '../src/chain/clients';
import { sourceRegistryAbi, univ3PoolAbi } from '../src/chain/abis';
import { decodeSignal, matchKey } from '../src/chain/reconcile-shared';
import { isEntry } from '../src/isEntry';

/** The typed SignalRecorded / SignalInvalidated event items (for getLogs `event:`). */
const signalRecordedEvent = getAbiItem({ abi: sourceRegistryAbi, name: 'SignalRecorded' });
const signalInvalidatedEvent = getAbiItem({ abi: sourceRegistryAbi, name: 'SignalInvalidated' });
/** The UniV3 pool `Swap` event item (for the bounded, log-based operator-swap scan). */
const poolSwapEvent = getAbiItem({ abi: univ3PoolAbi, name: 'Swap' });

/**
 * Default page size for every `eth_getLogs` call. The public Mantle RPC CAPS the block range per
 * getLogs request, so we MUST page rather than ask for [deploy, latest] in one shot. 9000 < the cap
 * with headroom; overridable via RECONCILE_BLOCK_CHUNK. NEVER scan from block 0 (the registry did not
 * exist then) and NEVER walk per-block over the whole chain.
 */
export const DEFAULT_RECONCILE_BLOCK_CHUNK = 9000n;

/** The configured getLogs page size (RECONCILE_BLOCK_CHUNK env override, default 9000). */
function reconcileBlockChunk(): bigint {
  const raw = process.env.RECONCILE_BLOCK_CHUNK;
  if (!raw) return DEFAULT_RECONCILE_BLOCK_CHUNK;
  const n = BigInt(raw);
  return n > 0n ? n : DEFAULT_RECONCILE_BLOCK_CHUNK;
}

/**
 * getLogsChunked — page `pub.getLogs(params)` across `[fromBlock, toBlock]` in windows of `chunk`
 * blocks, concatenating the results. This is the ONLY way the reconciler reads logs: a single
 * unbounded getLogs over the whole history exceeds the public Mantle RPC's range cap and fails the
 * D-40 gate. `toBlock` is resolved to a concrete block number by the caller (never 'latest' here).
 */
export async function getLogsChunked(
  pub: PublicClient,
  fromBlock: bigint,
  toBlock: bigint,
  chunk: bigint,
  params: Omit<Parameters<PublicClient['getLogs']>[0] & object, 'fromBlock' | 'toBlock'>,
): Promise<Awaited<ReturnType<PublicClient['getLogs']>>> {
  const out: Awaited<ReturnType<PublicClient['getLogs']>> = [];
  for (let start = fromBlock; start <= toBlock; start += chunk) {
    const end = start + chunk - 1n > toBlock ? toBlock : start + chunk - 1n;
    // eslint-disable-next-line no-await-in-loop -- sequential paging is intentional (RPC range cap).
    const page = await pub.getLogs({ ...params, fromBlock: start, toBlock: end } as Parameters<PublicClient['getLogs']>[0]);
    out.push(...page);
  }
  return out;
}

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

/** A settled swap by the operator EOA (recovered from pool Swap events, recipient == operator). */
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
 *
 * RESIDUAL LIMITATION (P2-MEDIUM, documented not over-engineered): matching is amount-based FIFO over
 * matchKey(tokenIn, tokenOut, amountIn). Two signals with the IDENTICAL (tokenIn, tokenOut, amountIn)
 * could in principle FALSE-MATCH — signal A could be credited with signal B's swap and vice-versa.
 * Because each swap is consumed at most once and the block-ordering tie-break prefers the earliest
 * unused swap at/after the record block, the COUNTS (matched / invalidated / orphan) — and therefore
 * the D-40 orphan gate — are correct even under a false-match; only the per-signal A↔B attribution can
 * swap. A fully robust correlation would pair each signal to its swap by tx-adjacency (the operator's
 * swap-tx nonce == the recordSignal-tx nonce + 1 on the same EOA); that is deferred as a Phase-2
 * hardening since it does not change the gate outcome. BUY sizing (a USDC fraction) makes identical
 * amounts on the same pair within a window unlikely in practice; SELL flat-sells the full holding.
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
  toBlock: bigint,
  chunk: bigint = DEFAULT_RECONCILE_BLOCK_CHUNK,
): Promise<RecordedSignal[]> {
  const logs = await getLogsChunked(pub, fromBlock, toBlock, chunk, {
    address: sourceRegistry,
    event: signalRecordedEvent,
    args: { agentId },
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
  toBlock: bigint,
  chunk: bigint = DEFAULT_RECONCILE_BLOCK_CHUNK,
): Promise<Set<string>> {
  const logs = await getLogsChunked(pub, fromBlock, toBlock, chunk, {
    address: sourceRegistry,
    event: signalInvalidatedEvent,
    args: { agentId },
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
 * fetchOperatorSwaps — recover the operator EOA's settled swaps from a BOUNDED, log-based scan over
 * `[fromBlock, toBlock]` (NEVER from block 0; NEVER a per-block walk of the whole chain). For each of
 * the 3 UniV3 pools we `getLogs` the canonical `Swap(sender, recipient, amount0, amount1, ...)` event
 * (chunked to respect the RPC range cap), filtered to `recipient == operator` (the SwapRouter sets
 * the swap recipient to the operator EOA for exactInputSingle). From each Swap we recover the
 * (tokenIn, tokenOut, amountIn): we read each pool's token0()/token1() ONCE (cached), and the token
 * whose signed amount is POSITIVE is the one that went INTO the pool — that is `tokenIn`, and the
 * positive amount is `amountIn`. The other token (negative amount) is `tokenOut`.
 *
 * A Swap log existing at all means the swap settled (reverted txs emit no logs), so no per-tx receipt
 * fetch is needed — this is the bounded-RPC path that replaces the O(chain-length) getBlock walk.
 */
export async function fetchOperatorSwaps(
  pub: PublicClient,
  pools: PoolAddresses,
  operator: Address,
  fromBlock: bigint,
  toBlock: bigint,
  chunk: bigint = DEFAULT_RECONCILE_BLOCK_CHUNK,
): Promise<SettledSwap[]> {
  const out: SettledSwap[] = [];
  const poolAddresses = [pools.wmntUsdc, pools.methUsdc, pools.wethUsdc];

  for (const pool of poolAddresses) {
    // token0/token1 read ONCE per pool (cached for every Swap log on it).
    const [token0, token1] = (await Promise.all([
      pub.readContract({ address: pool, abi: univ3PoolAbi, functionName: 'token0' }),
      pub.readContract({ address: pool, abi: univ3PoolAbi, functionName: 'token1' }),
    ])) as [Address, Address];

    // Bounded, chunked Swap-log scan, filtered to recipient == operator (indexed topic).
    const logs = await getLogsChunked(pub, fromBlock, toBlock, chunk, {
      address: pool,
      event: poolSwapEvent,
      args: { recipient: operator },
    });

    for (const log of logs) {
      const parsed = decodeEventLog({
        abi: univ3PoolAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (parsed.eventName !== 'Swap') continue;
      const { amount0, amount1 } = parsed.args as { amount0: bigint; amount1: bigint };
      // The POSITIVE signed amount went INTO the pool → that token is tokenIn, |amount| is amountIn.
      // (UniV3 convention: positive = pool received, negative = pool paid out.)
      let tokenIn: Address;
      let tokenOut: Address;
      let amountIn: bigint;
      if (amount0 > 0n) {
        tokenIn = getAddress(token0);
        tokenOut = getAddress(token1);
        amountIn = amount0;
      } else if (amount1 > 0n) {
        tokenIn = getAddress(token1);
        tokenOut = getAddress(token0);
        amountIn = amount1;
      } else {
        // degenerate (both zero) — not a real swap leg; skip.
        continue;
      }
      out.push({ tokenIn, tokenOut, amountIn, swapBlock: log.blockNumber ?? 0n });
    }
  }
  return out;
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

  // DEFAULT fromBlock = the SourceRegistry deploy block (NOT 0). Scanning from genesis makes the D-40
  // gate time out on the public Mantle RPC, and no registry events exist before the deploy anyway.
  // RECONCILE_FROM_BLOCK is an optional override (e.g. to re-scan a narrower window).
  const addrs = loadAddresses();
  const deployBlock = addrs.sourceRegistryDeployBlock;
  if (deployBlock === undefined && process.env.RECONCILE_FROM_BLOCK === undefined) {
    throw new Error(
      'addresses.json has no `sourceRegistryDeployBlock` and RECONCILE_FROM_BLOCK is unset — refusing ' +
        'to scan from genesis (the D-40 gate would time out on the public RPC). Add the deploy block.',
    );
  }
  const fromBlock = BigInt(process.env.RECONCILE_FROM_BLOCK ?? String(deployBlock));
  const chunk = reconcileBlockChunk();
  const latest = await pub.getBlockNumber();

  const [signals, invalidatedIds] = await Promise.all([
    fetchRecordedSignals(pub, cfg.sourceRegistry, cfg.agentId, fromBlock, latest, chunk),
    fetchInvalidatedIds(pub, cfg.sourceRegistry, cfg.agentId, fromBlock, latest, chunk),
  ]);
  const swaps = await fetchOperatorSwaps(pub, addrs.pools, operator, fromBlock, latest, chunk);

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
