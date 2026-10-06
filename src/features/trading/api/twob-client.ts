import { assertTransactionsEnabled } from '@/integrations/solana/transaction-policy'
import {
  SIGNATURE_STATUS_TIMEOUT_MS,
  WRAPPED_SOL_MINT,
  confirmationMeetsCommitment,
  createWalletTransactionSigner,
  deriveConfirmationStatus,
  detectTokenProgram,
  normalizeSignature,
} from '@solana/client'
import {
  AccountRole,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  getAddressEncoder,
  getBase58Decoder,
  getBytesEncoder,
  getProgramDerivedAddress,
  getU64Encoder,
  isTransactionMessageWithSingleSendingSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signAndSendTransactionMessageWithSigners,
  signTransactionMessageWithSigners,
} from '@solana/kit'
import {
  ARRAY_LENGTH,
  END_SLOT_INTERVAL,
  MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
} from '../constants'
import { encodeBase58 } from '../lib/base58'
import { findMarketAddress } from '../lib/pdas'
import { decodeBase64 } from '../lib/bytes'
import { collectCloseableMarketIntervals } from '../lib/rent'
import {
  getTradePositionEndSlot,
  isBuyTradePosition,
} from '../lib/trade-position'
import { fetchOwnedMarketIntervals } from './rent-accounts'
import { getSolOrderWrapAmount } from './sol-order-funding'
import type { SolanaClient, WalletSession } from '@solana/client'
import type { UseSendTransactionReturnType } from '@solana/react-hooks'
import type { Address, TransactionSigner } from '@solana/kit'
import type {
  StreamingMarketState,
  TradeSettlementSnapshot,
  TradePositionRecord,
} from '../domain/models'
import type { IntervalRentAccount } from '../lib/rent'
import type {
  Market,
  TradePosition,
} from '@/lib/generated/twob/src/generated/accounts'
import {
  fetchMarket,
  fetchMarketInterval,
  fetchTradePosition,
  getTradePositionDecoder,
  getTradePositionDiscriminatorBytes,
} from '@/lib/generated/twob/src/generated/accounts'
import {
  getAuthorityCloseTradePositionInstructionAsync,
  getCloseMarketIntervalInstruction,
  getPauseTradePositionInstruction,
  getSubmitOrderInstructionAsync,
  getUnpauseTradePositionInstructionAsync,
  getWithdrawSwappedInstructionAsync,
} from '@/lib/generated/twob/src/generated/instructions'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'

const textEncoder = new TextEncoder()
const BOOKKEEPING_DELAY_SLOTS = 20
const TRADE_POSITION_MARKET_OFFSET = 40n
const SIGNATURE_POLL_INTERVAL_MS = 1_000
const ASSOCIATED_TOKEN_PROGRAM_ADDRESS =
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address
const SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111' as Address

export type TwobRpcClient = SolanaClient['runtime']['rpc']

type SendTransactionHelper = Pick<UseSendTransactionReturnType, 'send'>
type GetProgramAccountsConfig = NonNullable<
  Parameters<TwobRpcClient['getProgramAccounts']>[1]
>
type GetProgramAccountsFilter = NonNullable<
  GetProgramAccountsConfig['filters']
>[number]

function seed(value: string) {
  return getBytesEncoder().encode(textEncoder.encode(value))
}

async function waitForConfirmedSignature(
  rpcClient: TwobRpcClient,
  signature: string,
) {
  const normalizedSignature = normalizeSignature(signature)
  if (!normalizedSignature) {
    throw new Error('Invalid transaction signature returned by wallet.')
  }

  const startTime = Date.now()

  while (Date.now() - startTime < SIGNATURE_STATUS_TIMEOUT_MS) {
    const response = await rpcClient
      .getSignatureStatuses([normalizedSignature])
      .send()
    const status = response.value[0] ?? null

    if (status?.err) {
      throw new Error(
        `Transaction failed during confirmation: ${JSON.stringify(status.err)}`,
      )
    }

    if (
      confirmationMeetsCommitment(deriveConfirmationStatus(status), 'confirmed')
    ) {
      return
    }

    await new Promise((resolve) =>
      setTimeout(resolve, SIGNATURE_POLL_INTERVAL_MS),
    )
  }

  throw new Error('Transaction confirmation timed out.')
}

export const deriveMarketAddress = findMarketAddress

export async function deriveProgramConfigAddress() {
  const [address] = await getProgramDerivedAddress({
    programAddress: TWOB_ANCHOR_PROGRAM_ADDRESS,
    seeds: [seed('program_config')],
  })
  return address
}

