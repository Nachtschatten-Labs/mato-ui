import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { createClient } from '@solana/client'
import type { WalletSession } from '@solana/client'
import { address, generateKeyPairSigner } from '@solana/kit'
import type { KeyPairSigner } from '@solana/kit'
import { getMarketDefinition } from '../src/features/trading/constants'
import {
  deriveMarketAddress,
  deriveMarketIntervalAddress,
  deriveProgramConfigAddress,
  fetchEndSlotBookkeepingSnapshot,
  fetchTradePositions,
  getApprovalSafeReferenceIndex,
  sendSubmitOrder,
  sendPauseTradePosition,
  sendUnpauseTradePosition,
  sendWithdrawSwapped,
  sendClosePositions,
  sendReclaimRent,
} from '../src/features/trading/api/twob-client'
import {
  fetchMarket,
  fetchProgramConfig,
  fetchTradePosition,
  getProgramConfigEncoder,
} from '../src/lib/generated/twob/src/generated/accounts'
import {
  getInitializeMarketInstructionAsync,
  getProvideLiquidityInstructionAsync,
  getUpdateBooksInstruction,
} from '../src/lib/generated/twob/src/generated/instructions'
import { getTradePositionEndSlot } from '../src/features/trading/lib/trade-position'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '../src/lib/generated/twob/src/generated/programs'

// Explicit opt-in; all writes are hard-coded to an isolated Surfpool localhost fork.
const enabled = process.env.MATO_MAINNET_FORK_TEST === 'true'
const endpoint = 'http://127.0.0.1:19899'
const client = enabled
  ? createClient({ endpoint, websocketEndpoint: 'ws://127.0.0.1:19900' })
  : null
