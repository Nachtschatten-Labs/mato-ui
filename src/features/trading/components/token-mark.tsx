import { cn } from '@/lib/utils'

export function TokenMark({
  symbol,
  className,
}: {
  symbol: string
  className?: string
}) {
  const isSol = symbol === 'SOL'
  const isUsdc = symbol === 'USDC'

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium leading-none',
        isSol
          ? 'bg-[#282331]'
          : isUsdc
            ? 'bg-[#2775ca] text-white'
            : 'bg-[var(--track)] text-[var(--t2)]',
        className,
      )}
    >
      {isSol ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-[68%]">
          <path d="m6 5 14 0-3 3H3l3-3Z" fill="#9ce0c4" />
          <path d="M3 10.5h14l3 3H6l-3-3Z" fill="#b3accf" />
          <path d="M6 16h14l-3 3H3l3-3Z" fill="#bd9ce8" />
        </svg>
      ) : isUsdc ? (
        <span className="flex size-[72%] items-center justify-center rounded-full border-x border-white/75 text-[14px] font-normal">
          $
        </span>
      ) : (
        <span>{symbol === 'MATO' ? 'm' : symbol.slice(0, 2)}</span>
      )}
    </span>
  )
}