export async function deriveMarketIntervalAddress(
  marketAddress: Address,
  index: bigint | number,
) {
  const [address] = await getProgramDerivedAddress({
    programAddress: TWOB_ANCHOR_PROGRAM_ADDRESS,
    seeds: [
      seed('market_interval'),
      getAddressEncoder().encode(marketAddress),
      getU64Encoder().encode(BigInt(index)),
    ],
  })
  return address
}

export async function deriveAssociatedTokenAddress({
  mint,
  owner,
  tokenProgram,
}: {
  mint: Address
  owner: Address
  tokenProgram: Address
}) {
  const [address] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [
      getAddressEncoder().encode(owner),
      getAddressEncoder().encode(tokenProgram),
      getAddressEncoder().encode(mint),
    ],
  })
  return address
}

export async function deriveTemporaryWithdrawTokenAddress(
  tradePositionAddress: Address,
) {
  const [address] = await getProgramDerivedAddress({
    programAddress: TWOB_ANCHOR_PROGRAM_ADDRESS,
    seeds: [getAddressEncoder().encode(tradePositionAddress)],
  })
  return address
}

export function getReferenceIndex(
  currentSlot: number,
  endSlotInterval: bigint | number,
) {
  return BigInt(
    Math.max(
      1,
      Math.floor(
        (currentSlot + BOOKKEEPING_DELAY_SLOTS) /
          (ARRAY_LENGTH * Number(endSlotInterval)),
      ),
    ),
  )
}

export function getApprovalSafeReferenceIndex(
  currentSlot: number,
  bookkeepingLastUpdateSlot: bigint | number,
  endSlotInterval: bigint | number,
) {
  const slotsPerAccount = ARRAY_LENGTH * Number(endSlotInterval)
  const currentIndex = Math.floor(currentSlot / slotsPerAccount)
  const lastUpdateIndex = Math.floor(
    Number(bookkeepingLastUpdateSlot) / slotsPerAccount,
  )

  if (currentIndex - lastUpdateIndex > 1) {
    throw new Error(
      'Market bookkeeping is behind. Wait for the keeper to catch up and try again.',
    )
  }
  return BigInt(
    Math.max(
      1,
      lastUpdateIndex === currentIndex ? currentIndex + 1 : currentIndex,
    ),
  )
}

export function getPreviousIndex(referenceIndex: bigint) {
  return referenceIndex - 1n
}

export function getFutureIndex(
  endSlot: bigint,
  endSlotInterval: bigint | number,
) {
  return endSlot / BigInt(ARRAY_LENGTH) / BigInt(endSlotInterval)
}

export function alignEndSlot(
  currentSlot: number,
  durationSlots: number,
  endSlotInterval: bigint | number,
) {
  const interval = Number(endSlotInterval)
  return BigInt(
    Math.floor((currentSlot + durationSlots + interval / 2) / interval) *
      interval,
  )
}

export function getUnpausedEndSlot(
  currentSlot: bigint | number,
  remainingSlots: number,
  endSlotInterval: bigint | number,
) {
  const slot = BigInt(currentSlot)
  const interval = BigInt(endSlotInterval)
  return ((slot + BigInt(remainingSlots) + interval) / interval) * interval
}

export function getSwappedPositionAsset(
  market: Pick<Market, 'baseMint' | 'quoteMint'>,
  tradePosition: Pick<TradePosition, 'baseReceiver' | 'quoteReceiver' | 'side'>,
) {
  return isBuyTradePosition(tradePosition)
    ? { mint: market.baseMint, receiver: tradePosition.baseReceiver }
    : { mint: market.quoteMint, receiver: tradePosition.quoteReceiver }
}

export function resolveSnapshotLocation(slot: number, endSlotInterval: number) {
  if (!Number.isFinite(slot) || slot < 0) return null
  if (!Number.isFinite(endSlotInterval) || endSlotInterval <= 0) return null

  const slotsPerInterval = ARRAY_LENGTH * endSlotInterval
  return {
    intervalIndex: Math.floor(slot / slotsPerInterval),
    snapshotIndex: Math.floor(slot / endSlotInterval) % ARRAY_LENGTH,
  }
}

