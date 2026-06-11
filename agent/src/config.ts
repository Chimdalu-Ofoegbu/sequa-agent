// config.ts
// The agent's single configuration surface: strategy constants + the FAIL-CLOSED runtime guard.
//
// W3 FAIL-CLOSED GUARD (the load-bearing safety check, Pitfall 6 / T-1-13):
//   `assertConfig()` THROWS at boot if ANY required on-chain value is unset, empty, or the zero
//   value — agentId (a POSITIVE integer, never 0/undefined/placeholder), sourceRegistry, swapRouter,
//   quoterV2, and each of the 4 token addresses (non-zero 0x), plus OPERATOR_PRIVATE_KEY. It is
//   invoked at the TOP of index.ts, reconcile.ts and noiseBot.ts before any chain call. This is what
//   stops a misconfigured boot from calling recordSignal with agentId 0/undefined → a silent
//   `NotSourceOwner` revert. A missing value is a LOUD crash here, never a silent wrong-address swap.
//
// dotenv is loaded here (the one place) so every entry point that imports config gets .env populated.
// Strategy constants live here (the single source of truth) so the poll loop, the cooldown/cap
// enforcement, and the buy sizing all read the same locked numbers (D-06/D-10/D-16/D-07).

import 'dotenv/config';
import { isAddress, getAddress, zeroAddress, type Address } from 'viem';
import {
  loadAddresses,
  requireOperatorKey,
  type RuntimeAddresses,
} from './chain/clients';
import { PAIRS, type Pair } from './signals/types';

// ---------------------------------------------------------------------------------------------
//  Strategy constants — LOCKED single source of truth (D-03/D-06/D-07/D-10/D-16).
// ---------------------------------------------------------------------------------------------

/** 30s poll cadence (D-04). The loop quotes + decides once per this interval. */
export const POLL_MS = 30_000;

/** Short MA window in ticks (D-03). */
export const SHORT_WINDOW = 5;

/** Long MA window in ticks (D-03). */
export const LONG_WINDOW = 20;

/**
 * Per-pair cooldown after a recorded signal on that pair (D-06: ~3–5 min). 240_000 ms = 4 min — the
 * midpoint of the band. Prevents whipsaw flapping + keeps the timeline readable + gives Phase 2
 * deterministic signal spacing.
 */
export const COOLDOWN_MS = 240_000;

/** Daily soft cap across all 3 pairs (D-10): a runaway guard on top of the per-pair cooldown. */
export const DAILY_SOFT_CAP = 20;

/** Fixed-fraction of available USDC committed per BUY (D-07, within the 25–33% band). */
export const BUY_FRACTION = 0.3;

/** Minimum USDC available for a BUY; below this the BUY is skipped (D-13). */
export const MIN_USDC = 100;

/** The canonical D-16 serial pair order [WMNT, mETH, WETH]. Re-exported from the shared types. */
export const PAIR_ORDER: readonly Pair[] = PAIRS;

/** Capacity of each per-pair price-series ring buffer (≥ longWindow + headroom for replay). */
export const PRICE_BUFFER_CAPACITY = 256;

/** /healthz HTTP port (D-38). Overridable via HEALTH_PORT for the host. */
export const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 8080);

/** One probe-unit per pair for the spot quote (base-token decimals); 1 base token in → USDC out. */
export const QUOTE_PROBE_UNITS = 1;

// ---------------------------------------------------------------------------------------------
//  The fail-closed runtime guard (W3).
// ---------------------------------------------------------------------------------------------

/** The resolved, validated runtime config the entry points consume after assertConfig() passes. */
export interface AgentConfig {
  addrs: RuntimeAddresses;
  sourceRegistry: Address;
  swapRouter: Address;
  quoterV2: Address;
  agentId: bigint;
  fee: number;
  tokens: { usdc: Address; wmnt: Address; meth: Address; weth: Address };
  operatorKey: `0x${string}`;
}

/** A non-zero, well-formed 0x address. Throws (fail-closed) on undefined/empty/zero/malformed. */
function requireNonZeroAddress(label: string, value: string | undefined): Address {
  if (!value || value.length === 0) {
    throw new Error(`assertConfig: required address "${label}" is unset/empty (fail-closed, W3).`);
  }
  if (!isAddress(value)) {
    throw new Error(`assertConfig: "${label}" = "${value}" is not a valid 0x address (fail-closed, W3).`);
  }
  const checksummed = getAddress(value);
  if (checksummed === zeroAddress) {
    throw new Error(`assertConfig: "${label}" is the zero address (fail-closed, W3 — refuse to boot).`);
  }
  return checksummed;
}

