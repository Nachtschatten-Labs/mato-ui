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
      className="relative z-50 mx-auto flex h-20 w-full max-w-[1800px] items-center justify-between px-4 min-[601px]:px-6 min-[769px]:px-10 min-[1441px]:px-20"
    >
      <Link
        aria-label="Mato home"
        className="inline-flex rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        search={{ market: marketId }}
        to="/"
      >
        <img
          alt="mato"
          className="block h-auto w-[88px] min-[601px]:w-[100px]"
          height={59}
          src="/brand/mato-logo-mint-ui.svg"
          width={174}
        />
      </Link>

      <div className="flex items-center gap-3">{children}</div>
    </nav>
  )
}