export async function fetchStreamingMarketState(
  rpcClient: TwobRpcClient,
  marketAddress: Address,
): Promise<StreamingMarketState> {
  const [currentSlot, marketAccount] = await Promise.all([
    rpcClient.getSlot({ commitment: 'confirmed' }).send(),
    fetchMarket(rpcClient, marketAddress, { commitment: 'confirmed' }),
  ])

  return {
    baseMint: marketAccount.data.baseMint,
    bookkeepingBasePerQuote: marketAccount.data.bookkeeping.basePerQuote,
    bookkeepingLastUpdateSlot: Number(
      marketAccount.data.bookkeeping.lastUpdateSlot,
    ),
    bookkeepingQuotePerBase: marketAccount.data.bookkeeping.quotePerBase,
    bookkeepingSlotsWithoutTrades:
      marketAccount.data.bookkeeping.slotsWithoutTrade,
    currentSlot: Number(currentSlot),
    endSlotInterval: END_SLOT_INTERVAL,
    isPaused: marketAccount.data.isPaused !== 0,
    marketBaseFlow: marketAccount.data.baseFlow,
    marketId: marketAccount.data.id,
    marketQuoteFlow: marketAccount.data.quoteFlow,
    minimumBaseDepositAtoms: marketAccount.data.minimumBaseDepositAtoms,
    minimumQuoteDepositAtoms: marketAccount.data.minimumQuoteDepositAtoms,
    quoteMint: marketAccount.data.quoteMint,
  }
}

function getTradePositionMarketFilter(
  marketAddress: Address,
): GetProgramAccountsFilter {
  return {
    memcmp: {
      bytes: marketAddress as never,
      encoding: 'base58',
      offset: TRADE_POSITION_MARKET_OFFSET,
    },
  }
}

export async function fetchTradePositions(
  rpcClient: TwobRpcClient,
  authority: string,
  marketAddress: Address,
): Promise<Array<TradePositionRecord>> {
  const positions = await fetchTradePositionAccounts(rpcClient, [
    {
      memcmp: {
        bytes: authority as never,
        encoding: 'base58',
        offset: 8n,
      },
    },
    getTradePositionMarketFilter(marketAddress),
  ])
  return positions.filter((position) => position.data.market === marketAddress)
}

async function fetchTradePositionAccounts(
  rpcClient: TwobRpcClient,
  extraFilters: Array<GetProgramAccountsFilter> = [],
): Promise<Array<TradePositionRecord>> {
  const response = (await rpcClient
    .getProgramAccounts(TWOB_ANCHOR_PROGRAM_ADDRESS, {
      commitment: 'confirmed',
      encoding: 'base64',
      filters: [
        { dataSize: 312n },
        {
          memcmp: {
            bytes: encodeBase58(
              Uint8Array.from(getTradePositionDiscriminatorBytes()),
            ) as never,
            encoding: 'base58',
            offset: 0n,
          },
        },
        ...extraFilters,
      ],
    })
    .send()) as any

  const accounts = (
    Array.isArray(response) ? response : response.value
  ) as Array<{
    account: { data: [string, string] }
    pubkey: Address
  }>

  return accounts
    .map(({ account, pubkey }) => ({
      address: pubkey,
      data: getTradePositionDecoder().decode(decodeBase64(account.data[0])),
    }))
    .sort((left, right) => {
      if (left.data.id === right.data.id) return 0
      return left.data.id > right.data.id ? -1 : 1
    })
}

export async function fetchMarketTradePositions(
  rpcClient: TwobRpcClient,
  marketAddress: Address,
): Promise<Array<TradePositionRecord>> {
  const positions = await fetchTradePositionAccounts(rpcClient, [
    getTradePositionMarketFilter(marketAddress),
  ])
  return positions.filter((position) => position.data.market === marketAddress)
}

export async function fetchEndSlotBookkeepingSnapshot({
  bookkeepingLastUpdateSlot,
  endSlot,
  endSlotInterval,
  isBuy,
  marketAddress,
  rpcClient,
}: {
  bookkeepingLastUpdateSlot: number | null
  endSlot: number
  endSlotInterval: number | null
  isBuy: boolean
  marketAddress: Address
  rpcClient: TwobRpcClient
}): Promise<TradeSettlementSnapshot | null> {
  const snapshotLocation =
    endSlotInterval === null
      ? null
      : resolveSnapshotLocation(endSlot, endSlotInterval)

  if (!snapshotLocation) return null

  if (
    bookkeepingLastUpdateSlot === null ||
    bookkeepingLastUpdateSlot < endSlot
  ) {
    return null
  }

  const intervalAddress = await deriveMarketIntervalAddress(
    marketAddress,
    BigInt(snapshotLocation.intervalIndex),
  )
  const interval = await fetchMarketInterval(rpcClient, intervalAddress, {
    commitment: 'confirmed',
  })
  if (
    interval.data.market !== marketAddress ||
    interval.data.index !== BigInt(snapshotLocation.intervalIndex)
  ) {
    throw new Error(
      'The settlement snapshot does not match its market interval.',
    )
  }
  const snapshots = isBuy
    ? interval.data.basePerQuoteSnapshot
    : interval.data.quotePerBaseSnapshot
  const bookkeeping = snapshots[snapshotLocation.snapshotIndex]
  const slotsWithoutTrades =
    interval.data.slotsWithoutTradesSnapshot[snapshotLocation.snapshotIndex]
  if (bookkeeping === undefined || slotsWithoutTrades === undefined) return null
  return { slot: endSlot, bookkeeping, slotsWithoutTrades }
}

