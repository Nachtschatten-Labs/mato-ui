import { useEffect, useMemo, useState } from 'react'
import { useWalletConnection, useWalletSession } from '@solana/react-hooks'
import {
  AlertTriangle,
  ChartCandlestick,
  ChartLine,
  ListOrdered,
  RefreshCcw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CHART_RANGES,
  DEFAULT_MARKET_UPDATES_LIMIT,
  HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT,
  MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
  MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
  NATIVE_FEE_BUFFER_ATOMS,
  NATIVE_SOL_DECIMALS,
  POSITION_PAGE_SIZE,
  getMarketDefinition,
} from '../constants'
import {
  atomsFromPercent,
  durationToSlots,
  formatAtomsToInput,
  isNativeBalanceBelowTransactionMinimum,
  parseTokenAmount,
  sanitizeAmountInput,
  toSliderPercent,
} from '../lib/amounts'
import {
  isEndedPosition,
  selectBatchClosePositions,
} from '../lib/batch-close-positions'
import {
  formatAtoms,
  formatExplorerTransactionUrl,
  formatUiAmount,
} from '../lib/format'
import { clampPage, getPageCount, getPageItems } from '../lib/pagination'
import { isHighPriceImpact } from '../lib/price-impact'
import { formatSmartDuration } from '../lib/duration-label'
import { useMarketAddress } from '../hooks/use-market-address'
import { useMarketChartHistory } from '../hooks/use-market-chart-history'
import { useMarketPrice } from '../hooks/use-market-price'
import { useMarketPriceChange24h } from '../hooks/use-market-price-change'
import { useMarketUpdates } from '../hooks/use-market-updates'
import { useMarketTradePositions } from '../hooks/use-market-trade-positions'
import { useStreamingMarketState } from '../hooks/use-streaming-market-state'
import { useTradePositions } from '../hooks/use-trade-positions'
import { useWalletSolBalance } from '../hooks/use-wallet-sol-balance'
import { useWalletTokenBalance } from '../hooks/use-wallet-token-balance'
import { useSubmitOrder } from '../hooks/use-submit-order'
import { useOrderDuration } from '../hooks/use-order-duration'
import { useClosePosition } from '../hooks/use-close-position'
import { usePositionControls } from '../hooks/use-position-controls'
import { useReclaimRent } from '../hooks/use-reclaim-rent'
import {
  buildTradingDashboardViewModel,
  formatDashboardPrice,
} from '../view-models/trading-dashboard'
import { ClosedPositionsList } from './closed-positions-list'
import { isReadApiConfigured } from '../api/read-api'
import { MarketPriceChart } from './market-price-chart'
import { OrderEntryCard } from './order-entry-card'
import { OrderBookTable } from './order-book-table'
import { ActivePositionCard } from './active-position-card'
import { BatchCloseReview } from './batch-close-review'
import { HighPriceImpactDialog } from './high-price-impact-dialog'
import { PositionPagination } from './position-pagination'
import { PositionCompletionNotifications } from './position-completion-notifications'
import { ReclaimRentBanner } from './reclaim-rent-banner'
import { MarketSelector } from './market-selector'
import { useMarketOverview } from '../hooks/use-market-overview'
import type { ReactNode } from 'react'
import type {
  ChartCrosshairData,
  ChartDisplayMode,
  ChartHistoryRequest,
} from './market-price-chart'
import type { ChartPositionOverlay } from '../lib/chart-positions'
import type {
  ChartTimeframe,
  MarketId,
  MarketPanelTab,
  OrderSide,
  PositionPanelTab,
} from '../constants'
import type { TradePositionRecord } from '../domain/models'
import type { TradingViewAggregatedCandle } from '../lib/market'
import { endpoint } from '@/integrations/solana'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CHART_DISPLAY_MODES = [
  { icon: ChartCandlestick, label: 'Candles', mode: 'candles' },
  { icon: ChartLine, label: 'Line', mode: 'line' },
] as const
const MARKET_PANEL_TABS = [
  { icon: ChartCandlestick, label: 'Chart', tab: 'chart' },
  { icon: ListOrdered, label: 'Order book', tab: 'order-book' },
] as const satisfies Array<{
  icon: typeof ChartCandlestick
  label: string
  tab: MarketPanelTab
}>
export function TradingDashboard({
  marketId,
  onMarketChange,
}: {
  marketId: MarketId
  onMarketChange: (marketId: MarketId) => void
}) {
  const session = useWalletSession()
  const walletConnection = useWalletConnection()
  const address = session?.account.address.toString() ?? null
  const [marketPanelTab, setMarketPanelTab] = useState<MarketPanelTab>('chart')
  const selectedMarket = getMarketDefinition(marketId)

  const marketAddressQuery = useMarketAddress(marketId)
  const marketAddress = marketAddressQuery.data
  const marketPriceQuery = useMarketPrice(marketId)
  const marketPriceChange24hQuery = useMarketPriceChange24h(marketId)
  const marketUpdates = useMarketUpdates({
    limit: DEFAULT_MARKET_UPDATES_LIMIT,
    marketId: marketId,
  })
  const streamingStateQuery = useStreamingMarketState(marketAddress)
  const tradePositionsQuery = useTradePositions(address, marketAddress)
  const shouldLoadOrderBookPositions = marketPanelTab === 'order-book'
  const orderBookPositionsQuery = useMarketTradePositions(
    marketAddress,
    shouldLoadOrderBookPositions,
  )

  const [batchCloseReview, setBatchCloseReview] = useState<{
    positions: TradePositionRecord[]
    validationId: string
  } | null>(null)
  const [side, setSide] = useState<OrderSide>('buy')
  const [marketSelectorOpen, setMarketSelectorOpen] = useState(false)
  const marketOverview = useMarketOverview(marketSelectorOpen)
  const [amountInput, setAmountInput] = useState('')
  const [positionPanelTab, setPositionPanelTab] =
    useState<PositionPanelTab>('active')
  const [activePositionPage, setActivePositionPage] = useState(0)
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5m')
  const [chartDisplayMode, setChartDisplayMode] =
    useState<ChartDisplayMode>('line')
  const [chartResetSignal, setChartResetSignal] = useState(0)
  const [highPriceImpactDialogOpen, setHighPriceImpactDialogOpen] =
    useState(false)
  const [crosshairData, setCrosshairData] = useState<ChartCrosshairData | null>(
    null,
  )

  const submitOrder = useSubmitOrder()
  const closePosition = useClosePosition()
  const positionControls = usePositionControls()
  const reclaimRent = useReclaimRent(walletConnection.connected, marketId)

  const {
    baseDecimals,
    baseMint,
    baseSymbol: baseTicker,
    quoteDecimals,
    quoteMint,
    quoteSymbol: quoteTicker,
  } = selectedMarket
  const marketChartHistory = useMarketChartHistory({
    latestPrice: marketPriceQuery.data ?? null,
    marketId: marketId,
    timeframe: chartTimeframe,
  })

  const baseBalance = useWalletTokenBalance(baseMint, baseDecimals || 9)
  const quoteBalance = useWalletTokenBalance(quoteMint, quoteDecimals || 9)
  const nativeSolBalance = useWalletSolBalance()

  const selectedBalance = side === 'sell' ? baseBalance : quoteBalance
  const receiveBalance = side === 'buy' ? baseBalance : quoteBalance
  const receiveBalanceDisplay = receiveBalance.balanceUi
  const amountTokenTicker = side === 'sell' ? baseTicker : quoteTicker
  const amountDecimals = side === 'sell' ? baseDecimals : quoteDecimals
  const onChainMarket = streamingStateQuery.data ?? null
  const marketConfigurationMismatch = Boolean(
    onChainMarket &&
    (onChainMarket.marketId !== marketId ||
      onChainMarket.baseMint.toString() !== baseMint ||
      onChainMarket.quoteMint.toString() !== quoteMint),
  )
  const isMarketReady = Boolean(onChainMarket && !marketConfigurationMismatch)
  const isMarketPaused = onChainMarket?.isPaused ?? false
  const minimumTradeAmountAtoms =
    side === 'sell'
      ? (onChainMarket?.minimumBaseDepositAtoms ??
        selectedMarket.minimumBaseDepositAtoms)
      : (onChainMarket?.minimumQuoteDepositAtoms ??
        selectedMarket.minimumQuoteDepositAtoms)
  const availableAtoms = selectedBalance.spendableAtoms
  const amountAtoms = useMemo(
    () => parseTokenAmount(amountInput, amountDecimals),
    [amountDecimals, amountInput],
  )
  const {
    durationSeconds,
    recommendedDurationSeconds,
    onDurationChange,
    onResetDuration,
    isCustomDuration,
  } = useOrderDuration({
    amountAtoms,
    side,
    streamingState: isMarketReady ? onChainMarket : null,
    marketKey: marketId,
  })
  const durationUnavailableMessage =
    amountAtoms !== null && amountAtoms > 0n && durationSeconds === null
      ? !isMarketReady
        ? 'Waiting for market liquidity…'
        : 'No duration below 0.01% impact is available with current liquidity. Try a smaller amount or choose a custom duration.'
      : null
  const sliderValue = useMemo(
    () => toSliderPercent(amountAtoms, availableAtoms),
    [amountAtoms, availableAtoms],
  )
  const amountExceedsAvailable =
    amountAtoms !== null && amountAtoms > availableAtoms
  const amountBelowMinimum =
    amountAtoms !== null &&
    amountAtoms > 0n &&
    amountAtoms < minimumTradeAmountAtoms
  const availableAmountDisplay = Number(availableAtoms) / 10 ** amountDecimals
  const minimumAmountDisplay = formatAtoms(
    minimumTradeAmountAtoms,
    amountDecimals,
  )
  const amountValidationMessage = amountExceedsAvailable
    ? `Amount exceeds available balance. You have ${formatUiAmount(
        availableAmountDisplay,
      )} ${amountTokenTicker}.`
    : amountBelowMinimum
      ? `Minimum order size is ${minimumAmountDisplay} ${amountTokenTicker}.`
      : null
  const hasLowSubmitNativeSolBalance =
    walletConnection.connected &&
    isNativeBalanceBelowTransactionMinimum(nativeSolBalance.lamports)
  const hasLowMaintenanceNativeSolBalance =
    walletConnection.connected &&
    isNativeBalanceBelowTransactionMinimum(
      nativeSolBalance.lamports,
      MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
    )
  const requiredSubmitNativeSolDisplay = formatAtoms(
    NATIVE_FEE_BUFFER_ATOMS,
    NATIVE_SOL_DECIMALS,
  )
  const requiredMaintenanceNativeSolDisplay = formatAtoms(
    MAINTENANCE_TRANSACTION_FEE_BUFFER_ATOMS,
    NATIVE_SOL_DECIMALS,
  )
  const nativeSolBalanceDisplay =
    nativeSolBalance.lamports === null
      ? null
      : formatAtoms(nativeSolBalance.lamports, NATIVE_SOL_DECIMALS)
  const lowSubmitNativeSolWarning = hasLowSubmitNativeSolBalance
    ? `Your wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before submitting orders; at least ${requiredSubmitNativeSolDisplay} SOL is required for fees and rent.`
    : null
  const lowMaintenanceNativeSolWarning = hasLowMaintenanceNativeSolBalance
    ? `Your wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before updating positions; at least ${requiredMaintenanceNativeSolDisplay} SOL is required for fees.`
    : null
  const lowPositionRentNativeSolWarning = hasLowSubmitNativeSolBalance
    ? `Your wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before updating this position; at least ${requiredSubmitNativeSolDisplay} SOL is required for fees and possible account rent.`
    : null
  const lowReclaimRentNativeSolWarning = hasLowMaintenanceNativeSolBalance
    ? `Your wallet has ${nativeSolBalanceDisplay} SOL. Add SOL before reclaiming rent; at least ${requiredMaintenanceNativeSolDisplay} SOL is required for fees.`
    : null

  const amountUiValue = useMemo(() => {
    if (!amountAtoms || amountAtoms <= 0n) return null
    return Number(amountAtoms) / 10 ** amountDecimals
  }, [amountAtoms, amountDecimals])

  const activePositions = useMemo<Array<TradePositionRecord>>(
    () => tradePositionsQuery.data ?? [],
    [tradePositionsQuery.data],
  )
  const orderBookPositions = useMemo<Array<TradePositionRecord>>(
    () => orderBookPositionsQuery.data ?? [],
    [orderBookPositionsQuery.data],
  )
  const activePositionPageCount = getPageCount(
    activePositions.length,
    POSITION_PAGE_SIZE,
  )
  const normalizedActivePositionPage = clampPage(
    activePositionPage,
    activePositions.length,
    POSITION_PAGE_SIZE,
  )
  const paginatedActivePositions = useMemo(
    () =>
      getPageItems({
        items: activePositions,
        page: normalizedActivePositionPage,
        pageSize: POSITION_PAGE_SIZE,
      }),
    [activePositions, normalizedActivePositionPage],
  )
  const currentSlot = streamingStateQuery.data?.currentSlot ?? null
  const isOrderBookLoading =
    shouldLoadOrderBookPositions && orderBookPositionsQuery.isLoading
  const activePositionError =
    tradePositionsQuery.error instanceof Error
      ? tradePositionsQuery.error.message
      : null
  const marketRuntimeError = marketConfigurationMismatch
    ? `Market #${marketId} does not match the verified mainnet configuration.`
    : !onChainMarket && streamingStateQuery.error instanceof Error
      ? 'Unable to reach the mainnet RPC. Please try again shortly.'
      : null
  const chartPositionOverlays: Array<ChartPositionOverlay> = []
  const endedPositions = useMemo(
    () =>
      activePositions.filter((position) =>
        isEndedPosition(position, currentSlot),
      ),
    [activePositions, currentSlot],
  )
  const endedBatchPositions = useMemo(
    () =>
      selectBatchClosePositions({
        currentSlot,
        maxPositions: MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
        mode: 'ended',
        positions: activePositions,
      }),
    [activePositions, currentSlot],
  )
  const allBatchPositions = useMemo(
    () =>
      selectBatchClosePositions({
        currentSlot,
        maxPositions: MAX_BATCH_CLOSE_POSITIONS_PER_TRANSACTION,
        mode: 'all',
        positions: activePositions,
      }),
    [activePositions, currentSlot],
  )
  const dashboardViewModel = useMemo(() => {
    return buildTradingDashboardViewModel({
      amountAtoms,
      amountUiValue,
      baseDecimals,
      baseTicker,
      durationSeconds,
      quoteDecimals,
      quoteTicker,
      referencePricing: {
        baseDecimals: selectedMarket.baseDecimals,
        chartCandles: marketChartHistory.candles,
        crosshairData,
        marketPrice: marketPriceQuery.data ?? undefined,
        marketUpdates: marketUpdates.events,
        priceChangeHistory: marketPriceChange24hQuery.data ?? [],
        quoteDecimals: selectedMarket.quoteDecimals,
      },
      side,
      streamingState: isMarketReady ? onChainMarket : null,
      tradePositions: activePositions,
    })
  }, [
    activePositions,
    amountAtoms,
    amountUiValue,
    baseDecimals,
    baseTicker,
    crosshairData,
    durationSeconds,
    marketChartHistory.candles,
    marketPriceQuery.data,
    marketPriceChange24hQuery.data,
    marketUpdates.events,
    isMarketReady,
    onChainMarket,
    quoteDecimals,
    quoteTicker,
    side,
  ])
  const {
    displayPrice,
    estimatedConversionText,
    executionPriceDisplay,
    priceImpactPercent,
    priceImpactDisplay,
    priceChange24hDisplay,
    priceChange24hPercent,
  } = dashboardViewModel
  const chartCandles = marketChartHistory.candles
  const hasHighPriceImpact = isHighPriceImpact(priceImpactPercent)
  const highPriceImpactThresholdDisplay = `${HIGH_PRICE_IMPACT_WARNING_THRESHOLD_PERCENT}%`
  const priceImpactWarningText = hasHighPriceImpact
    ? `Price impact is above ${highPriceImpactThresholdDisplay}. Review the execution price before submitting.`
    : null

  const submitDisabled =
    !walletConnection.connected ||
    !marketAddress ||
    !isMarketReady ||
    isMarketPaused ||
    !amountAtoms ||
    amountAtoms <= 0n ||
    durationSeconds === null ||
    !onChainMarket ||
    onChainMarket.marketBaseFlow <= 0n ||
    onChainMarket.marketQuoteFlow <= 0n ||
    amountBelowMinimum ||
    amountExceedsAvailable ||
    hasLowSubmitNativeSolBalance ||
    submitOrder.isSubmitting

  const submitStatusLabel = !walletConnection.connected
    ? 'Connect wallet to stream'
    : submitOrder.status === 'building'
      ? 'Building order...'
      : submitOrder.status === 'wrapping'
        ? 'Wrapping SOL...'
        : submitOrder.status === 'submitting'
          ? 'Submitting order...'
          : amountExceedsAvailable
            ? 'Amount exceeds balance'
            : amountBelowMinimum
              ? 'Amount too small'
              : !isMarketReady
                ? marketRuntimeError
                  ? 'Market unavailable'
                  : 'Loading market...'
                : isMarketPaused
                  ? 'Market paused'
                  : hasLowSubmitNativeSolBalance
                    ? 'Add SOL to submit'
                    : !amountAtoms || amountAtoms <= 0n
                      ? 'Enter an amount'
                      : durationSeconds === null ||
                          !onChainMarket ||
                          onChainMarket.marketBaseFlow <= 0n ||
                          onChainMarket.marketQuoteFlow <= 0n
                        ? 'Smart fill unavailable'
                        : hasHighPriceImpact
                          ? 'Review price impact'
                          : `${side === 'buy' ? 'Buy' : 'Sell'} over the next ${formatSmartDuration(durationSeconds)}`

  useEffect(() => {
    setAmountInput('')
    setActivePositionPage(0)
    setPositionPanelTab('active')
    setHighPriceImpactDialogOpen(false)
  }, [marketId])

  useEffect(() => {
    setActivePositionPage((current) =>
      clampPage(current, activePositions.length, POSITION_PAGE_SIZE),
    )
  }, [activePositions.length])

  useEffect(() => {
    if (!hasHighPriceImpact || submitDisabled) {
      setHighPriceImpactDialogOpen(false)
    }
  }, [hasHighPriceImpact, submitDisabled])

  useEffect(() => {
    const signature = submitOrder.signature
    if (submitOrder.status !== 'success' || !signature) return

    toast.success('Order submitted', {
      action: {
        label: 'View',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
      description: 'The transaction was confirmed.',
      id: `submit-order-success-${signature}`,
    })
  }, [submitOrder.signature, submitOrder.status])

  useEffect(() => {
    if (!submitOrder.error) return

    toast.error('Order failed', {
      description: submitOrder.error,
      id: 'submit-order-error',
    })
  }, [submitOrder.error])

  useEffect(() => {
    const signature = closePosition.signature
    if (closePosition.status !== 'success' || !signature) return
    const closedCount = closePosition.closedCount

    toast.success(closedCount > 1 ? 'Positions closed' : 'Position closed', {
      action: {
        label: 'View',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
      description:
        closedCount > 1
          ? `${closedCount} positions were closed.`
          : 'The close transaction was confirmed.',
      id: `close-position-success-${signature}`,
    })
  }, [closePosition.closedCount, closePosition.signature, closePosition.status])

  useEffect(() => {
    if (!closePosition.error) return

    toast.error('Close failed', {
      description: closePosition.error,
      id: 'close-position-error',
    })
  }, [closePosition.error])

  useEffect(() => {
    const signature = positionControls.signature
    const action = positionControls.action
    if (
      positionControls.status !== 'success' ||
      !signature ||
      action === null
    ) {
      return
    }

    const title =
      action === 'pause'
        ? 'Position paused'
        : action === 'resume'
          ? 'Position resumed'
          : 'Swapped funds withdrawn'
    const description =
      action === 'pause'
        ? 'The position has stopped streaming.'
        : action === 'resume'
          ? 'The position is streaming again.'
          : 'Available swapped funds were sent to the position receiver.'

    toast.success(title, {
      action: {
        label: 'View',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
      description,
      id: `position-control-success-${signature}`,
    })
  }, [
    positionControls.action,
    positionControls.signature,
    positionControls.status,
  ])

  useEffect(() => {
    if (!positionControls.error) return

    const title =
      positionControls.action === 'withdraw'
        ? 'Withdraw failed'
        : 'Position update failed'
    toast.error(title, {
      description: positionControls.error,
      id: 'position-control-error',
    })
  }, [positionControls.action, positionControls.error])

  useEffect(() => {
    const signature = reclaimRent.signature
    if (reclaimRent.status !== 'success' || !signature) return

    toast.success('Rent reclaimed', {
      action: {
        label: 'View',
        onClick: () => {
          window.open(
            formatExplorerTransactionUrl(signature, endpoint),
            '_blank',
            'noopener,noreferrer',
          )
        },
      },
      description: `Reclaimed ${formatAtoms(
        reclaimRent.reclaimedLamports,
        NATIVE_SOL_DECIMALS,
      )} SOL.`,
      id: `reclaim-rent-success-${signature}`,
    })
  }, [reclaimRent.reclaimedLamports, reclaimRent.signature, reclaimRent.status])

  useEffect(() => {
    if (!reclaimRent.error) return

    toast.error('Rent reclaim failed', {
      description: reclaimRent.error,
      id: 'reclaim-rent-error',
    })
  }, [reclaimRent.error])

  const refreshBalances = async () => {
    await Promise.allSettled([
      baseBalance.refresh(),
      nativeSolBalance.refresh(),
      quoteBalance.refresh(),
    ])
  }

  const handleNeedOlderChartHistory = ({
    visibleBarCount,
  }: ChartHistoryRequest) => {
    void marketChartHistory.loadOlderHistory({
      visibleBarCount,
    })
  }

  const handleSliderChange = (percent: number) => {
    if (availableAtoms <= 0n) {
      setAmountInput('')
      return
    }

    const nextAmountAtoms = atomsFromPercent(availableAtoms, percent)
    setAmountInput(formatAtomsToInput(nextAmountAtoms, amountDecimals))
  }

  const handleSubmit = async () => {
    if (!marketAddress) {
      toast.error('Order not ready', {
        description: 'Market address is still loading.',
        id: 'order-validation',
      })
      return
    }
    if (!isMarketReady) {
      toast.error('Order not ready', {
        description: marketRuntimeError ?? 'Market data is still loading.',
        id: 'order-validation',
      })
      return
    }
    if (isMarketPaused) {
      toast.error('Order not ready', {
        description: 'This market is currently paused.',
        id: 'order-validation',
      })
      return
    }
    if (!amountAtoms || amountAtoms <= 0n) {
      toast.error('Order not ready', {
        description: `Enter a valid ${amountTokenTicker} amount.`,
        id: 'order-validation',
      })
      return
    }
    if (amountAtoms > availableAtoms) {
      toast.error('Order not ready', {
        description: `Amount exceeds available ${amountTokenTicker} balance.`,
        id: 'order-validation',
      })
      return
    }
    if (amountAtoms < minimumTradeAmountAtoms) {
      toast.error('Order not ready', {
        description: `Minimum order size is ${minimumAmountDisplay} ${amountTokenTicker}.`,
        id: 'order-validation',
      })
      return
    }
    if (lowSubmitNativeSolWarning) {
      toast.warning('Not enough SOL', {
        description: lowSubmitNativeSolWarning,
        id: 'order-validation',
      })
      return
    }

    if (
      durationSeconds === null ||
      !onChainMarket ||
      onChainMarket.marketBaseFlow <= 0n ||
      onChainMarket.marketQuoteFlow <= 0n
    ) {
      toast.error('Order not ready', {
        description:
          durationUnavailableMessage ?? 'Market liquidity is unavailable.',
        id: 'order-validation',
      })
      return
    }

    const durationSlots = durationToSlots(durationSeconds)
    const success = await submitOrder.submitOrder({
      amount: amountAtoms,
      durationSlots,
      existingWrappedAtoms: selectedBalance.existingWrappedAtoms,
      id: crypto.getRandomValues(new Uint32Array(1))[0],
      inputMintAddress: side === 'buy' ? quoteMint : baseMint,
      isBuy: side === 'buy',
      marketAddress,
    })

    if (success) {
      setAmountInput('')
    }
    await refreshBalances()
  }

  const handleSubmitRequest = async () => {
    if (hasHighPriceImpact) {
      setHighPriceImpactDialogOpen(true)
      return
    }

    await handleSubmit()
  }

  const handleConfirmHighPriceImpact = async () => {
    setHighPriceImpactDialogOpen(false)
    await handleSubmit()
  }

  const handleBatchClosePositions = async ({
    positions,
    validationId,
  }: {
    positions: Array<TradePositionRecord>
    validationId: string
  }) => {
    if (!marketAddress) {
      toast.error('Positions not ready', {
        description: 'Market address is still loading.',
        id: validationId,
      })
      return false
    }
    if (positions.length === 0) {
      toast.error('Positions not ready', {
        description: 'There are no matching positions to close.',
        id: validationId,
      })
      return false
    }
    if (lowMaintenanceNativeSolWarning) {
      toast.warning('Not enough SOL', {
        description: lowMaintenanceNativeSolWarning,
        id: validationId,
      })
      return false
    }

    const success = await closePosition.closePositions({
      marketAddress,
      tradePositionAddresses: positions.map((position) => position.address),
    })
    if (success) {
      await refreshBalances().catch(() => undefined)
    }
    return success
  }

  const handleReclaimRent = async () => {
    if (lowReclaimRentNativeSolWarning) {
      toast.warning('Not enough SOL', {
        description: lowReclaimRentNativeSolWarning,
        id: 'reclaim-rent-validation',
      })
      return
    }

    const success = await reclaimRent.reclaimRent()
    if (success) {
      await nativeSolBalance.refresh()
    }
  }

  const isMarketChangeDisabled =
    submitOrder.isSubmitting ||
    closePosition.isClosing ||
    positionControls.isPending ||
    reclaimRent.isReclaiming

  return (
    <main className="mx-auto min-h-[calc(100dvh-7rem)] max-w-[1400px] px-4 pb-12 pt-2 text-foreground sm:px-6">
      {address &&
      marketAddress &&
      isMarketReady &&
      onChainMarket &&
      tradePositionsQuery.data !== undefined ? (
        <PositionCompletionNotifications
          key={`${address}:${marketAddress}`}
          baseDecimals={baseDecimals}
          baseTicker={baseTicker}
          marketAddress={marketAddress}
          positions={activePositions}
          quoteDecimals={quoteDecimals}
          quoteTicker={quoteTicker}
          streamingState={onChainMarket}
        />
      ) : null}
      <h1 className="sr-only">
        Trade {baseTicker}/{quoteTicker}
      </h1>
      <div>
        {marketRuntimeError ? (
          <Alert className="mb-5 flex items-start gap-3 border-destructive/35 bg-destructive/10 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Market #{marketId} is unavailable: {marketRuntimeError}
            </span>
          </Alert>
        ) : null}

        {lowSubmitNativeSolWarning ? (
          <Alert className="mb-5 flex items-start gap-3 border-warning/35 bg-warning/10 text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{lowSubmitNativeSolWarning}</span>
          </Alert>
        ) : null}

        <ReclaimRentBanner
          closeableCount={reclaimRent.closeableCount}
          isReclaiming={reclaimRent.isReclaiming}
          nativeSolWarning={lowReclaimRentNativeSolWarning}
          onReclaim={() => void handleReclaimRent()}
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.24fr)_minmax(0,1fr)] lg:gap-8">
          <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-start-1">
            <OrderEntryCard
              amountInput={amountInput}
              amountValidationMessage={amountValidationMessage}
              amountTokenTicker={amountTokenTicker}
              availableAmountDisplay={availableAmountDisplay}
              canSubmit={!submitDisabled}
              durationSeconds={durationSeconds}
              durationUnavailableMessage={durationUnavailableMessage}
              recommendedDurationSeconds={recommendedDurationSeconds}
              isCustomDuration={isCustomDuration}
              estimatedConversionText={estimatedConversionText}
              executionPriceDisplay={executionPriceDisplay}
              isConnected={walletConnection.connected}
              minimumAmountDisplay={minimumAmountDisplay}
              onAmountChange={(value) => {
                setAmountInput(sanitizeAmountInput(value))
              }}
              onDurationChange={onDurationChange}
              onResetDuration={onResetDuration}
              onMaxClick={() => handleSliderChange(100)}
              onPercentSelect={handleSliderChange}
              onSideChange={(nextSide) => {
                setSide(nextSide)
                setAmountInput('')
              }}
              onSliderChange={handleSliderChange}
              onSubmit={() => void handleSubmitRequest()}
              receiveTokenTicker={side === 'buy' ? baseTicker : quoteTicker}
              receiveBalanceDisplay={receiveBalanceDisplay}
              priceImpactDisplay={priceImpactDisplay}
              priceImpactWarningText={priceImpactWarningText}
              selectedPercent={sliderValue}
              side={side}
              statusLabel={submitStatusLabel}
            />
          </div>

          <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 lg:space-y-8">
            <Card>
              <CardContent className="space-y-5 p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <MarketSelector
                      disabled={isMarketChangeDisabled}
                      marketId={marketId}
                      onMarketChange={onMarketChange}
                      onOpenChange={setMarketSelectorOpen}
                      stats={marketOverview.data}
                      isLoading={marketOverview.isLoading}
                      hasError={marketOverview.isError}
                      onRetry={() => void marketOverview.refetch()}
                    />
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">
                        {`${baseTicker}/${quoteTicker}`}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">
                          {formatDashboardPrice(displayPrice)}
                        </span>
                        <PriceChangeBadge
                          display={priceChange24hDisplay}
                          value={priceChange24hPercent}
                        />
                      </div>
                    </div>
                  </div>
                  {marketPanelTab === 'chart' && (
                    <ChartRangeSelector
                      timeframe={chartTimeframe}
                      onChange={setChartTimeframe}
                    />
                  )}
                </div>
                {marketPanelTab === 'chart' ? (
                  <PriceChartPanel
                    chartCandles={chartCandles}
                    chartDisplayMode={chartDisplayMode}
                    chartTimeframe={chartTimeframe}
                    hasMoreHistory={marketChartHistory.hasMoreHistory}
                    isLoadingMoreHistory={
                      marketChartHistory.isLoadingMoreHistory
                    }
                    isMarketUpdatesLoading={marketUpdates.isLoading}
                    marketChartHistoryError={marketChartHistory.error}
                    marketUpdatesError={marketUpdates.error}
                    onCrosshairMove={setCrosshairData}
                    onDisplayModeChange={setChartDisplayMode}
                    onNeedOlderHistory={handleNeedOlderChartHistory}
                    onReset={() =>
                      setChartResetSignal((previous) => previous + 1)
                    }
                    positionOverlayError={null}
                    positionOverlays={chartPositionOverlays}
                    referenceLabel={`${baseTicker}/${quoteTicker}`}
                    resetSignal={chartResetSignal}
                  />
                ) : (
                  <OrderBookTable
                    baseDecimals={baseDecimals}
                    baseTicker={baseTicker}
                    currentSlot={currentSlot}
                    isLoading={isOrderBookLoading}
                    positions={orderBookPositions}
                    quoteDecimals={quoteDecimals}
                    quoteTicker={quoteTicker}
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                  <MarketPanelTabs
                    activeTab={marketPanelTab}
                    onTabChange={setMarketPanelTab}
                  />
                  {marketPanelTab === 'chart' && (
                    <span className="text-[11px] text-muted-foreground">
                      Chart by TradingView
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <section
              aria-label="Your streams"
              className="space-y-5 rounded-[20px] border border-white/[0.06] bg-card/95 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {(['active', 'closed'] as const).map((tab) => (
                    <Button
                      key={tab}
                      aria-pressed={positionPanelTab === tab}
                      className="h-9 rounded-full px-4 text-sm"
                      onClick={() => setPositionPanelTab(tab)}
                      size="sm"
                      variant={positionPanelTab === tab ? 'secondary' : 'ghost'}
                    >
                      {tab === 'active' ? 'Active' : 'Closed'}
                    </Button>
                  ))}
                </div>

                {positionPanelTab === 'active' && activePositions.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      disabled={
                        closePosition.isClosing ||
                        positionControls.isPending ||
                        endedBatchPositions.length === 0
                      }
                      onClick={() => {
                        setBatchCloseReview({
                          positions: endedBatchPositions,
                          validationId: 'batch-close-ended-validation',
                        })
                      }}
                      size="xs"
                      variant="outline"
                    >
                      <X className="size-3.5" />
                      Close ended
                      {formatBatchCloseCount(
                        endedBatchPositions.length,
                        endedPositions.length,
                      )}
                    </Button>
                    <Button
                      className="rounded-full"
                      disabled={
                        closePosition.isClosing ||
                        positionControls.isPending ||
                        allBatchPositions.length === 0
                      }
                      onClick={() => {
                        setBatchCloseReview({
                          positions: allBatchPositions,
                          validationId: 'batch-close-all-validation',
                        })
                      }}
                      size="xs"
                      variant="outline"
                    >
                      <X className="size-3.5" />
                      Close all
                      {formatBatchCloseCount(
                        allBatchPositions.length,
                        activePositions.length,
                      )}
                    </Button>
                  </div>
                ) : null}
              </div>

              {batchCloseReview && marketAddress && (
                <BatchCloseReview
                  positions={batchCloseReview.positions}
                  marketAddress={marketAddress}
                  baseTicker={baseTicker}
                  quoteTicker={quoteTicker}
                  baseDecimals={baseDecimals}
                  quoteDecimals={quoteDecimals}
                  isPending={closePosition.isClosing}
                  onDismiss={() => setBatchCloseReview(null)}
                  onConfirm={() => handleBatchClosePositions(batchCloseReview)}
                />
              )}
              {positionPanelTab === 'active' ? (
                !address ? (
                  <EmptyState copy="Connect a wallet to see your streams." />
                ) : tradePositionsQuery.isLoading &&
                  activePositions.length === 0 ? (
                  <EmptyState copy="Loading active positions..." />
                ) : activePositionError && activePositions.length === 0 ? (
                  <EmptyState
                    copy={`Active positions unavailable: ${activePositionError}`}
                  />
                ) : activePositions.length > 0 && !marketAddress ? (
                  <EmptyState copy="Loading market address..." />
                ) : activePositions.length > 0 && marketAddress ? (
                  <div className="grid gap-4">
                    {paginatedActivePositions.map((position) => (
                      <ActivePositionCard
                        key={position.address}
                        baseDecimals={baseDecimals}
                        baseTicker={baseTicker}
                        isCloseDisabled={
                          closePosition.isClosing || positionControls.isPending
                        }
                        isClosing={closePosition.isClosingPosition(
                          position.address,
                        )}
                        isControlDisabled={
                          closePosition.isClosing || positionControls.isPending
                        }
                        isPausing={positionControls.isPendingAction(
                          position.address,
                          'pause',
                        )}
                        isResuming={positionControls.isPendingAction(
                          position.address,
                          'resume',
                        )}
                        isWithdrawing={positionControls.isPendingAction(
                          position.address,
                          'withdraw',
                        )}
                        marketAddress={marketAddress}
                        onClose={async (tradePositionAddress) => {
                          if (lowMaintenanceNativeSolWarning) {
                            toast.warning('Not enough SOL', {
                              description: lowMaintenanceNativeSolWarning,
                              id: 'close-position-validation',
                            })
                            return false
                          }

                          const success = await closePosition.closePosition({
                            marketAddress,
                            tradePositionAddress,
                          })
                          if (success) {
                            await refreshBalances().catch(() => undefined)
                          }
                          return success
                        }}
                        onPauseToggle={async (tradePositionAddress) => {
                          const isPaused = position.data.pausedAtSlot > 0n
                          const balanceWarning = isPaused
                            ? lowPositionRentNativeSolWarning
                            : lowMaintenanceNativeSolWarning
                          if (balanceWarning) {
                            toast.warning('Not enough SOL', {
                              description: balanceWarning,
                              id: 'position-control-validation',
                            })
                            return
                          }

                          const success = isPaused
                            ? await positionControls.resumePosition({
                                marketAddress,
                                tradePositionAddress,
                              })
                            : await positionControls.pausePosition({
                                marketAddress,
                                tradePositionAddress,
                              })
                          if (success) {
                            await refreshBalances()
                          }
                        }}
                        onWithdraw={async (tradePositionAddress) => {
                          if (lowPositionRentNativeSolWarning) {
                            toast.warning('Not enough SOL', {
                              description: lowPositionRentNativeSolWarning,
                              id: 'position-control-validation',
                            })
                            return
                          }

                          const success =
                            await positionControls.withdrawSwapped({
                              marketAddress,
                              tradePositionAddress,
                            })
                          if (success) {
                            await refreshBalances()
                          }
                        }}
                        referencePrice={marketPriceQuery.data ?? null}
                        position={position}
                        quoteDecimals={quoteDecimals}
                        quoteTicker={quoteTicker}
                        streamingState={streamingStateQuery.data ?? null}
                      />
                    ))}
                    <PositionPagination
                      itemLabel="positions"
                      onPageChange={setActivePositionPage}
                      page={normalizedActivePositionPage}
                      pageCount={activePositionPageCount}
                      pageSize={POSITION_PAGE_SIZE}
                      totalItems={activePositions.length}
                    />
                  </div>
                ) : (
                  <EmptyState copy="No streams running. Start one and it shows up here." />
                )
              ) : address ? (
                <ClosedPositionsList
                  key={`${address}:${marketId}`}
                  positionAuthority={address}
                  marketId={marketId}
                  baseDecimals={baseDecimals}
                  quoteDecimals={quoteDecimals}
                  baseTicker={baseTicker}
                  quoteTicker={quoteTicker}
                  priceHistoryAvailable={isReadApiConfigured()}
                />
              ) : (
                <EmptyState copy="Connect your wallet to view closed positions." />
              )}
            </section>
          </div>
        </div>
      </div>
      <HighPriceImpactDialog
        estimatedConversionText={estimatedConversionText}
        executionPriceDisplay={executionPriceDisplay}
        isSubmitting={submitOrder.isSubmitting}
        onConfirm={() => void handleConfirmHighPriceImpact()}
        onOpenChange={setHighPriceImpactDialogOpen}
        open={highPriceImpactDialogOpen}
        priceImpactDisplay={priceImpactDisplay}
        thresholdDisplay={highPriceImpactThresholdDisplay}
      />
    </main>
  )
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <p className="flex min-h-20 items-center text-sm leading-6 text-muted-foreground">
      {copy}
    </p>
  )
}

