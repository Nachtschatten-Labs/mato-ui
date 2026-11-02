import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseMarketSearch } from '@/features/trading/constants'
import { LandingPage } from '@/features/landing/landing-page'
import landingCss from '@/features/landing/landing.css?url'

const title = 'Mato · Give your trade time'
const description =
  'A calmer way to DCA on Solana. Stream SOL and USDC over time with one shared clearing price, transparent fees, and control over your pace.'

export const Route = createFileRoute('/')({
  beforeLoad: ({ location }) => {
    // Keep existing bookmarks and shared links opening their selected market.
    if (new URLSearchParams(location.searchStr).has('market')) {
      throw redirect({
        to: '/trade',
        search: parseMarketSearch(location.search),
        replace: true,
      })
    }
  },
  head: () => ({
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      {
        property: 'og:url',
        content:
          import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ??
          'https://mato.markets',
      },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'stylesheet', href: landingCss }],
  }),
  component: LandingPage,
})
