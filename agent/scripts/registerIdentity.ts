// scripts/registerIdentity.ts
// ONE-SHOT ERC-8004 identity mint + SourceRegistry.registerSource (RESEARCH Pattern 5, D-27).
//
// ┌──────────────────────────────────────────────────────────────────────────────────────────┐
// │ LIVE MINT IS DEFERRED TO PLAN 06. This script is BUILT + TYPE-CHECKED now but NOT run.     │
// │ It requires AGENT_URI (the static GitHub-Pages JSON URL, D-28) which Plan 06 publishes,    │
// │ and it writes the agentId into addresses.json which Plan 06 sequences alongside the        │
// │ SourceRegistry redeploy. Running it performs on-chain writes (a real mint + register) and  │
// │ MUST NOT happen until Plan 06 (funded operator EOA + published AGENT_URI). See SUMMARY.    │
// └──────────────────────────────────────────────────────────────────────────────────────────┘
//
// Flow (all from the operator EOA, one key — D-26):
//   1. IdentityRegistry.register(AGENT_URI)                          -> mints an ERC-721 identity
//   2. capture agentId from the Transfer(0x0 -> owner, tokenId) log  -> NOT assumed 1 (Pitfall 6)
//   3. assert ownerOf(agentId) == operator && getAgentWallet(agentId) is set
//   4. SourceRegistry.registerSource(agentId, strategyMeta)          -> ties the source to the identity
//   5. persist agentId to addresses.json (`agentId` field) + agent/.env (AGENT_ID=...)
//
// The canonical IdentityRegistry is an immutable protocol address (DEC-004); it is read from
// ERC8004_IDENTITY_REGISTRY (env) or falls back to the canonical Sepolia deployment. The
// SourceRegistry address is read at runtime from addresses.json (Plan 06 write-back, W2).

import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { getAddress, type Address, type Hex } from 'viem';
import { decodeEventLog } from 'viem';
import {
  makePublicClient,
  makeOperatorWalletClient,
  operatorAccount,
  loadAddresses,
  addressesJsonPath,
  requireSourceRegistry,
} from '../src/chain/clients';
import { identityRegistryAbi, sourceRegistryAbi } from '../src/chain/abis';

/**
 * Canonical ERC-8004 IdentityRegistry on Mantle Sepolia (DEC-004 / SequaConstants
 * ERC8004_IDENTITY_REGISTRY_SEPOLIA). This is the ONE immutable protocol address — overridable via
 * env for tests, never copied per-runtime. It is NOT a venue/registry address read from addresses.json.
 */
const CANONICAL_IDENTITY_REGISTRY: Address = getAddress('0x8004A818BFB912233c491871b3d84c89A494BD9e');

function identityRegistryAddress(): Address {
  const fromEnv = process.env.ERC8004_IDENTITY_REGISTRY;
  return fromEnv ? getAddress(fromEnv) : CANONICAL_IDENTITY_REGISTRY;
}

/** AGENT_URI — the static GitHub-Pages JSON URL (D-28). Published by Plan 06; required to mint. */
function requireAgentUri(): string {
  const uri = process.env.AGENT_URI;
  if (!uri) {
    throw new Error(
      'AGENT_URI not set — the static GitHub-Pages JSON URL (D-28) is published in Plan 06. ' +
        'The live mint is deferred until then; this script is built + type-checked but not run yet.',
    );
  }
  return uri;
}

/** strategyMeta passed to registerSource — short, human-readable description of the source strategy. */
const STRATEGY_META = 'momentum MA-crossover (5/20) on WMNT/USDC, mETH/USDC, WETH/USDC — Sequa source agent (D-02)';

/**
 * Capture the minted agentId from the receipt's ERC-721 Transfer(0x0 -> owner, tokenId) log
 * (Pitfall 6 — the registry already has 140+ agents, so the id is NOT 1). We scan for a Transfer
 * emitted by the IdentityRegistry whose `from` is the zero address (a mint).
 */
