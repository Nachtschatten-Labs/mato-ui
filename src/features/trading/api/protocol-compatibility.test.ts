import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getTransactionEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from '@solana/kit'
import type { Address, Blockhash, Instruction } from '@solana/kit'
import type { SolanaClient, WalletSession } from '@solana/client'
import * as accounts from '@/lib/generated/twob/src/generated/accounts'
import { getMarketUpdateEventEventDecoder } from '@/lib/generated/twob/src/generated/events'
import { Side } from '@/lib/generated/twob/src/generated/types'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'
import {
  deriveBookkeepingAddress,
  deriveProgramConfigAddress,
  fetchStreamingMarketState,
  sendClosePositions,
  sendPauseTradePosition,
  sendUnpauseTradePosition,
  sendWithdrawSwapped,
} from './twob-client'

const WALLET = '11111111111111111111111111111111' as Address
const MARKET = '5qtZReDA5y8K7nq6FX9qKqYwmG1gWkRWdkWZnuUGTaQx' as Address
const BASE = 'So11111111111111111111111111111111111111112' as Address
const QUOTE = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' as Address
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' as Address
const SIGNATURE = getBase58Decoder().decode(new Uint8Array(64).fill(1))

vi.mock('@solana/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@solana/client')>()),
  createWalletTransactionSigner: (session: WalletSession) => ({
    signer: createNoopSigner(session.account.address),
  }),
  detectTokenProgram: async () => ({ programAddress: TOKEN_PROGRAM }),
}))

function createMarket(kind = 0) {
  return accounts.getMarketDecoder().decode(
    accounts.getMarketEncoder().encode({
      baseMint: BASE,
      quoteMint: QUOTE,
      baseFlow: 1_000_000_000n,
      quoteFlow: 2_000_000_000n,
      minimumBaseDepositAtoms: 1n,
      minimumQuoteDepositAtoms: 1n,
      startSlot: 1n,
      openPositions: 2n,
      accumulatedBaseFees: 0n,
      accumulatedQuoteFees: 0n,
      id: 1,
      feeBps: 10,
      unhealthyLiquidityFeeBps: 0,
      slotsUntilDebt: 10,
      liquidityAmplification: 2,
      kind,
      isPaused: 0,
      bump: 255,
      makerAuthority: WALLET,
      pendingMakerAuthority: null,
      quoteOperator: WALLET,
      makerBaseInventory: -1n,
      makerQuoteInventory: 10n,
      makerBaseFlowAtoms: 1n,
      makerQuoteFlowAtoms: 2n,
      makerBasePerQuoteSnapshot: 0n,
      makerQuotePerBaseSnapshot: 0n,
      makerSlotsWithoutTradeSnapshot: 0,
      makerLastUpdateSlot: 490n,
    }),
  )
}

function createPosition(overrides: Partial<accounts.TradePositionArgs> = {}) {
  return accounts.getTradePositionDecoder().decode(
    accounts.getTradePositionEncoder().encode({
      authority: WALLET,
      market: MARKET,
      payer: WALLET,
      operator: WALLET,
      baseReceiver: WALLET,
      quoteReceiver: WALLET,
      amount: 1_000n,
      inactiveRefund: 0n,
      startSlot: 400n,
      lastUpdateSlot: 400n,
      remainingSlots: 300,
      flow: 3_000_000_000n,
      bookkeepingSnapshot: 0n,
      slotsWithoutTradesSnapshot: 0,
      pausedAtSlot: 0n,
      swappedAmountAtSnapshot: 0n,
      withdrawnAmount: 0n,
      id: 1,
      feeBpsAtSubmission: 25,
      side: Side.Sell,
      bump: 255,
      ...overrides,
    }),
  )
}