function PriceChangeBadge({
  display,
  value,
}: {
  display: string
  value: number | null
}) {
  return (
    <span
      className={cn(
        'text-xs tabular-nums',
        value === null || value === 0
          ? 'text-muted-foreground'
          : value > 0
            ? 'text-positive'
            : 'text-negative',
      )}
      title="24-hour reference price change"
    >
      {display}
    </span>
  )
}

function ChartRangeSelector({
  timeframe,
  onChange,
}: {
  timeframe: ChartTimeframe
  onChange: (timeframe: ChartTimeframe) => void
}) {
  return (
    <div aria-label="Chart time range" className="flex items-center gap-1">
      {CHART_RANGES.map((range) => (
        <Button
          key={range.label}
          aria-pressed={timeframe === range.timeframe}
          className="h-8 rounded-full px-3 text-xs"
          onClick={() => onChange(range.timeframe)}
          size="sm"
          variant={timeframe === range.timeframe ? 'secondary' : 'ghost'}
        >
          {range.label}
        </Button>
      ))}
    </div>
  )
}

function MarketPanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: MarketPanelTab
  onTabChange: (tab: MarketPanelTab) => void
}) {
  return (
    <div aria-label="Market view" className="flex items-center gap-1">
      {MARKET_PANEL_TABS.map(({ icon: Icon, label, tab }) => (
        <Button
          aria-pressed={activeTab === tab}
          className="rounded-full text-muted-foreground data-[pressed=true]:text-foreground"
          key={tab}
          onClick={() => onTabChange(tab)}
          size="xs"
          variant={activeTab === tab ? 'secondary' : 'ghost'}
        >
          <Icon className="size-3.5" />
          {label}
        </Button>
      ))}
    </div>
  )
}

