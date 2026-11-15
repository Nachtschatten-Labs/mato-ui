// Play-money SOL/USDC stream. Market identity matches the mainnet UI.
// See src/features/trading/constants.ts and .env.example.

export const MARKET_ADDRESS = 'FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3'
export const DEFAULT_READ_API_URL =
  'https://read-api-production-f8ea.up.railway.app'

export const FLOW_PRECISION = 1_000_000_000n
export const BOOKKEEPING_PRECISION = 1_000_000_000_000_000n
export const FLOW_PART_ONE = 10_000n
export const FLOW_PART_TWO = 100_000n
export const MAX_U128 = (1n << 128n) - 1n

export const SLOT_MS = 200
export const BASE_DECIMALS = 9
export const QUOTE_DECIMALS = 6
export const PRICE_SCALE = 1_000n

export const START_USDC_ATOMS = 10_000_000_000n
export const START_SOL_ATOMS = 100_000_000_000n
export const MIN_QUOTE_ATOMS = 100_000n
export const MIN_BASE_ATOMS = 1_000_000n

export const MIN_SECONDS = 10
export const MAX_SECONDS = 60 * 60
export const MAX_OPEN_ORDERS = 10
export const MAX_PLAYERS = 5_000
export const STALE_MS = 15_000
export const DONE_VISIBLE_MS = 15_000
export const APP_ID = 'mato-paper'

export const PRESETS = [
  {
    id: 'buy-10-30',
    side: 'buy',
    amount: '10',
    seconds: 30,
    title: 'Buy 10 USDC',
  },
  {
    id: 'buy-100-60',
    side: 'buy',
    amount: '100',
    seconds: 60,
    title: 'Buy 100 USDC',
  },
  {
    id: 'buy-1000-300',
    side: 'buy',
    amount: '1000',
    seconds: 300,
    title: 'Buy 1000 USDC',
  },
  {
    id: 'sell-0.5-30',
    side: 'sell',
    amount: '0.5',
    seconds: 30,
    title: 'Sell 0.5 SOL',
  },
  {
    id: 'sell-1-60',
    side: 'sell',
    amount: '1',
    seconds: 60,
    title: 'Sell 1 SOL',
  },
  {
    id: 'sell-10-300',
    side: 'sell',
    amount: '10',
    seconds: 300,
    title: 'Sell 10 SOL',
  },
]
