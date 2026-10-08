import { describe, expect, it } from 'vitest'
import { MAX_ORDER_DURATION_SECONDS } from '../constants'
import {
  durationAtFraction,
  durationToFraction,
  formatDuration,
  formatDurationImpact,
  getDurationImpactClassName,
  getDurationImpactScale,
  getDurationSteps,
} from './duration-slider'

describe('duration slider values', () => {
  it('retains exact current and recommended values while rejecting invalid additions', () => {
    const steps = getDurationSteps(
      10.4,
      13.2,
      10.4,
      null,
      undefined,
      0,
      -1,
      Infinity,
      NaN,
      MAX_ORDER_DURATION_SECONDS + 1,
    )

    expect(steps[0]).toBe(5)
    expect(steps.at(-1)).toBe(MAX_ORDER_DURATION_SECONDS)
    expect(steps).toContain(10.4)
    expect(steps).toContain(13.2)
    expect(steps).toContain(4 * 86400)
    expect(
      steps.every((value, index) => index === 0 || value > steps[index - 1]),
    ).toBe(true)
  })

  it('round trips selectable values and clamps pointer positions to the range', () => {
    const steps = getDurationSteps(10.4)

    for (const seconds of steps) {
      expect(durationAtFraction(durationToFraction(seconds), steps)).toBe(
        seconds,
      )
    }
    expect(durationAtFraction(-0.5, steps)).toBe(5)
    expect(durationAtFraction(1.5, steps)).toBe(MAX_ORDER_DURATION_SECONDS)
    expect(durationAtFraction(0.5, steps)).toBe(3.5 * 3600)
  })

  it.each([
    [10.4, '10.4 seconds', '10.4 s'],
    [45 * 60, '45 minutes', '45 min'],
    [75 * 60, '1 h 15 min', '1 h 15 min'],
    [4 * 86400, '4 days', '4 d'],
    [7 * 86400, '1 week', '1 wk'],
    [MAX_ORDER_DURATION_SECONDS, '1 year', '1 yr'],
  ])(
    'labels %s seconds without rounding to another duration',
    (seconds, full, short) => {
      expect(formatDuration(seconds)).toBe(full)
      expect(formatDuration(seconds, true)).toBe(short)
    },
  )

  it('distinguishes unavailable, zero, increasing, and decreasing price impact', () => {
    expect(formatDurationImpact(null)).toBe('—')
    expect(formatDurationImpact(0)).toBe('0.000%')
    expect(formatDurationImpact(-0)).toBe('0.000%')
    expect(formatDurationImpact(0.0001)).toBe('+<0.001%')
    expect(formatDurationImpact(-0.0001)).toBe('−<0.001%')
    expect(formatDurationImpact(0.001)).toBe('+0.001%')
    expect(formatDurationImpact(-0.001)).toBe('−0.001%')
    expect(formatDurationImpact(0.009)).toBe('+0.009%')
    expect(formatDurationImpact(-0.009)).toBe('−0.009%')
    expect(formatDurationImpact(1.2346)).toBe('+1.235%')
    expect(formatDurationImpact(-1.2346)).toBe('−1.235%')
    expect(formatDurationImpact(1.25)).toBe('+1.250%')
    expect(formatDurationImpact(-1.25)).toBe('−1.250%')
  })

  it.each([
    [null, 'text-muted-foreground'],
    [0, 'text-positive'],
    [0.009999, 'text-positive'],
    [-0.009999, 'text-positive'],
    [0.01, 'text-muted-foreground'],
    [-0.01, 'text-muted-foreground'],
    [1, 'text-muted-foreground'],
    [-1, 'text-muted-foreground'],
    [1.000001, 'text-destructive'],
    [-1.000001, 'text-destructive'],
  ])(
    'colors an impact of %s using its unrounded magnitude',
    (impact, className) => {
      expect(getDurationImpactClassName(impact)).toBe(className)
    },
  )

  it.each([
    [0, 0.01],
    [0.005, 0.01],
    [0.2, 0.01],
    [0.200001, 0.1],
    [1.2, 0.1],
    [1.200001, 1],
    [5, 1],
  ])(
    'uses a %s maximum impact to choose the %s%% reference',
    (maxImpact, referenceImpact) => {
      const scale = getDurationImpactScale(maxImpact)

      expect(scale.referenceImpact).toBe(referenceImpact)
      expect(scale.yMax).toBeGreaterThan(maxImpact)
      expect(scale.yMax).toBeGreaterThan(referenceImpact)
    },
  )

  it('zooms the scale to show changes in small-order price impact', () => {
    expect(getDurationImpactScale(0.005).yMax).toBeCloseTo(0.016)
    expect(getDurationImpactScale(0.5).yMax).toBeCloseTo(0.54)
  })
})