function PriceChartPanel({
  chartCandles,
  chartDisplayMode,
  chartTimeframe,
  hasMoreHistory,
  isLoadingMoreHistory,
  isMarketUpdatesLoading,
  marketChartHistoryError,
  marketUpdatesError,
  onCrosshairMove,
  onDisplayModeChange,
  onNeedOlderHistory,
  onReset,
  positionOverlayError,
  positionOverlays,
  referenceLabel,
  resetSignal,
}: {
  chartCandles: Array<TradingViewAggregatedCandle>
  chartDisplayMode: ChartDisplayMode
  chartTimeframe: ChartTimeframe
  hasMoreHistory: boolean
  isLoadingMoreHistory: boolean
  isMarketUpdatesLoading: boolean
  marketChartHistoryError: string | null
  marketUpdatesError: string | null
  onCrosshairMove: (value: ChartCrosshairData | null) => void
  onDisplayModeChange: (mode: ChartDisplayMode) => void
  onNeedOlderHistory: (request: ChartHistoryRequest) => void
  onReset: () => void
  positionOverlayError: string | null
  positionOverlays: Array<ChartPositionOverlay>
  referenceLabel: string
  resetSignal: number
}) {
  return (
    <div className="space-y-3">
      {isMarketUpdatesLoading && chartCandles.length === 0 ? (
        <ChartState>Loading market history…</ChartState>
      ) : chartCandles.length === 0 ? (
        <ChartState>
          Price history will appear when market data is available.
        </ChartState>
      ) : (
        <div className="overflow-hidden rounded-lg bg-[#111111]">
          <MarketPriceChart
            defaultVisibleBars={
              CHART_RANGES.find((range) => range.timeframe === chartTimeframe)
                ?.visibleBars ?? 288
            }
            data={chartCandles}
            displayMode={chartDisplayMode}
            hasMoreHistory={hasMoreHistory}
            isLoadingMoreHistory={isLoadingMoreHistory}
            onCrosshairMove={onCrosshairMove}
            onNeedOlderHistory={onNeedOlderHistory}
            positionOverlays={positionOverlays}
            resetSignal={resetSignal}
            viewportPresetKey={chartTimeframe}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {referenceLabel}
        </span>
        <div className="flex items-center gap-1">
          {CHART_DISPLAY_MODES.map(({ icon: Icon, label, mode }) => (
            <Button
              key={mode}
              aria-label={label}
              title={label}
              aria-pressed={chartDisplayMode === mode}
              className="rounded-full"
              onClick={() => onDisplayModeChange(mode)}
              size="icon-xs"
              variant={chartDisplayMode === mode ? 'secondary' : 'ghost'}
            >
              <Icon className="size-3.5" />
            </Button>
          ))}
          <Button
            aria-label="Reset chart"
            title="Reset chart"
            className="rounded-full"
            onClick={onReset}
            size="icon-xs"
            variant="ghost"
          >
            <RefreshCcw className="size-3.5" />
          </Button>
        </div>
      </div>
      {marketUpdatesError && marketUpdatesError !== marketChartHistoryError && (
        <p role="status" className="text-xs text-destructive">
          {marketUpdatesError}
        </p>
      )}
      {marketChartHistoryError && (
        <p role="status" className="text-xs text-destructive">
          {marketChartHistoryError}
        </p>
      )}
      {positionOverlayError && (
        <p role="status" className="text-xs text-destructive">
          Position history unavailable: {positionOverlayError}
        </p>
      )}
    </div>
  )
}

function ChartState({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[300px] items-center justify-center rounded-lg bg-[#111111] px-8 text-center text-sm leading-6 text-muted-foreground lg:h-[480px]">
      {children}
    </div>
  )
}

function formatBatchCloseCount(selectedCount: number, totalCount: number) {
  if (totalCount <= 0) return ''
  if (selectedCount >= totalCount) return ` (${totalCount})`
  return ` (${selectedCount}/${totalCount})`
}
