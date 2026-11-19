export type ExampleStream = {
  id: string
  side: 'buy' | 'sell'
  start: number
  end: number
  rate: number
}

export const EXAMPLE_DURATION = 60

// Illustrative input amounts per slot, not market data. Intervals include their start and
// exclude their end, so a finished stream never contributes to the next price.
export const exampleStreams: readonly ExampleStream[] = [
  { id: 'Buy 1', side: 'buy', start: 0, end: 38, rate: 9_000 },
  { id: 'Sell 1', side: 'sell', start: 0, end: 42, rate: 60 },
  { id: 'Buy 2', side: 'buy', start: 5, end: 53, rate: 600 },
  { id: 'Sell 2', side: 'sell', start: 7, end: 53, rate: 4 },
  { id: 'Short sell', side: 'sell', start: 11, end: 18, rate: 2 },
  // The next pair supplies overlapping interest as the first pair finishes.
  { id: 'Buy 3', side: 'buy', start: 22, end: 60, rate: 186_000 },
  { id: 'Sell 3', side: 'sell', start: 22, end: 60, rate: 1_200 },
  { id: 'Buy 4', side: 'buy', start: 44, end: 58, rate: 4_800 },
  { id: 'Sell 4', side: 'sell', start: 49, end: 58, rate: 30 },
]

export function getExampleClearing(
  time: number,
  streams: readonly ExampleStream[] = exampleStreams,
) {
  const active = streams.filter(({ start, end }) => time >= start && time < end)
  const buyFlow = active.reduce(
    (sum, stream) => sum + (stream.side === 'buy' ? stream.rate : 0),
    0,
  )
  const sellFlow = active.reduce(
    (sum, stream) => sum + (stream.side === 'sell' ? stream.rate : 0),
    0,
  )

  return {
    active,
    buyFlow,
    sellFlow,
    price: buyFlow > 0 && sellFlow > 0 ? buyFlow / sellFlow : null,
  }
}

export const examplePriceSegments = Array.from(
  new Set([
    0,
    EXAMPLE_DURATION,
    ...exampleStreams.flatMap((s) => [s.start, s.end]),
  ]),
)
  .sort((a, b) => a - b)
  .slice(0, -1)
  .map((start, index, starts) => ({
    start,
    end: starts[index + 1] ?? EXAMPLE_DURATION,
    price: getExampleClearing(start).price,
  }))