function createContext(kind = 0) {
  vi.spyOn(accounts, 'fetchMarket').mockResolvedValue({
    data: createMarket(kind),
  } as Awaited<ReturnType<typeof accounts.fetchMarket>>)
  vi.spyOn(accounts, 'fetchTradePosition').mockResolvedValue({
    data: createPosition(),
  } as Awaited<ReturnType<typeof accounts.fetchTradePosition>>)
  vi.spyOn(accounts, 'fetchBookkeeping').mockResolvedValue({
    data: {
      market: MARKET,
      basePerQuote: 1n,
      quotePerBase: 2n,
      lastUpdateSlot: 490n,
    },
  } as Awaited<ReturnType<typeof accounts.fetchBookkeeping>>)
  const client = {
    runtime: {
      rpc: {
        getSlot: () => ({ send: async () => 500n }),
        getAccountInfo: () => ({ send: async () => ({ value: {} }) }),
        getSignatureStatuses: () => ({
          send: async () => ({
            value: [{ confirmationStatus: 'confirmed', err: null }],
          }),
        }),
      },
    },
    wsol: { prepareUnwrap: async () => ({ message: { instructions: [] } }) },
  } as unknown as SolanaClient
  const session = { account: { address: WALLET } } as WalletSession
  const send = vi.fn(
    async (_request: { instructions: readonly Instruction[] }) => SIGNATURE,
  )
  const sendTransaction = { send } as unknown as Parameters<
    typeof sendClosePositions
  >[0]['sendTransaction']
  return { client, session, sendTransaction, send }
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
  vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', TWOB_ANCHOR_PROGRAM_ADDRESS)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('v1 protocol compatibility', () => {
  it('decodes all 30 interval entries and the updated exits counter offset', () => {
    // Rust layout: discriminator + market + index + payer + two [u128; 30] arrays.
    const exits = Buffer.alloc(1045)
    exits.set(accounts.getExitsDiscriminatorBytes())
    exits.writeBigUInt64LE(123n, 80 + 29 * 16)
    exits.writeUInt32LE(7, 1040)
    expect(accounts.getExitsDecoder().decode(exits)).toMatchObject({
      openPositions: 7,
    })
    expect(accounts.getExitsDecoder().decode(exits).baseExits[29]).toBe(123n)
    const prices = Buffer.alloc(1161)
    prices.set(accounts.getPricesDiscriminatorBytes())
    prices.writeBigUInt64LE(456n, 80 + 30 * 16 + 29 * 16)
    expect(
      accounts.getPricesDecoder().decode(prices).quotePerBaseSnapshot[29],
    ).toBe(456n)
  })

  it('decodes market-address events with flows larger than u64', () => {
    const bytes = Buffer.alloc(72)
    bytes.set([114, 70, 57, 176, 187, 142, 113, 145])
    bytes.set(getAddressEncoder().encode(MARKET), 8)
    bytes.writeBigUInt64LE(5n, 40)
    bytes.writeBigUInt64LE(1n, 48)
    bytes.writeBigUInt64LE(7n, 56)
    expect(getMarketUpdateEventEventDecoder().decode(bytes)).toEqual({
      market: MARKET,
      baseFlow: (1n << 64n) + 5n,
      quoteFlow: 7n,
    })
  })

  it.each([0, 1])(
    'reads streaming state for market kind %s with the fixed interval',
    async (kind) => {
      const { client } = createContext(kind)
      expect(
        await fetchStreamingMarketState(client.runtime.rpc, MARKET),
      ).toMatchObject({
        endSlotInterval: 7,
        marketBaseFlow: 1_000_000_000n,
        marketQuoteFlow: 2_000_000_000n,
      })
    },
  )

  it('passes explicit bookkeeping accounts for pause and resume', async () => {
    const context = createContext()
    const request = { marketAddress: MARKET, tradePositionAddress: QUOTE }
    await sendPauseTradePosition({ ...context, request })
    expect(
      context.send.mock.calls[0][0].instructions[0].accounts?.[5].address,
    ).toBe(await deriveBookkeepingAddress(MARKET))
    vi.mocked(accounts.fetchTradePosition).mockResolvedValue({
      data: createPosition({ pausedAtSlot: 490n }),
    } as Awaited<ReturnType<typeof accounts.fetchTradePosition>>)
    await sendUnpauseTradePosition({ ...context, request })
    expect(
      context.send.mock.calls[1][0].instructions[0].accounts?.[5].address,
    ).toBe(await deriveBookkeepingAddress(MARKET))
  })

  it('supplies the canonical fee configuration to swapped-fund withdrawals', async () => {
    const context = createContext(1)
    await sendWithdrawSwapped({
      ...context,
      request: { marketAddress: MARKET, tradePositionAddress: BASE },
    })
    const instruction = context.send.mock.calls[0][0].instructions.at(-1)!
    expect(instruction.accounts?.[1]).toEqual({
      address: await deriveProgramConfigAddress(),
      role: AccountRole.READONLY,
    })
    expect(instruction.accounts?.[8].address).toBe(
      await deriveBookkeepingAddress(MARKET),
    )
  })

  it('includes fee configuration in both closes and fits two positions in one transaction', async () => {
    const context = createContext()
    await sendClosePositions({
      ...context,
      request: { marketAddress: MARKET, tradePositionAddresses: [BASE, QUOTE] },
    })
    const instructions = context.send.mock.calls[0][0].instructions
    expect(instructions).toHaveLength(2)
    for (const instruction of instructions) {
      expect(instruction.accounts).toHaveLength(24)
      expect(instruction.accounts?.[1]).toEqual({
        address: await deriveProgramConfigAddress(),
        role: AccountRole.READONLY,
      })
      expect(instruction.accounts?.[13].address).toBe(
        await deriveBookkeepingAddress(MARKET),
      )
    }
    const message = appendTransactionMessageInstructions(
      instructions,
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: WALLET as string as Blockhash,
          lastValidBlockHeight: 1000n,
        },
        setTransactionMessageFeePayer(
          WALLET,
          createTransactionMessage({ version: 0 }),
        ),
      ),
    )
    expect(
      getTransactionEncoder().encode(compileTransaction(message)).length,
    ).toBeLessThanOrEqual(1232)
  })

  it.each([
    sendPauseTradePosition,
    sendUnpauseTradePosition,
    sendWithdrawSwapped,
  ])(
    'rejects control of a position from another market before sending',
    async (sendPosition) => {
      const context = createContext()
      vi.mocked(accounts.fetchTradePosition).mockResolvedValue({
        data: createPosition({ market: BASE }),
      } as Awaited<ReturnType<typeof accounts.fetchTradePosition>>)
      await expect(
        sendPosition({
          ...context,
          request: { marketAddress: MARKET, tradePositionAddress: QUOTE },
        }),
      ).rejects.toThrow('different market')
      expect(context.send).not.toHaveBeenCalled()
    },
  )
})