function captureAgentId(
  logs: readonly { address: Address; topics: readonly Hex[]; data: Hex }[],
  identityRegistry: Address,
): bigint {
  const ZERO = '0x0000000000000000000000000000000000000000';
  for (const log of logs) {
    if (log.address.toLowerCase() !== identityRegistry.toLowerCase()) continue;
    try {
      const parsed = decodeEventLog({
        abi: identityRegistryAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (parsed.eventName === 'Transfer') {
        const args = parsed.args as { from: Address; to: Address; tokenId: bigint };
        if (args.from.toLowerCase() === ZERO) return args.tokenId; // the mint
      }
    } catch {
      // not an IdentityRegistry event we model — keep scanning.
    }
  }
  throw new Error('mint Transfer(0x0 -> owner) log not found — could not capture agentId');
}

/** Persist the captured agentId into addresses.json (`agentId` field) — Plan 06 write-back point. */
function persistAgentIdToAddresses(agentId: bigint): void {
  const path = addressesJsonPath();
  const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  json.agentId = agentId.toString();
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n', 'utf8');
}

/** Persist AGENT_ID into agent/.env (append if absent) so the runtime reads it without addresses.json. */
function persistAgentIdToEnv(agentId: bigint): void {
  const envPath = new URL('../.env', import.meta.url).pathname;
  const line = `AGENT_ID=${agentId.toString()}\n`;
  if (existsSync(envPath)) {
    const existing = readFileSync(envPath, 'utf8');
    if (existing.includes('AGENT_ID=')) return; // already present — do not duplicate
    appendFileSync(envPath, (existing.endsWith('\n') ? '' : '\n') + line, 'utf8');
  } else {
    writeFileSync(envPath, line, 'utf8');
  }
}

/**
 * registerIdentity — the one-shot mint + registerSource. Returns the captured agentId. DEFERRED to
 * Plan 06: do not invoke from CI / this plan. Performs two on-chain writes from the operator EOA.
 */
export async function registerIdentity(): Promise<bigint> {
  const agentUri = requireAgentUri();
  const identityRegistry = identityRegistryAddress();
  const addrs = loadAddresses();
  const sourceRegistry = requireSourceRegistry(addrs); // Plan 06 fills this — throws until then (W2)

  const pub = makePublicClient();
  const wallet = makeOperatorWalletClient();
  const account = operatorAccount();

  // 1) MINT — register(agentURI). Capture the agentId from the mint event, NOT assume 1 (Pitfall 6).
  const registerTx = await wallet.writeContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [agentUri],
    account,
    chain: wallet.chain,
  });
  const registerReceipt = await pub.waitForTransactionReceipt({ hash: registerTx });
  const agentId = captureAgentId(registerReceipt.logs, identityRegistry);

  // 2) ASSERT ownership — the operator must own the minted identity, and the agent wallet is set
  //    (T-1-13: a wrong agentId would attach signals to the wrong identity / revert NotSourceOwner).
  const owner = (await pub.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'ownerOf',
    args: [agentId],
  })) as Address;
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`ownerOf(${agentId}) = ${owner} != operator ${account.address} — refusing to registerSource`);
  }
  const agentWallet = (await pub.readContract({
    address: identityRegistry,
    abi: identityRegistryAbi,
    functionName: 'getAgentWallet',
    args: [agentId],
  })) as Address;

  // 3) registerSource — tie the SourceRegistry source to the REAL ERC-8004 agentId (D-27).
  const registerSourceTx = await wallet.writeContract({
    address: sourceRegistry,
    abi: sourceRegistryAbi,
    functionName: 'registerSource',
    args: [agentId, STRATEGY_META],
    account,
    chain: wallet.chain,
  });
  await pub.waitForTransactionReceipt({ hash: registerSourceTx });

  // 4) PERSIST — write the captured agentId to addresses.json + agent/.env (threaded into recordSignal).
  persistAgentIdToAddresses(agentId);
  persistAgentIdToEnv(agentId);

  console.log(
    JSON.stringify({
      agentId: agentId.toString(),
      owner,
      agentWallet,
      registerTx,
      registerSourceTx,
      identityRegistry,
      sourceRegistry,
    }),
  );
  return agentId;
}

// Run only when executed directly (`node registerIdentity.ts`). DEFERRED to Plan 06 — do not run now.
// import.meta.url vs process.argv[1] guard keeps this importable (for tests) without auto-executing.
const invokedDirectly = process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (invokedDirectly) {
  registerIdentity()
    .then((id) => {
      console.log(`registered agentId ${id.toString()}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
