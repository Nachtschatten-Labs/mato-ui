import { useEffect, useState } from 'react'
import { TWOB_ANCHOR_PROGRAM_ADDRESS } from '@/lib/generated/twob/src/generated/programs'
import { parseMarketFavorites } from '../lib/market-catalog'
import type { MarketId } from '../constants'

export const MARKET_FAVORITES_KEY = `mato:favorite-markets:${TWOB_ANCHOR_PROGRAM_ADDRESS}`

export function useMarketFavorites() {
  const [favorites, setFavorites] = useState<MarketId[]>([])
  useEffect(() => {
    try {
      setFavorites(
        parseMarketFavorites(window.localStorage.getItem(MARKET_FAVORITES_KEY)),
      )
    } catch {
      /* Favorites still work for this session when storage is unavailable. */
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === MARKET_FAVORITES_KEY || event.key === null) {
        setFavorites(parseMarketFavorites(event.newValue))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function toggleFavorite(id: MarketId) {
    const next = favorites.includes(id)
      ? favorites.filter((favorite) => favorite !== id)
      : [...favorites, id]
    setFavorites(next)
    try {
      window.localStorage.setItem(MARKET_FAVORITES_KEY, JSON.stringify(next))
    } catch {
      /* Keep the in-memory favorite if storage is unavailable. */
    }
  }
  return { favorites, toggleFavorite }
}
