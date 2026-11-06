export const MATO_X_URL = 'https://x.com/MatoMarkets'
export const MATO_TELEGRAM_URL = 'https://t.me/+MIhTBMAU_q1lZmNi'
export const MATO_GITHUB_URL = 'https://github.com/Nachtschatten-Labs/mato-ui'

export const faqs = [
  {
    question: 'Is DCA better than buying all at once?',
    answer:
      'Mato does not tell you when to buy or sell, and DCA does not guarantee a better price. It changes how you execute a trade. If you have decided to buy or sell over time, a stream does it in one order, at one shared clearing price every 200ms.',
  },
  {
    question: 'How is this different from a regular DCA?',
    answer:
      'Scheduled DCA tools send separate swaps to other venues at set times. Each slice has its own execution price and can carry service, routing, venue, and network fees, depending on the provider. A Mato stream trades directly in one continuous clearing auction, with a shared price every 200ms. Mato charges a platform fee of 0.02% to 0.1%, depending on the asset, without an additional destination-venue fee. Network fees and account rent can still apply.',
  },
  {
    question: 'Does no spread mean no trading costs?',
    answer:
      'No. Buyers and sellers share the same clearing price before fees, so there is no separate bid–ask spread. The platform fee is 0.02% to 0.1%, depending on the asset, with no additional destination-venue fee. Network fees and account rent can still apply. Your stream also changes market flow and can affect the clearing price. Check the app for the current fee and estimated price impact.',
  },
  {
    question: 'Why use a longer duration?',
    answer:
      'For the same total amount, a longer duration means less input entering the market per moment. With otherwise unchanged liquidity, that reduces your stream’s price impact. The market clears every 200ms, so a longer stream spreads execution across more clearing prices. A longer stream does not guarantee a better final price, and the market can move against you.',
  },
  {
    question: 'Can I pause or stop my stream?',
    answer:
      'Yes. You can pause an active stream, resume it, send available output to your wallet, or close it to receive the available output and refundable input. These actions are wallet transactions and require network fees.',
  },
  {
    question: 'Is the price fixed when I start?',
    answer:
      'No. The estimate reflects liquidity now. A new clearing price is set every 200ms from the market’s aggregate flows while your stream runs. If there is no opposing flow, trading does not accrue for those slots and the unused input remains refundable.',
  },
  {
    question: 'What should I know before starting?',
    answer:
      'Mato is an experimental protocol. Liquidity is limited, and the smart contracts have not been fully audited. An audit with Neodyme is scheduled for December 2026; it is not yet a completed audit. Trading involves market and smart-contract risk, including loss of funds. Review the fee, duration, estimated price impact, and risk notice in the app before you start.',
  },
]