let signer: KeyPairSigner
vi.mock('@solana/client', async (original) => ({
  ...(await original<typeof import('@solana/client')>()),
  createWalletTransactionSigner: () => ({ signer }),
}))
const productionMarket = getMarketDefinition(1)
// A separate pair/id namespace keeps live positions and intervals out of the test.
const market = { ...productionMarket, id: 0xffff_fffe }
const tokenProgram = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
async function rpc(method: string, params: unknown[] = []) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const payload = (await response.json()) as {
    error?: unknown
    result: unknown
  }
  if (payload.error) throw new Error(JSON.stringify(payload.error))
  return payload.result
}
async function references() {
  const state = await fetchMarket(client!.runtime.rpc, market.address)
  const slot = Number(await client!.runtime.rpc.getSlot().send())
  const referenceIndex = getApprovalSafeReferenceIndex(
    slot,
    state.data.bookkeeping.lastUpdateSlot,
    11,
  )
  return {
    referenceIndex,
    currentInterval: await deriveMarketIntervalAddress(
      market.address,
      referenceIndex,
    ),
    previousInterval: await deriveMarketIntervalAddress(
      market.address,
      referenceIndex - 1n,
    ),
  }
}
async function books() {
  await client!.transaction.prepareAndSend({
    authority: signer,
    instructions: [
      getUpdateBooksInstruction({
        signer,
        slot: await client!.runtime.rpc.getSlot().send(),
        market: market.address,
        ...(await references()),
      }),
    ],
  })
}
async function advance(slots: number) {
  const slot = Number(await client!.runtime.rpc.getSlot().send())
  await rpc('surfnet_timeTravel', [{ absoluteSlot: slot + slots }])
  await new Promise((resolve) => setTimeout(resolve, 500))
  await books()
}
beforeAll(async () => {
  if (!enabled) return
  signer = await generateKeyPairSigner()
  vi.stubEnv('VITE_ENABLE_TRANSACTIONS', 'true')
  vi.stubEnv('VITE_VERIFIED_PROGRAM_ID', TWOB_ANCHOR_PROGRAM_ADDRESS)
  // A Surfpool-only method must succeed before any transaction can be submitted.
  await rpc('surfnet_setAccount', [signer.address, { lamports: 10000000000 }])
  await rpc('surfnet_setTokenAccount', [
    signer.address,
    market.quoteMint,
    { amount: 100000000 },
    tokenProgram,
  ])
  const state = await fetchMarket(client!.runtime.rpc, productionMarket.address)
  expect(state.programAddress).toBe(TWOB_ANCHOR_PROGRAM_ADDRESS)
  expect(state.data.kind).toBe(0)
  expect(state.data.isPaused).toBe(0)
  market.address = await deriveMarketAddress(market)

  // Replace only the fork's config authority with a throwaway signer, then use
  // real instructions to create an isolated market with the live parameters.
  const programConfig = await deriveProgramConfigAddress()
  const config = await fetchProgramConfig(client!.runtime.rpc, programConfig)
  await rpc('surfnet_setAccount', [
    programConfig,
    {
      data: Buffer.from(
        getProgramConfigEncoder().encode({
          ...config.data,
          authority: signer.address,
        }),
      ).toString('hex'),
    },
  ])
  await client!.transaction.prepareAndSend({
    authority: signer,
    instructions: [
      await getInitializeMarketInstructionAsync({
        authority: signer,
        payer: signer,
        programConfig,
        baseMint: market.baseMint,
        quoteMint: market.quoteMint,
        market: market.address,
        id: market.id,
        minimumBaseDeposit: state.data.minimumBaseDepositAtoms,
        minimumQuoteDeposit: state.data.minimumQuoteDepositAtoms,
        startSlot: await client!.runtime.rpc.getSlot().send(),
        feeBps: state.data.feeBps,
        unhealthyLiquidityFeeBps: state.data.unhealthyLiquidityFeeBps,
        slotsUntilDebt: state.data.slotsUntilDebt,
        liquidityAmplification: state.data.liquidityAmplification,
        baseTokenProgram: tokenProgram,
        quoteTokenProgram: tokenProgram,
      }),
    ],
  })

  // An unrelated wallet supplies ordinary permissionless liquidity. All funds
  // and keys exist only on the local fork; no production signer is loaded.
  const liquidityProvider = await generateKeyPairSigner()
  await rpc('surfnet_setAccount', [
    liquidityProvider.address,
    { lamports: 10000000000 },
  ])
  await rpc('surfnet_setTokenAccount', [
    liquidityProvider.address,
    market.quoteMint,
    { amount: 100000000 },
    tokenProgram,
  ])
  const wrap = await client!.wsol.prepareWrap({
    authority: liquidityProvider,
    owner: liquidityProvider.address,
    amount: 1_000_000_000n,
  })
  await client!.transaction.prepareAndSend({
    authority: liquidityProvider,
    instructions: wrap.message.instructions,
  })
  await client!.transaction.prepareAndSend({
    authority: liquidityProvider,
    instructions: [
      await getProvideLiquidityInstructionAsync({
        authority: liquidityProvider,
        market: market.address,
        baseMint: market.baseMint,
        quoteMint: market.quoteMint,
        baseTokenProgram: tokenProgram,
        quoteTokenProgram: tokenProgram,
        ...(await references()),
        baseDepositAtoms: 1_000_000_000n,
        quoteDepositAtoms: 100_000_000n,
        baseFlowAtoms: 100000n,
        quoteFlowAtoms: 15000n,
      }),
    ],
  })
  const fundedMarket = await fetchMarket(client!.runtime.rpc, market.address)
  expect(fundedMarket.data.kind).toBe(0)
  expect(fundedMarket.data.openPositions).toBe(1n)
  expect(fundedMarket.data.baseFlow).toBeGreaterThan(0n)
  expect(fundedMarket.data.quoteFlow).toBeGreaterThan(0n)
}, 60000)
afterAll(() => {
  vi.unstubAllEnvs()
})
it.skipIf(!enabled)(
  'runs buy/sell, pause/resume, withdrawal, settlement, batch close and interval reclamation with ordinary liquidity against deployed bytecode',
  async () => {
    const session = { account: { address: signer.address } } as WalletSession
    const sendTransaction = { send: client!.transaction.prepareAndSend }
    const context = { client: client!, session, sendTransaction }
    await sendSubmitOrder({
      ...context,
      request: {
        marketAddress: market.address,
        isBuy: true,
        inputMintAddress: market.quoteMint,
        amount: 1000000n,
        existingWrappedAtoms: 0n,
        durationSlots: 120,
        id: 1,
      },
    })
    await sendSubmitOrder({
      ...context,
      request: {
        marketAddress: market.address,
        isBuy: false,
        inputMintAddress: market.baseMint,
        amount: 10000000n,
        existingWrappedAtoms: 0n,
        durationSlots: 120,
        id: 2,
      },
    })
    const positions = await fetchTradePositions(
      client!.runtime.rpc,
      signer.address,
      market.address,
    )
    expect(positions).toHaveLength(2)
    const buy = positions.find((p) => p.data.side === 0)!
    const request = {
      marketAddress: market.address,
      tradePositionAddress: buy.address,
    }
    await advance(10)
    await sendPauseTradePosition({ ...context, request })
    expect(
      (await fetchTradePosition(client!.runtime.rpc, buy.address)).data
        .pausedAtSlot,
    ).toBeGreaterThan(0n)
    await advance(5)
    await sendUnpauseTradePosition({ ...context, request })
    expect(
      (await fetchTradePosition(client!.runtime.rpc, buy.address)).data
        .pausedAtSlot,
    ).toBe(0n)
    await advance(10)
    await sendWithdrawSwapped({ ...context, request })
    expect(
      (await fetchTradePosition(client!.runtime.rpc, buy.address)).data
        .withdrawnAmount,
    ).toBeGreaterThan(0n)
    const refreshed = await fetchTradePositions(
      client!.runtime.rpc,
      signer.address,
      market.address,
    )
    const end = Math.max(
      ...refreshed.map((p) => Number(getTradePositionEndSlot(p.data))),
    )
    while (Number(await client!.runtime.rpc.getSlot().send()) <= end)
      await advance(40)
    const state = await fetchMarket(client!.runtime.rpc, market.address)
    const snapshot = await fetchEndSlotBookkeepingSnapshot({
      rpcClient: client!.runtime.rpc,
      marketAddress: market.address,
      endSlot: Number(
        getTradePositionEndSlot(
          (await fetchTradePosition(client!.runtime.rpc, buy.address)).data,
        ),
      ),
      endSlotInterval: 11,
      isBuy: true,
      bookkeepingLastUpdateSlot: Number(state.data.bookkeeping.lastUpdateSlot),
    })
    expect(snapshot?.bookkeeping).toBeGreaterThan(0n)
    await sendClosePositions({
      ...context,
      request: {
        marketAddress: market.address,
        tradePositionAddresses: positions.map((p) => p.address),
      },
    })
    expect(
      await fetchTradePositions(
        client!.runtime.rpc,
        signer.address,
        market.address,
      ),
    ).toHaveLength(0)
    for (let i = 0; i < 5; i++) await advance(40)
    const reclaimed = await sendReclaimRent({
      ...context,
      request: { marketAddress: market.address, maxAccounts: 10 },
    })
    expect(reclaimed.reclaimedLamports).toBeGreaterThan(0n)
  },
  120000,
)
