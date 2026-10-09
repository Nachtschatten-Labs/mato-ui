import { useEffect, useState } from 'react'

export function OrderFinishTime({
  durationSeconds,
}: {
  durationSeconds: number
}) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  if (now === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0)
    return null

  const today = new Date(now)
  const finish = new Date(now + durationSeconds * 1_000)
  const time = finish.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const day =
    finish.toDateString() === today.toDateString()
      ? null
      : finish.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          ...(finish.getFullYear() !== today.getFullYear()
            ? { year: 'numeric' as const }
            : {}),
        })

  return (
    <p className="w-full text-xs leading-5 text-muted-foreground">
      Finishes at{' '}
      <time
        className="text-[var(--t2)]"
        dateTime={finish.toISOString()}
        title={finish.toLocaleString()}
      >
        {time}
        {day ? ` · ${day}` : ''}
      </time>
    </p>
  )
}
