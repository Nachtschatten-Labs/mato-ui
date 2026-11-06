import { createFileRoute, redirect } from '@tanstack/react-router'
import { parseMarketSearch } from '@/features/trading/constants'
import { LandingPage } from '@/features/landing/landing-page'
import { faqs, MATO_X_URL, MATO_TELEGRAM_URL } from '@/features/landing/content'
import landingCss from '@/features/landing/landing.css?url'

const title = 'Mato: Continuous DCA and TWAP on Solana'
const description =
  'Stream SOL and USDC with a shared clearing price every 200ms. Continuous DCA and TWAP on Solana, from 5 seconds to months, with a 0.02%–0.1% platform fee.'
const siteUrl =
  import.meta.env.VITE_SITE_URL?.replace(/\/$/, '') ?? 'https://mato.markets'
const imageUrl = `${siteUrl}/mato-social-card.png`
const imageAlt =
  'Mato — The DCA that prices every 200ms. Continuous DCA on Solana.'

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
        content: siteUrl,
      },
      { property: 'og:image', content: imageUrl },
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@MatoMarkets' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: imageUrl },
      { name: 'twitter:image:alt', content: imageAlt },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          '@id': 'https://mato.markets/#organization',
          name: 'Mato',
          url: 'https://mato.markets',
          logo: 'https://mato.markets/icon-512.png',
          sameAs: [MATO_X_URL, MATO_TELEGRAM_URL],
        },
      },
      {
        'script:ld+json': {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      },
    ],
    links: [{ rel: 'stylesheet', href: landingCss }],
  }),
  component: LandingPage,
})
