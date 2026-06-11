// scripts/noiseBot.ts — THE AMBIENT NOISE BOT (D-24).
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
//  A SEPARATE process on a SEPARATE EOA (NOISE_BOT_PRIVATE_KEY) whose only job is to nudge the pool
//  prices so the source agent's momentum MAs actually cross organically. It does REAL exactInputSingle
//  swaps with random small amounts on a random pair every 1–3 min. It is PURE MARKET UTILITY:
//
//    • it uses its OWN key (NOISE_BOT_PRIVATE_KEY) — NOT the operator — so it is kept entirely OUT of
//      the agent's on-chain track record (D-24).
//    • it NEVER writes to the SourceRegistry (it does not record or invalidate any signal). The
//      grep gate confirms zero registry-write calls in this file. It is not a signal source; its
//      swaps are noise, not part of the verifiable history.
//    • randomness (Math.random) drives the pair, the amount (~0.5–2% of pool depth), and the interval.
//
//  Mints itself tokens via the public MockERC20 mint at startup if a balance is low (D-17 testnet
//  faucet). Sepolia-only (D-41); the mock tokens have zero real value.
//
//  NOISE_BOT_PRIVATE_KEY is added to .env in Plan 06 (hosting). This script reads it at RUNTIME — the
//  build only needs it to type-check, not to run.
// ════════════════════════════════════════════════════════════════════════════════════════════════

import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  mantleSepolia,
  MANTLE_SEPOLIA_RPC,
  loadAddresses,
} from '../src/chain/clients';
import { swapRouterAbi, erc20Abi } from '../src/chain/abis';
import { isEntry } from '../src/isEntry';

/** MockERC20.mint(address,uint256) — the public testnet faucet (D-17). Not part of erc20Abi. */
const mockErc20MintAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

