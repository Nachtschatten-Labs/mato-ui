import { MAX_ORDER_DURATION_SECONDS, SLOT_DURATION_SECONDS } from '../constants'
import { MIN_DURATION_SLOTS } from './duration'

export const MIN_SLIDER_DURATION_SECONDS =
  MIN_DURATION_SLOTS * SLOT_DURATION_SECONDS

const minute = 60
const hour = 60 * minute
const day = 24 * hour
const week = 7 * day
const month = 30 * day

function range(start: number, end: number, step: number) {
  return Array.from(
    { length: Math.floor((end - start) / step) + 1 },
    (_, i) => start + i * step,
  )
}

export function getDurationSteps(
  ...extraSeconds: Array<number | null | undefined>
) {
  return [
    ...new Set([
      MIN_SLIDER_DURATION_SECONDS,
      10,
      20,
      30,
      ...range(minute, 10 * minute, minute),
      15 * minute,
      20 * minute,
      30 * minute,
      ...range(45 * minute, 4 * hour, 15 * minute),
      ...range(5 * hour, day, hour),
      ...range(2 * day, week, day),
      ...range(2 * week, 8 * week, week),
      ...range(month, 12 * month, month),
      MAX_ORDER_DURATION_SECONDS,
      ...extraSeconds.filter(
        (seconds): seconds is number =>
          seconds != null &&
          Number.isFinite(seconds) &&
          seconds >= MIN_SLIDER_DURATION_SECONDS &&
          seconds <= MAX_ORDER_DURATION_SECONDS,
      ),
    ]),
  ].sort((a, b) => a - b)
}

export function durationToFraction(seconds: number) {
  return (
    Math.log(
      Math.max(MIN_SLIDER_DURATION_SECONDS, seconds) /
        MIN_SLIDER_DURATION_SECONDS,
    ) / Math.log(MAX_ORDER_DURATION_SECONDS / MIN_SLIDER_DURATION_SECONDS)
  )
}

export function durationAtFraction(fraction: number, steps: number[]) {
  const bounded = Math.min(1, Math.max(0, fraction))
  return steps.reduce((closest, seconds) =>
    Math.abs(durationToFraction(seconds) - bounded) <
    Math.abs(durationToFraction(closest) - bounded)
      ? seconds
      : closest,
  )
}

export function formatDuration(seconds: number, short = false): string {
  if (seconds >= MAX_ORDER_DURATION_SECONDS) return short ? '1 yr' : '1 year'
  if (seconds >= hour && seconds % hour !== 0 && seconds % minute === 0)
    return `${Math.floor(seconds / hour)} h ${(seconds % hour) / minute} min`
  // Use whole units so quarter hours and mixed durations keep their exact label.
  for (const [size, label, compact] of [
    [month, 'month', 'mo'],
    [week, 'week', 'wk'],
    [day, 'day', 'd'],
    [hour, 'hour', 'h'],
    [minute, 'minute', 'min'],
  ] as const) {
    if (seconds >= size && seconds % size === 0) {
      const value = seconds / size
      return short
        ? `${value} ${compact}`
        : `${value} ${label}${value === 1 ? '' : 's'}`
    }
  }
  if (seconds >= minute)
    return `${Math.floor(seconds / minute)} min ${Number((seconds % minute).toFixed(1))} s`
  return short
    ? `${Number(seconds.toFixed(1))} s`
    : `${Number(seconds.toFixed(1))} seconds`
}

export function formatDurationImpact(impact: number | null) {
  if (impact === null) return '—'
  const percent = impact > 0 && impact < 0.01 ? '<0.01' : impact.toFixed(2)
  return `${impact === 0 ? '' : '−'}${percent}%`
}