export async function sendSubmitOrder({
  client,
  onBeforeSend,
  request,
  session,
}: {
  client: SolanaClient
  onBeforeSend?: () => void
  request: {
    amount: bigint
    durationSlots: number
    existingWrappedAtoms?: bigint
    id: number
    inputMintAddress: string
    isBuy: boolean
    marketAddress: Address
  }
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const { amount, durationSlots, id, inputMintAddress, isBuy, marketAddress } =
    request

  if (!Number.isInteger(id) || id < 0 || id > 0xffffffff) {
    throw new Error('Order id must be an unsigned 32-bit integer.')
  }
  if (
    !Number.isInteger(durationSlots) ||
    durationSlots < END_SLOT_INTERVAL ||
    durationSlots > 160_000_000
  ) {
    throw new Error('Order duration must be between 11 and 160,000,000 slots.')
  }

  const walletSigner = createWalletTransactionSigner(session).signer
  const wrapShortfall =
    inputMintAddress === WRAPPED_SOL_MINT
      ? await getSolOrderWrapAmount({
          amount,
          client,
          owner: session.account.address,
        })
      : 0n
  const marketAccount = await fetchMarket(client.runtime.rpc, marketAddress, {
    commitment: 'confirmed',
  })
  const mint = isBuy
    ? marketAccount.data.quoteMint
    : marketAccount.data.baseMint
  if (inputMintAddress !== mint)
    throw new Error('Input mint does not match the selected market side.')
  const tokenProgram = await detectTokenProgram(
    client.runtime,
    mint,
    'confirmed',
  )

  const wrapInstructions =
    wrapShortfall > 0n
      ? (
          await client.wsol.prepareWrap({
            amount: wrapShortfall,
            authority: walletSigner,
            commitment: 'confirmed',
            owner: session.account.address,
          })
        ).message.instructions
      : []

  const [currentSlotResponse, blockhashResponse] = await Promise.all([
    client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
    client.runtime.rpc.getLatestBlockhash({ commitment: 'confirmed' }).send(),
  ])
  const currentSlot = Number(currentSlotResponse)
  const referenceIndex = getApprovalSafeReferenceIndex(
    currentSlot,
    marketAccount.data.bookkeeping.lastUpdateSlot,
    END_SLOT_INTERVAL,
  )
  const previousIndex = getPreviousIndex(referenceIndex)
  const positionStartSlot = Math.max(
    currentSlot,
    Number(marketAccount.data.startSlot),
  )
  const endSlot = alignEndSlot(
    positionStartSlot,
    durationSlots,
    END_SLOT_INTERVAL,
  )
  const futureIndex = getFutureIndex(endSlot, END_SLOT_INTERVAL)

  const [currentInterval, previousInterval] = await Promise.all([
    deriveMarketIntervalAddress(marketAddress, referenceIndex),
    deriveMarketIntervalAddress(marketAddress, previousIndex),
  ])

  const instruction = await getSubmitOrderInstructionAsync({
    amount,
    authority: walletSigner,
    baseReceiver: session.account.address,

    currentInterval,

    duration: durationSlots,
    futureIndex,
    id,
    market: marketAddress,
    mint,
    operator: session.account.address,
    payer: walletSigner,
    previousInterval,

    quoteReceiver: session.account.address,
    referenceIndex,
    tokenProgram: tokenProgram.programAddress,
  })

  onBeforeSend?.()
  const { value: blockhashLifetime } = blockhashResponse

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(walletSigner, message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(blockhashLifetime, message),
    (message) =>
      appendTransactionMessageInstructions(
        [...wrapInstructions, instruction],
        message,
      ),
  )

  if (isTransactionMessageWithSingleSendingSigner(transactionMessage)) {
    const signatureBytes =
      await signAndSendTransactionMessageWithSigners(transactionMessage)
    const signature = getBase58Decoder().decode(signatureBytes)
    await waitForConfirmedSignature(client.runtime.rpc, signature)
    return signature
  }

  const signedTransaction =
    await signTransactionMessageWithSigners(transactionMessage)
  const blockhashBackedTransaction = signedTransaction as Parameters<
    typeof client.actions.sendTransaction
  >[0]
  const signature = await client.actions.sendTransaction(
    blockhashBackedTransaction,
    'confirmed',
  )
  const serializedSignature = signature.toString()
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)
  return serializedSignature
}

