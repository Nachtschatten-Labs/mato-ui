import { Link } from '@tanstack/react-router'
import type { MarketId } from '@/features/trading/constants'

export function Navbar({
  children,
  marketId,
}: {
  children?: React.ReactNode
  marketId: MarketId
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="relative z-50 mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6"
    >
      <Link
        aria-label="Mato home"
        className="rounded-sm text-[21px] font-medium tracking-[-0.05em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        search={{ market: marketId }}
        to="/"
      >
        mato
      </Link>

      <div className="flex items-center gap-3">{children}</div>
    </nav>
  )
}
