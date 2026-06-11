// chain/abis.ts
// Minimal viem-typed ABIs for the chain layer. Each surface is trimmed to exactly the members the
// runtime calls, mirroring the deployed contracts:
//   - SourceRegistry: the Plan 02 redeploy surface (recordSignal/invalidateSignal/signalAt/performance
//     + SignalRecorded/SignalDecoded/SignalInvalidated events) — selectors/topics in 01-02-SUMMARY.
//   - SwapRouter: UniV3 exactInputSingle, the 8-FIELD ExactInputSingleParams struct WITH `deadline`
//     (selector 0x414bf389) — DISTINCT from the 5-field signal tuple (RESEARCH Pattern 3).
//   - QuoterV2: quoteExactInputSingle — NON-VIEW, must be simulateContract'd (RESEARCH Pitfall 2).
//   - IdentityRegistry: ERC-8004 register/ownerOf/getAgentWallet + the ERC-721 Transfer event the
//     agentId is captured from (RESEARCH Pattern 5 / Pitfall 6).
//   - ERC20: approve/allowance/balanceOf/decimals for the one-time max-approve (D-29).
//
// `as const` keeps these literal so viem infers exact arg/return types end-to-end.

/** SourceRegistry — the Plan 02 redeployed surface (01-02-SUMMARY ABI table). */
export const sourceRegistryAbi = [
  {
    type: 'function',
    name: 'registerSource',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'strategyMeta', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'recordSignal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'signal', type: 'bytes' },
    ],
    outputs: [{ name: 'signalId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'invalidateSignal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'signalId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'signalAt',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'signalId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'invalidated',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'signalId', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'performance',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [
      { name: 'signalCount', type: 'uint256' },
      { name: 'lastSignalAt', type: 'uint64' },
    ],
  },
  {
    type: 'event',
    name: 'SourceRegistered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'strategyMeta', type: 'string', indexed: false },
    ],
    anonymous: false,
  },
  {
    // topic0 0x7891497d… — UNCHANGED from Phase 0 (01-02-SUMMARY; RESEARCH A4 listener stability).
    type: 'event',
    name: 'SignalRecorded',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'signalId', type: 'uint256', indexed: true },
      { name: 'signal', type: 'bytes', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SignalDecoded',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'signalId', type: 'uint256', indexed: true },
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'address', indexed: false },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'minAmountOut', type: 'uint256', indexed: false },
      { name: 'fee', type: 'uint24', indexed: false },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'SignalInvalidated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'signalId', type: 'uint256', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint64', indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * SwapRouter.exactInputSingle — the 8-FIELD UniV3 ExactInputSingleParams struct WITH `deadline`
 * (selector 0x414bf389, RESEARCH Pattern 3 / Assumption A3). The runtime DERIVES this struct from
 * the 5-field signal tuple at call time; the two are intentionally different shapes.
 */
export const swapRouterAbi = [
  {
    type: 'function',
    name: 'exactInputSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

/**
 * QuoterV2.quoteExactInputSingle — NON-VIEW (selector 0xc6a5026a). It reverts internally and decodes
 * the revert, so it MUST be called via simulateContract / callStatic, never readContract (Pitfall 2).
 */
export const quoterV2Abi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const;

/** ERC-8004 IdentityRegistry (DEC-004 / IIdentityRegistry.sol) + the ERC-721 Transfer event. */
export const identityRegistryAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    // ERC-721 mint surfaces as Transfer(0x0 -> owner, tokenId); tokenId is the agentId (Pitfall 6).
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
    anonymous: false,
  },
] as const;

/** Minimal ERC-20 — approve/allowance/balanceOf/decimals for the one-time max approve (D-29). */
export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;
