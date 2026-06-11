// chain/clients.ts
// viem clients + the SINGLE runtime address source for the chain layer.
//
// W2 / D-43 discipline: every venue + registry address is read AT RUNTIME from the repo-root
// addresses.json (Plan 01 write-back; Plan 06 fills `sourceRegistry`; registerIdentity.ts fills
// `agentId`). NOTHING in this layer hard-codes a deployed address — see the grep gate in the plan
// (`grep -nE "0x[a-fA-F0-9]{40}" recordSignal.ts` must be empty). The ERC-8004 IdentityRegistry is
// the one canonical, immutable protocol address (DEC-004), so it is read from env-or-default in
// registerIdentity.ts, never baked into the hot path.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  getAddress,
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** Mantle Sepolia (chain 5003) — the Phase 1 venue (D-41, Sepolia-only). */
export const MANTLE_SEPOLIA_RPC = 'https://rpc.sepolia.mantle.xyz';

export const mantleSepolia = defineChain({
  id: 5003,
  name: 'Mantle Sepolia',
  nativeCurrency: { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  rpcUrls: { default: { http: [MANTLE_SEPOLIA_RPC] } },
  testnet: true,
});

/** The 4 mock tokens + their decimals (addresses.json shape, Plan 01). */
export interface TokenAddresses {
  usdc: Address;
  wmnt: Address;
  meth: Address;
  weth: Address;
}

/** The self-deployed UniV3 fork venue (addresses.json `venue`, Plan 01 / D-43). */
export interface VenueAddresses {
  factory: Address;
  swapRouter: Address;
  quoterV2: Address;
  nonfungiblePositionManager: Address;
}

/**
 * RuntimeAddresses — the parsed, checksummed view of addresses.json the chain layer consumes.
 * `sourceRegistry` and `agentId` are OPTIONAL here: Plan 06 writes the redeployed `sourceRegistry`
 * and registerIdentity.ts writes `agentId` at mint time. A consumer that needs them calls
 * requireSourceRegistry() / requireAgentId(), which throw a clear error if not yet populated —
 * NEVER a silent fallback to a stale dev address (W2).
 */
export interface RuntimeAddresses {
  chainId: number;
  venue: VenueAddresses;
  tokens: TokenAddresses;
  fee: number;
  decimals: { usdc: number; wmnt: number; meth: number; weth: number };
  /** Filled by Plan 06's SourceRegistry redeploy write-back. */
  sourceRegistry?: Address;
  /** Filled by registerIdentity.ts at ERC-8004 mint time (NOT 1 — Pitfall 6). */
  agentId?: string;
}

/** Locate the repo-root addresses.json relative to this module (agent/src/chain → repo root). */
export function addressesJsonPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // agent/src/chain  ->  ../../..  -> repo root
  return resolve(here, '..', '..', '..', 'addresses.json');
}

/** Read + checksum-normalize addresses.json once. Throws if the file or a required field is absent. */
export function loadAddresses(path: string = addressesJsonPath()): RuntimeAddresses {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const venue = raw.venue as Record<string, string> | undefined;
  const tokens = raw.tokens as Record<string, string> | undefined;
  if (!venue || !tokens) throw new Error(`addresses.json missing venue/tokens (read ${path})`);

  const out: RuntimeAddresses = {
    chainId: Number(raw.chainId),
    venue: {
      factory: getAddress(venue.factory!),
      swapRouter: getAddress(venue.swapRouter!),
      quoterV2: getAddress(venue.quoterV2!),
      nonfungiblePositionManager: getAddress(venue.nonfungiblePositionManager!),
    },
    tokens: {
      usdc: getAddress(tokens.usdc!),
      wmnt: getAddress(tokens.wmnt!),
      meth: getAddress(tokens.meth!),
      weth: getAddress(tokens.weth!),
    },
    fee: Number(raw.fee),
    decimals: raw.decimals as RuntimeAddresses['decimals'],
  };
  if (typeof raw.sourceRegistry === 'string' && raw.sourceRegistry.length > 0) {
    out.sourceRegistry = getAddress(raw.sourceRegistry);
  }
  if (raw.agentId !== undefined && raw.agentId !== null) {
    out.agentId = String(raw.agentId);
  }
  return out;
}

/**
 * The SourceRegistry address — read at runtime from addresses.json (W2). Throws (never falls back
 * to a hard-coded dev address) if Plan 06 has not yet written it. This is the function the hot path
 * uses so no literal address ever appears in recordSignal.ts.
 */
export function requireSourceRegistry(addrs: RuntimeAddresses): Address {
  if (!addrs.sourceRegistry) {
    throw new Error(
      'addresses.json has no `sourceRegistry` yet — Plan 06 redeploys SourceRegistry and writes its address. ' +
        'The hot path reads it at runtime; refusing to use any hard-coded throwaway address (W2).',
    );
  }
  return addrs.sourceRegistry;
}

/** The ERC-8004 agentId — read at runtime from addresses.json (persisted by registerIdentity.ts). */
export function requireAgentId(addrs: RuntimeAddresses): bigint {
  if (addrs.agentId === undefined) {
    throw new Error(
      'addresses.json has no `agentId` yet — registerIdentity.ts mints the ERC-8004 identity and ' +
        'persists the agentId captured from the mint event (NOT 1 — Pitfall 6).',
    );
  }
  return BigInt(addrs.agentId);
}

/** A read-only public client (quotes, receipts, log reads) on Mantle Sepolia. */
export function makePublicClient(rpcUrl: string = MANTLE_SEPOLIA_RPC): PublicClient {
  return createPublicClient({ chain: mantleSepolia, transport: http(rpcUrl) });
}

/**
 * A wallet client signing from the operator EOA (D-26). The key is read from OPERATOR_PRIVATE_KEY
 * (gitignored .env, T-1-01) ONLY when this is called — module import never reads secrets, so the
 * offline test/eval gates load this file without a key present.
 */
export function makeOperatorWalletClient(
  privateKey: `0x${string}` = requireOperatorKey(),
  rpcUrl: string = MANTLE_SEPOLIA_RPC,
): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: mantleSepolia, transport: http(rpcUrl) });
}

/** The operator account (address + signer) derived from OPERATOR_PRIVATE_KEY. */
export function operatorAccount(privateKey: `0x${string}` = requireOperatorKey()) {
  return privateKeyToAccount(privateKey);
}

/** Read OPERATOR_PRIVATE_KEY from the environment, normalizing the 0x prefix. Throws if absent. */
export function requireOperatorKey(): `0x${string}` {
  const raw = process.env.OPERATOR_PRIVATE_KEY;
  if (!raw) throw new Error('OPERATOR_PRIVATE_KEY not set (gitignored .env, D-26).');
  const hex = raw.startsWith('0x') ? raw : `0x${raw}`;
  return hex as `0x${string}`;
}