function getCreateAssociatedTokenIdempotentInstruction({
  ata,
  mint,
  owner,
  payer,
  tokenProgram,
}: {
  ata: Address
  mint: Address
  owner: Address
  payer: TransactionSigner
  tokenProgram: Address
}) {
  return Object.freeze({
    accounts: [
      {
        address: payer.address,
        role: AccountRole.WRITABLE_SIGNER,
        signer: payer,
      },
      { address: ata, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.READONLY },
      { address: mint, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      { address: tokenProgram, role: AccountRole.READONLY },
    ] as const,
    data: new Uint8Array([1]),
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  })
}

async function getPositionControlContext({
  client,
  marketAddress,
  session,
  tradePositionAddress,
}: {
  client: SolanaClient
  marketAddress: Address
  session: WalletSession
  tradePositionAddress: Address
}) {
  const [marketAccount, tradePositionAccount] = await Promise.all([
    fetchMarket(client.runtime.rpc, marketAddress, {
      commitment: 'confirmed',
    }),
    fetchTradePosition(client.runtime.rpc, tradePositionAddress, {
      commitment: 'confirmed',
    }),
  ])
  const tradePosition = tradePositionAccount.data
  const walletAddress = session.account.address.toString()

  if (tradePosition.market !== marketAddress) {
    throw new Error('Trade position belongs to a different market.')
  }
  if (
    tradePosition.authority.toString() !== walletAddress &&
    tradePosition.operator.toString() !== walletAddress
  ) {
    throw new Error('This wallet is not allowed to control the position.')
  }

  return {
    market: marketAccount.data,
    tradePosition,
  }
}

async function derivePositionReferenceAccounts({
  bookkeepingLastUpdateSlot,
  currentSlot,
  endSlotInterval,
  marketAddress,
}: {
  bookkeepingLastUpdateSlot: bigint
  currentSlot: number
  endSlotInterval: number
  marketAddress: Address
}) {
  const referenceIndex = getApprovalSafeReferenceIndex(
    currentSlot,
    bookkeepingLastUpdateSlot,
    endSlotInterval,
  )
  const previousIndex = getPreviousIndex(referenceIndex)
  const [currentInterval, previousInterval] = await Promise.all([
    deriveMarketIntervalAddress(marketAddress, referenceIndex),
    deriveMarketIntervalAddress(marketAddress, previousIndex),
  ])

  return {
    currentInterval,

    previousInterval,

    referenceIndex,
  }
}

export async function sendPauseTradePosition({
  client,
  request,
  sendTransaction,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    tradePositionAddress: Address
  }
  sendTransaction: SendTransactionHelper
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const { marketAddress, tradePositionAddress } = request
  const walletSigner = createWalletTransactionSigner(session).signer
  const { market, tradePosition } = await getPositionControlContext({
    client,
    marketAddress,
    session,
    tradePositionAddress,
  })

  if (tradePosition.pausedAtSlot > 0n) {
    throw new Error('This position is already paused.')
  }

  const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
    detectTokenProgram(client.runtime, market.baseMint, 'confirmed'),
    detectTokenProgram(client.runtime, market.quoteMint, 'confirmed'),
  ])
  const currentSlot = Number(
    await client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
  )
  if (BigInt(currentSlot) >= getTradePositionEndSlot(tradePosition)) {
    throw new Error('This position has already ended and cannot be paused.')
  }
  if (BigInt(currentSlot) <= market.startSlot) {
    throw new Error('This market has not started yet.')
  }

  const referenceAccounts = await derivePositionReferenceAccounts({
    bookkeepingLastUpdateSlot: market.bookkeeping.lastUpdateSlot,
    currentSlot,
    endSlotInterval: END_SLOT_INTERVAL,
    marketAddress,
  })
  const futureIndex = getFutureIndex(
    getTradePositionEndSlot(tradePosition),
    END_SLOT_INTERVAL,
  )
  const futureInterval = await deriveMarketIntervalAddress(
    marketAddress,
    futureIndex,
  )
  const instruction = await getPauseTradePositionInstruction({
    baseMint: market.baseMint,
    baseTokenProgram: baseTokenProgram.programAddress,
    currentInterval: referenceAccounts.currentInterval,

    futureInterval,
    market: marketAddress,
    previousInterval: referenceAccounts.previousInterval,

    quoteMint: market.quoteMint,
    quoteTokenProgram: quoteTokenProgram.programAddress,
    referenceIndex: referenceAccounts.referenceIndex,
    signer: walletSigner,
    tradePosition: tradePositionAddress,
  })

  const signature = await sendTransaction.send({
    authority: walletSigner,
    instructions: [instruction],
  })
  const serializedSignature = signature.toString()
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)
  return serializedSignature
}

