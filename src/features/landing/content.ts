export const MATO_X_URL = 'https://x.com/MatoMarkets'
export const MATO_TELEGRAM_URL = 'https://t.me/+MIhTBMAU_q1lZmNi'
export const MATO_GITHUB_URL = 'https://github.com/Nachtschatten-Labs/mato-ui'
export const MATO_EXPLAINER_URL =
  'https://x.com/MatoMarkets/status/2121914380585422848'

export const faqs = [
  {
    question: 'How is Mato different from a regular DCA?',
    answer:
      'A regular DCA splits your order into separate swaps and sends them to an exchange on a schedule. Mato uses the whole interval you choose: your order becomes a continuous stream that trades with overlapping streams on the other side. Those streams clear together in Mato’s own market.',
  },
  {
    question: 'Who am I trading with?',
    answer:
      'Other buyers, sellers, and market makers in Mato’s market. Your stream meets their overlapping trading interest. Everyone trading at the same moment gets the same price before fees, reducing the advantage of racing ahead of someone else’s trade.',
  },
  {
    question: 'How is the price determined?',
    answer:
      'Mato adds up the active buy and sell flows. For SOL/USDC, the USDC entering per slot divided by the SOL entering per slot sets the price. Buyers and sellers exchange at that same price, with no bid–ask spread. The price changes as streams start and finish; it is not fixed when you submit yours.',
  },
  {
    question: 'What if liquidity is low?',
    answer:
      'Your stream has more price impact when there is less liquidity. Choosing a longer duration spreads the same amount more thinly over time, reducing that impact for the same liquidity. Prices can still move while you trade. If there is no opposing flow at all, no exchange takes place for that period and the unspent input remains refundable.',
  },
  {
    question: 'What does it cost?',
    answer:
      'Mato charges a platform fee of 0.02% to 0.1%, depending on the asset. Your trade happens in Mato, so there is no additional destination-exchange fee. Solana network fees and account rent can also apply. The app shows the fee and estimated price impact before you start.',
  },
  {
    question: 'Where are my funds while a stream runs?',
    answer:
      'When you submit a stream, the funds move from your wallet into the protocol’s Solana program. The exchanged tokens accumulate there as it runs. When the stream ends, close it to withdraw those tokens and any refundable unspent input to your wallet. You can also withdraw available exchanged tokens while it runs.',
  },
  {
    question: 'Can I stop early?',
    answer:
      'Yes. Pause your stream to stop trading and resume it later. Close it to receive the tokens already exchanged and any refundable unspent input. Pausing, resuming, withdrawing, and closing require wallet transactions and network fees.',
  },
]
