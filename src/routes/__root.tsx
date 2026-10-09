import { transactionsEnabled } from '@/integrations/solana/transaction-policy'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'

import { SolanaProvider } from '../integrations/solana'
import { Navbar } from '../components/navbar'
import { RiskDisclaimerDialog } from '../components/risk-disclaimer-dialog'
import { Toaster } from '../components/ui/sonner'
import { WalletConnectionButton } from '../features/trading/components/wallet-connection-button'
import {
  DEFAULT_MARKET_ID,
  parseMarketSearch,
} from '../features/trading/constants'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const PRODUCTION_SITE_URL = 'https://mato.markets'
const siteUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ?? PRODUCTION_SITE_URL

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#0B1512',
      },
      {
        title: 'Mato',
      },
      {
        name: 'description',
        content: 'Continuous Clearing Auctions',
      },
      {
        property: 'og:title',
        content: 'Mato',
      },
      {
        property: 'og:description',
        content: 'Continuous Clearing Auctions',
      },
      {
        property: 'og:image',
        content: `${siteUrl}/icon-512.png`,
      },
      {
        property: 'og:url',
        content: siteUrl,
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        name: 'twitter:card',
        content: 'summary',
      },
      {
        name: 'twitter:title',
        content: 'Mato',
      },
      {
        name: 'twitter:description',
        content: 'Continuous Clearing Auctions',
      },
      {
        name: 'twitter:image',
        content: `${siteUrl}/icon-512.png`,
      },
      ...(siteUrl === PRODUCTION_SITE_URL
        ? []
        : [{ name: 'robots', content: 'noindex, nofollow' }]),
    ],
    links: [
      {
        rel: 'canonical',
        href: siteUrl,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        sizes: 'any',
        href: '/favicon.svg',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16.png',
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/icon-180.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),

  component: RootLayout,
  shellComponent: RootDocument,
})

function RootLayout() {
  const location = useRouterState({ select: (state) => state.location })
  const marketId =
    location.pathname === '/'
      ? parseMarketSearch(location.search).market
      : DEFAULT_MARKET_ID

  return (
    <>
      <Navbar marketId={marketId}>
        <WalletConnectionButton marketId={marketId} />
      </Navbar>
      {!transactionsEnabled() && (
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-2 text-[11px] leading-4 text-muted-foreground min-[601px]:px-6 min-[769px]:px-10 min-[1441px]:px-20">
          <span role="status" className="text-warning">
            Read-only · Trading disabled
          </span>
        </div>
      )}
      <Outlet />
      {transactionsEnabled() && <RiskDisclaimerDialog />}
    </>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <SolanaProvider>
          {children}
          <Toaster />
        </SolanaProvider>
        <Scripts />
      </body>
    </html>
  )
}