export async function sendUnpauseTradePosition({
  client,
  request,
  sendTransaction,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    tradePositionAddress: Address
  }
  sendTransaction: SendTransactionHelper
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const { marketAddress, tradePositionAddress } = request
  const walletSigner = createWalletTransactionSigner(session).signer
  const { market, tradePosition } = await getPositionControlContext({
    client,
    marketAddress,
    session,
    tradePositionAddress,
  })

  if (tradePosition.pausedAtSlot === 0n) {
    throw new Error('This position is not paused.')
  }
  if (market.isPaused !== 0) {
    throw new Error('The market is paused. Try resuming the position later.')
  }

  const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
    detectTokenProgram(client.runtime, market.baseMint, 'confirmed'),
    detectTokenProgram(client.runtime, market.quoteMint, 'confirmed'),
  ])
  const currentSlot = Number(
    await client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
  )
  const referenceAccounts = await derivePositionReferenceAccounts({
    bookkeepingLastUpdateSlot: market.bookkeeping.lastUpdateSlot,
    currentSlot,
    endSlotInterval: END_SLOT_INTERVAL,
    marketAddress,
  })
  const oldIndex = getFutureIndex(
    getTradePositionEndSlot(tradePosition),
    END_SLOT_INTERVAL,
  )
  const unpausedEndSlot = getUnpausedEndSlot(
    currentSlot,
    tradePosition.remainingSlots,
    END_SLOT_INTERVAL,
  )
  const futureIndex = getFutureIndex(unpausedEndSlot, END_SLOT_INTERVAL)
  const [oldInterval, futureInterval] = await Promise.all([
    deriveMarketIntervalAddress(marketAddress, oldIndex),
    deriveMarketIntervalAddress(marketAddress, futureIndex),
  ])
  const instruction = await getUnpauseTradePositionInstructionAsync({
    baseMint: market.baseMint,
    baseTokenProgram: baseTokenProgram.programAddress,
    currentInterval: referenceAccounts.currentInterval,

    futureInterval,
    futureIndex,

    market: marketAddress,
    oldInterval,
    previousInterval: referenceAccounts.previousInterval,

    quoteMint: market.quoteMint,
    quoteTokenProgram: quoteTokenProgram.programAddress,
    referenceIndex: referenceAccounts.referenceIndex,
    signer: walletSigner,
    tradePosition: tradePositionAddress,
  })

  const signature = await sendTransaction.send({
    authority: walletSigner,
    instructions: [instruction],
  })
  const serializedSignature = signature.toString()
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)
  return serializedSignature
}

export async function sendWithdrawSwapped({
  client,
  request,
  sendTransaction,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    tradePositionAddress: Address
  }
  sendTransaction: SendTransactionHelper
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const { marketAddress, tradePositionAddress } = request
  const walletSigner = createWalletTransactionSigner(session).signer
  const { market, tradePosition } = await getPositionControlContext({
    client,
    marketAddress,
    session,
    tradePositionAddress,
  })

  const { mint, receiver } = getSwappedPositionAsset(market, tradePosition)
  const tokenProgram = await detectTokenProgram(
    client.runtime,
    mint,
    'confirmed',
  )
  const currentSlot = Number(
    await client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
  )
  if (
    tradePosition.pausedAtSlot === 0n &&
    BigInt(currentSlot) >= getTradePositionEndSlot(tradePosition)
  ) {
    throw new Error(
      'This position has already ended. Close it to receive the remaining funds.',
    )
  }
  if (BigInt(currentSlot) <= market.startSlot) {
    throw new Error('This market has not started yet.')
  }
  const referenceAccounts = await derivePositionReferenceAccounts({
    bookkeepingLastUpdateSlot: market.bookkeeping.lastUpdateSlot,
    currentSlot,
    endSlotInterval: END_SLOT_INTERVAL,
    marketAddress,
  })
  const isNative = mint.toString() === WRAPPED_SOL_MINT
  const receiverTokenAccount = isNative
    ? await deriveTemporaryWithdrawTokenAddress(tradePositionAddress)
    : await deriveAssociatedTokenAddress({
        mint,
        owner: receiver,
        tokenProgram: tokenProgram.programAddress,
      })
  const withdrawInstruction = await getWithdrawSwappedInstructionAsync({
    programConfig: await deriveProgramConfigAddress(),
    currentInterval: referenceAccounts.currentInterval,

    market: marketAddress,
    mint,
    previousInterval: referenceAccounts.previousInterval,

    receiver,
    receiverTokenAccount,
    referenceIndex: referenceAccounts.referenceIndex,
    signer: walletSigner,
    tokenProgram: tokenProgram.programAddress,
    tradePosition: tradePositionAddress,
  })
  const createReceiverInstruction = isNative
    ? null
    : getCreateAssociatedTokenIdempotentInstruction({
        ata: receiverTokenAccount,
        mint,
        owner: receiver,
        payer: walletSigner,
        tokenProgram: tokenProgram.programAddress,
      })
  const instructions = createReceiverInstruction
    ? [createReceiverInstruction, withdrawInstruction]
    : [withdrawInstruction]

  const signature = await sendTransaction.send({
    authority: walletSigner,
    instructions,
  })
  const serializedSignature = signature.toString()
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)
  return serializedSignature
}

