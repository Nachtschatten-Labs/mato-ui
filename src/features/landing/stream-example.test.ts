import { describe, expect, it } from 'vitest'
import {
  examplePriceSegments,
  exampleStreams,
  getExampleClearing,
} from './stream-example'

describe('illustrative stream clearing', () => {
  it('adds input rates only from streams that overlap the selected moment', () => {
    expect(getExampleClearing(12)).toMatchObject({
      buyFlow: 9_600,
      sellFlow: 66,
      price: 9_600 / 66,
    })
    expect(getExampleClearing(18)).toMatchObject({
      buyFlow: 9_600,
      sellFlow: 64,
      price: 150,
    })
  })

  it('includes a stream at its start and excludes it at its end', () => {
    expect(getExampleClearing(4).active).toHaveLength(2)
    expect(getExampleClearing(5).active).toHaveLength(3)
    expect(getExampleClearing(7).active).toHaveLength(4)
    expect(getExampleClearing(37).buyFlow).toBe(195_600)
    expect(getExampleClearing(38).buyFlow).toBe(186_600)
    expect(getExampleClearing(60)).toEqual({
      active: [],
      buyFlow: 0,
      sellFlow: 0,
      price: null,
    })
  })

  it('keeps every calculated example price between 140 and 170', () => {
    for (const { price } of examplePriceSegments) {
      expect(price).toBeGreaterThanOrEqual(140)
      expect(price).toBeLessThanOrEqual(170)
    }
  })

  it('changes price at every stream boundary inside the example', () => {
    const boundaries = new Set(exampleStreams.flatMap((s) => [s.start, s.end]))
    for (const boundary of boundaries) {
      if (boundary === 0 || boundary === 60) continue
      const before = getExampleClearing(boundary - 1).price
      const after = getExampleClearing(boundary).price
      expect(before).not.toBeNull()
      expect(after).not.toBeNull()
      expect(after, `Price at slot ${boundary}`).not.toBe(before)
    }
  })

  it.each(['buy', 'sell'] as const)(
    'does not show a price with only %s flow',
    (side) => {
      const clearing = getExampleClearing(
        24,
        exampleStreams.filter((s) => s.side === side),
      )
      expect(clearing.active.length).toBeGreaterThan(0)
      expect(clearing.price).toBeNull()
    },
  )
})