/** Read the dedicated NOISE bot key (a SEPARATE EOA from the operator — D-24). Throws if unset. */
function requireNoiseKey(): `0x${string}` {
  const raw = process.env.NOISE_BOT_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      'NOISE_BOT_PRIVATE_KEY not set — the noise bot uses its OWN EOA, separate from the operator ' +
        '(D-24), so its swaps stay out of the agent track record. Added to .env in Plan 06 (hosting).',
    );
  }
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`;
}

/** A swap leg: spend `tokenIn` for `tokenOut` at the venue fee tier. */
interface NoiseLeg {
  tokenIn: Address;
  tokenOut: Address;
  tokenInDecimals: number;
  /** human-readable base amount before the random multiplier (e.g. 50 USDC nominal). */
  nominal: number;
  label: string;
}

const SWAP_DEADLINE_BUFFER_SECONDS = 120;
const MAX_UINT256 = 2n ** 256n - 1n;

/** Pick a uniformly-random element. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** A random delay between 1 and 3 minutes (D-24 cadence). */
function randomIntervalMs(): number {
  const min = 60_000;
  const max = 180_000;
  return Math.floor(min + Math.random() * (max - min));
}

/** A random multiplier in [0.5, 2.0] applied to the nominal amount (≈0.5–2% of pool depth, D-24). */
function randomAmountMultiplier(): number {
  return 0.5 + Math.random() * 1.5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function main(): Promise<void> {
  const addrs = loadAddresses();
  const key = requireNoiseKey();
  const account = privateKeyToAccount(key);

  const pub = createPublicClient({ chain: mantleSepolia, transport: http(MANTLE_SEPOLIA_RPC) });
  const wallet = createWalletClient({ account, chain: mantleSepolia, transport: http(MANTLE_SEPOLIA_RPC) });

  const { usdc, wmnt, meth, weth } = addrs.tokens;
  const dec = addrs.decimals;
  const swapRouter = addrs.venue.swapRouter;
  const fee = addrs.fee;

  // The noise legs: both directions of each pair so swaps push prices up AND down (MAs cross both ways).
  const legs: NoiseLeg[] = [
    { tokenIn: usdc, tokenOut: wmnt, tokenInDecimals: dec.usdc, nominal: 30, label: 'USDC->WMNT' },
    { tokenIn: wmnt, tokenOut: usdc, tokenInDecimals: dec.wmnt, nominal: 50, label: 'WMNT->USDC' },
    { tokenIn: usdc, tokenOut: meth, tokenInDecimals: dec.usdc, nominal: 60, label: 'USDC->mETH' },
    { tokenIn: meth, tokenOut: usdc, tokenInDecimals: dec.meth, nominal: 0.02, label: 'mETH->USDC' },
    { tokenIn: usdc, tokenOut: weth, tokenInDecimals: dec.usdc, nominal: 60, label: 'USDC->WETH' },
    { tokenIn: weth, tokenOut: usdc, tokenInDecimals: dec.weth, nominal: 0.02, label: 'WETH->USDC' },
  ];

  // Startup: top up balances via the public MockERC20 mint (D-17) + max-approve the router once.
  await ensureBalancesAndApprovals(pub, wallet, account.address, swapRouter, [
    { token: usdc, decimals: dec.usdc, mintAmount: 1_000_000 },
    { token: wmnt, decimals: dec.wmnt, mintAmount: 1_000_000 },
    { token: meth, decimals: dec.meth, mintAmount: 1_000 },
    { token: weth, decimals: dec.weth, mintAmount: 1_000 },
  ]);

  console.log({ event: 'noise_bot_boot', bot: account.address, legs: legs.length });

  // The ambient loop: random leg, random amount, random interval. Forever. A failed swap is logged
  // and skipped (the next tick re-randomizes) — one revert never kills the bot.
  for (;;) {
    const leg = pick(legs);
    const amount = leg.nominal * randomAmountMultiplier();
    const amountIn = parseUnits(amount.toFixed(leg.tokenInDecimals === 6 ? 6 : 8), leg.tokenInDecimals);

    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_BUFFER_SECONDS);
      const hash = await wallet.writeContract({
        address: swapRouter,
        abi: swapRouterAbi,
        functionName: 'exactInputSingle',
        args: [
          {
            tokenIn: leg.tokenIn,
            tokenOut: leg.tokenOut,
            fee,
            recipient: account.address,
            deadline,
            amountIn,
            amountOutMinimum: 0n, // noise: accept any output (utility swap, not a tracked trade)
            sqrtPriceLimitX96: 0n,
          },
        ],
        account,
        chain: wallet.chain,
      });
      await pub.waitForTransactionReceipt({ hash });
      console.log({ event: 'noise_swap', leg: leg.label, amountIn: amountIn.toString(), tx: hash });
    } catch (err) {
      console.warn({ event: 'noise_swap_failed', leg: leg.label, err: String(err) });
    }

    await sleep(randomIntervalMs());
  }
}

/** Mint tokens to the bot if its balance is below the target, then max-approve the router once. */
async function ensureBalancesAndApprovals(
  pub: ReturnType<typeof createPublicClient>,
  wallet: ReturnType<typeof createWalletClient>,
  owner: Address,
  swapRouter: Address,
  tokens: { token: Address; decimals: number; mintAmount: number }[],
): Promise<void> {
  const account = privateKeyToAccount(requireNoiseKey());
  for (const { token, decimals, mintAmount } of tokens) {
    const balance = (await pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [owner],
    })) as bigint;

    const target = parseUnits(String(mintAmount), decimals);
    if (balance < target / 10n) {
      // low balance → mint a fresh batch via the public MockERC20 faucet (D-17).
      const mintTx = await wallet.writeContract({
        address: token,
        abi: mockErc20MintAbi,
        functionName: 'mint',
        args: [owner, target],
        account,
        chain: wallet.chain,
      });
      await pub.waitForTransactionReceipt({ hash: mintTx });
      console.log({ event: 'noise_mint', token, amount: target.toString() });
    }

    // one-time max approve to the router (idempotent — skip if already maxed).
    const allowance = (await pub.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [owner, swapRouter],
    })) as bigint;
    if (allowance < MAX_UINT256) {
      const approveTx = await wallet.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [swapRouter, MAX_UINT256],
        account,
        chain: wallet.chain,
      });
      await pub.waitForTransactionReceipt({ hash: approveTx });
    }
  }
}

// Only run when executed directly (not when imported).
if (isEntry(import.meta.url)) {
  main().catch((err) => {
    console.error({ event: 'noise_bot_fatal', err: String(err) });
    process.exit(1);
  });
}