export async function sendClosePosition({
  client,
  request,
  sendTransaction,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    tradePositionAddress: Address
  }
  sendTransaction: SendTransactionHelper
  session: WalletSession
}) {
  assertTransactionsEnabled()
  return sendClosePositions({
    client,
    request: {
      marketAddress: request.marketAddress,
      tradePositionAddresses: [request.tradePositionAddress],
    },
    sendTransaction,
    session,
  })
}

// Share the exact close instructions between the review simulation and submission.
export async function prepareClosePositionInstructions({
  client,
  request,
  authority,
}: {
  client: SolanaClient
  request: { marketAddress: Address; tradePositionAddresses: Array<Address> }
  authority: TransactionSigner
}) {
  const { marketAddress, tradePositionAddresses } = request
  if (tradePositionAddresses.length === 0) {
    throw new Error('Select at least one position to close.')
  }
  if (
    tradePositionAddresses.length > MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION
  ) {
    throw new Error(
      `Close up to ${MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION} positions at once.`,
    )
  }

  const [marketAccount, tradePositionAccounts, currentSlot] = await Promise.all(
    [
      fetchMarket(client.runtime.rpc, marketAddress, {
        commitment: 'confirmed',
      }),
      Promise.all(
        tradePositionAddresses.map((tradePositionAddress) =>
          fetchTradePosition(client.runtime.rpc, tradePositionAddress, {
            commitment: 'confirmed',
          }),
        ),
      ),
      client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
    ],
  )

  const [baseTokenProgram, quoteTokenProgram] = await Promise.all([
    detectTokenProgram(
      client.runtime,
      marketAccount.data.baseMint,
      'confirmed',
    ),
    detectTokenProgram(
      client.runtime,
      marketAccount.data.quoteMint,
      'confirmed',
    ),
  ])

  const referenceIndex = getApprovalSafeReferenceIndex(
    Number(currentSlot),
    marketAccount.data.bookkeeping.lastUpdateSlot,
    END_SLOT_INTERVAL,
  )
  const previousIndex = getPreviousIndex(referenceIndex)

  const [currentInterval, previousInterval] = await Promise.all([
    deriveMarketIntervalAddress(marketAddress, referenceIndex),
    deriveMarketIntervalAddress(marketAddress, previousIndex),
  ])

  const closeInstructions = await Promise.all(
    tradePositionAccounts.map(async (tradePositionAccount, index) => {
      const tradePositionAddress = tradePositionAddresses[index]
      if (!tradePositionAddress) {
        throw new Error('Failed to resolve position address.')
      }

      const tradePosition = tradePositionAccount.data
      if (tradePosition.authority !== authority.address) {
        throw new Error('This wallet does not control the position.')
      }
      if (tradePosition.market !== marketAddress) {
        throw new Error('Trade position belongs to a different market.')
      }
      const futureIndex = getFutureIndex(
        getTradePositionEndSlot(tradePosition),
        END_SLOT_INTERVAL,
      )
      const futureInterval = await deriveMarketIntervalAddress(
        marketAddress,
        futureIndex,
      )
      const interval = await fetchMarketInterval(
        client.runtime.rpc,
        futureInterval,
        { commitment: 'confirmed' },
      )
      if (
        interval.data.market !== marketAddress ||
        interval.data.index !== futureIndex
      ) {
        throw new Error(
          'The position settlement interval does not match its market.',
        )
      }

      return getAuthorityCloseTradePositionInstructionAsync({
        programConfig: await deriveProgramConfigAddress(),
        authority,
        baseMint: marketAccount.data.baseMint,
        baseReceiver: tradePosition.baseReceiver,
        baseTokenProgram: baseTokenProgram.programAddress,
        currentInterval,

        futureInterval,

        market: marketAddress,
        payer: tradePosition.payer,
        previousInterval,

        quoteMint: marketAccount.data.quoteMint,
        quoteReceiver: tradePosition.quoteReceiver,
        quoteTokenProgram: quoteTokenProgram.programAddress,
        referenceIndex,
        tradePosition: tradePositionAddress,
      })
    }),
  )

  return {
    instructions: closeInstructions,
    marketAccount,
    tradePositionAccounts,
    currentSlot,
  }
}