/**
 * assertConfig — the FAIL-CLOSED boot guard (W3). Validates every required on-chain value and the
 * operator key, THROWS on any missing/zero/placeholder, and returns the resolved AgentConfig. Call
 * this at the TOP of index.ts / reconcile.ts / noiseBot.ts before constructing any chain context.
 *
 * Specifically rejects:
 *   - agentId of undefined / 0 / non-positive / non-integer  → no silent NotSourceOwner (Pitfall 6).
 *   - sourceRegistry / swapRouter / quoterV2 unset or zero    → no swap against a dead address.
 *   - any of the 4 token addresses unset or zero.
 *   - OPERATOR_PRIVATE_KEY unset                              → cannot sign.
 */
export function assertConfig(addressesOverride?: RuntimeAddresses): AgentConfig {
  const addrs = addressesOverride ?? loadAddresses();

  // --- agentId: a POSITIVE INTEGER, never 0/undefined/placeholder (Pitfall 6, T-1-13) ---
  if (addrs.agentId === undefined || addrs.agentId === null || String(addrs.agentId).length === 0) {
    throw new Error(
      'assertConfig: `agentId` is unset in addresses.json — registerIdentity.ts (Plan 06) mints the ' +
        'ERC-8004 identity and persists the agentId captured from the mint event. Refusing to call ' +
        'recordSignal with an undefined agentId (silent NotSourceOwner revert, W3/T-1-13).',
    );
  }
  let agentId: bigint;
  try {
    agentId = BigInt(String(addrs.agentId));
  } catch {
    throw new Error(`assertConfig: \`agentId\` = "${addrs.agentId}" is not an integer (fail-closed, W3).`);
  }
  if (agentId <= 0n) {
    throw new Error(
      `assertConfig: \`agentId\` = ${agentId.toString()} must be a POSITIVE integer (0/negative is the ` +
        'placeholder — the real ERC-8004 mint returns 137+, never 0; W3/Pitfall 6).',
    );
  }

  // --- venues + registry: well-formed, non-zero 0x addresses ---
  const sourceRegistry = requireNonZeroAddress('sourceRegistry', addrs.sourceRegistry);
  const swapRouter = requireNonZeroAddress('swapRouter', addrs.venue?.swapRouter);
  const quoterV2 = requireNonZeroAddress('quoterV2', addrs.venue?.quoterV2);

  // --- each of the 4 token addresses: non-zero 0x ---
  const usdc = requireNonZeroAddress('tokens.usdc', addrs.tokens?.usdc);
  const wmnt = requireNonZeroAddress('tokens.wmnt', addrs.tokens?.wmnt);
  const meth = requireNonZeroAddress('tokens.meth', addrs.tokens?.meth);
  const weth = requireNonZeroAddress('tokens.weth', addrs.tokens?.weth);

  // --- fee tier (non-zero) ---
  const fee = Number(addrs.fee);
  if (!Number.isInteger(fee) || fee <= 0) {
    throw new Error(`assertConfig: \`fee\` = "${addrs.fee}" must be a positive integer tier (fail-closed, W3).`);
  }

  // --- operator key: present (signs recordSignal + swaps) ---
  const operatorKey = requireOperatorKey(); // throws if OPERATOR_PRIVATE_KEY is unset (clients.ts)

  return {
    addrs,
    sourceRegistry,
    swapRouter,
    quoterV2,
    agentId,
    fee,
    tokens: { usdc, wmnt, meth, weth },
    operatorKey,
  };
}

/** Map a pair to its (tokenIn-for-quoting) base token address, given the resolved token set. */
export function baseTokenAddress(pair: Pair, tokens: AgentConfig['tokens']): Address {
  switch (pair) {
    case 'WMNT/USDC':
      return tokens.wmnt;
    case 'mETH/USDC':
      return tokens.meth;
    case 'WETH/USDC':
      return tokens.weth;
    default: {
      // exhaustive — PAIRS is a closed union
      const _never: never = pair;
      throw new Error(`baseTokenAddress: unknown pair ${String(_never)}`);
    }
  }
}