export async function sendClosePositions({
  client,
  request,
  sendTransaction,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    tradePositionAddresses: Array<Address>
  }
  sendTransaction: SendTransactionHelper
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const walletSigner = createWalletTransactionSigner(session).signer
  const { instructions: closeInstructions, marketAccount } =
    await prepareClosePositionInstructions({
      client,
      request,
      authority: walletSigner,
    })

  const unwrapInstructions =
    marketAccount.data.baseMint === WRAPPED_SOL_MINT ||
    marketAccount.data.quoteMint === WRAPPED_SOL_MINT
      ? (
          await client.wsol.prepareUnwrap({
            authority: walletSigner,
            commitment: 'confirmed',
            owner: session.account.address,
          })
        ).message.instructions
      : []

  const signature = await sendTransaction.send({
    authority: walletSigner,
    instructions: [...closeInstructions, ...unwrapInstructions],
  })
  const serializedSignature = signature.toString()
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)
  return serializedSignature
}

export async function sendReclaimRent({
  client,
  request,
  session,
}: {
  client: SolanaClient
  request: {
    marketAddress: Address
    maxAccounts: number
  }
  session: WalletSession
}) {
  assertTransactionsEnabled()
  const { marketAddress, maxAccounts } = request
  const walletSigner = createWalletTransactionSigner(session).signer
  const ownerAddress = session.account.address
  const owner = ownerAddress.toString()

  const [currentSlot, marketAccount, ownedIntervals] = await Promise.all([
    client.runtime.rpc.getSlot({ commitment: 'confirmed' }).send(),
    fetchMarket(client.runtime.rpc, marketAddress, { commitment: 'confirmed' }),
    fetchOwnedMarketIntervals(client.runtime.rpc, owner),
  ])
  const intervalAccounts: Array<IntervalRentAccount> = ownedIntervals.map(
    (account) => ({
      address: account.address,
      index: account.data.index,
      lamports: account.lamports,
      market: account.data.market,
      openPositions: account.data.openPositions,
      payer: account.data.payer,
    }),
  )
  const { currentInterval, previousInterval, referenceIndex } =
    await derivePositionReferenceAccounts({
      currentSlot: Number(currentSlot),
      endSlotInterval: END_SLOT_INTERVAL,
      marketAddress,
      bookkeepingLastUpdateSlot: marketAccount.data.bookkeeping.lastUpdateSlot,
    })
  const closeableIntervals = collectCloseableMarketIntervals({
    currentSlot,
    endSlotInterval: END_SLOT_INTERVAL,
    intervalAccounts,
    maxAccounts,
    market: marketAddress,
    payer: ownerAddress,
  })
  if (!closeableIntervals.length)
    throw new Error('No reclaimable rent accounts available.')
  const reclaimedLamports = closeableIntervals.reduce(
    (sum, account) => sum + account.lamports,
    0n,
  )
  const instructions = closeableIntervals.map((account) =>
    getCloseMarketIntervalInstruction({
      signer: walletSigner,
      payer: account.payer,
      marketInterval: account.address,
      market: marketAddress,
      currentInterval,
      previousInterval,
      referenceIndex,
    }),
  )

  const { value: blockhashLifetime } = await client.runtime.rpc
    .getLatestBlockhash({ commitment: 'confirmed' })
    .send()

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (message) => setTransactionMessageFeePayerSigner(walletSigner, message),
    (message) =>
      setTransactionMessageLifetimeUsingBlockhash(blockhashLifetime, message),
    (message) => appendTransactionMessageInstructions(instructions, message),
  )

  let serializedSignature: string
  if (isTransactionMessageWithSingleSendingSigner(transactionMessage)) {
    const signatureBytes =
      await signAndSendTransactionMessageWithSigners(transactionMessage)
    serializedSignature = getBase58Decoder().decode(signatureBytes)
  } else {
    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage)
    const blockhashBackedTransaction = signedTransaction as Parameters<
      typeof client.actions.sendTransaction
    >[0]
    const signature = await client.actions.sendTransaction(
      blockhashBackedTransaction,
      'confirmed',
    )
    serializedSignature = signature.toString()
  }
  await waitForConfirmedSignature(client.runtime.rpc, serializedSignature)

  return {
    reclaimedLamports,
    signature: serializedSignature,
  }
}
