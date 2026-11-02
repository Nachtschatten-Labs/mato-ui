import { useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  MoveRight,
  Pause,
  SlidersHorizontal,
  Waves,
} from 'lucide-react'

const APP_URL = '/trade?market=1'
const STREAM_EXAMPLE_AMOUNT = 1_000_000
const plans = [
  { days: 1, label: '1 day' },
  { days: 7, label: '1 week' },
  { days: 30, label: '1 month' },
] as const

function AppLink({
  children = 'Start a stream',
  className = '',
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <a className={`landing-button ${className}`} href={APP_URL}>
      {children}
      <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  )
}

function StreamIllustration() {
  const [planIndex, setPlanIndex] = useState(1)
  const plan = plans[planIndex]
  const amountLabel = STREAM_EXAMPLE_AMOUNT.toLocaleString('en-US')
  const pace = (STREAM_EXAMPLE_AMOUNT / (plan.days * 24 * 60 * 60)).toFixed(2)
  // Keep the same vertical scale so the graphic reflects the actual flow ratio.
  const barHeight = 150 * (plans[0].days / plan.days)

  return (
    <div className="stream-illustration">
      <div className="stream-topline">
        <span>
          <span className="landing-dot" /> A trade, at your pace
        </span>
        <span className="landing-micro">ILLUSTRATION</span>
      </div>
      <div className="stream-amount">
        <span>{amountLabel}</span>
        <span className="stream-currency">USDC</span>
        <MoveRight aria-hidden="true" />
        <span className="stream-receive">SOL</span>
      </div>
      <div
        className="stream-duration"
        role="group"
        aria-label="Illustrative stream duration"
      >
        {plans.map((item, index) => (
          <button
            key={item.days}
            type="button"
            aria-pressed={index === planIndex}
            onClick={() => setPlanIndex(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        className="stream-chart"
        role="img"
        aria-label={`Illustration: ${amountLabel} USDC spread evenly over ${plan.days} ${plan.days === 1 ? 'day' : 'days'}, approximately ${pace} USDC per second. Not a quote.`}
      >
        <div className="stream-chart-label">
          <span>STEADY SPENDING</span>
          <span>MORE TIME, SMALLER FLOW</span>
        </div>
        <svg
          viewBox="0 0 480 186"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="stream-bar-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--brand-mint)"
                stopOpacity=".75"
              />
              <stop
                offset="100%"
                stopColor="var(--brand-sage)"
                stopOpacity=".12"
              />
            </linearGradient>
          </defs>
          {[30, 75, 120, 165].map((y) => (
            <path
              key={y}
              d={`M0 ${y} H480`}
              stroke="var(--divider)"
              strokeDasharray="2 6"
            />
          ))}
          {Array.from({ length: 40 }, (_, i) => (
            <rect
              key={i}
              className="stream-bar"
              x={i * 12 + 2}
              y={165 - barHeight}
              width="5"
              height={barHeight}
              rx="2.5"
              fill="url(#stream-bar-fill)"
            />
          ))}
          <path
            className="stream-pace-line"
            d={`M0 ${165 - barHeight} H480`}
            stroke="var(--brand-mint)"
            strokeWidth="1.5"
          />
          <circle
            cx="471"
            cy={165 - barHeight}
            r="4"
            fill="var(--brand-mint)"
            className="stream-pace-dot"
          />
        </svg>
        <div className="stream-chart-axis">
          <span>Start</span>
          <span>{plan.days === 1 ? '24 hours' : `Day ${plan.days}`}</span>
        </div>
      </div>
      <div className="stream-pace" aria-live="polite" aria-atomic="true">
        <div>
          <span className="landing-label">Your spending pace</span>
          <p>
            {pace} <span>USDC / second</span>
          </p>
        </div>
        <span className="stream-continuous">
          <Waves size={16} aria-hidden="true" /> Streamed continuously
        </span>
      </div>
      <p className="stream-footnote">
        Same amount. More time. A smaller footprint.
      </p>
    </div>
  )
}

function BenefitGraphic({ kind }: { kind: 'price' | 'pace' | 'flow' }) {
  return (
    <div
      className={`benefit-graphic benefit-graphic-${kind}`}
      aria-hidden="true"
    >
      {kind === 'price' ? (
        <>
          <span>Buy</span>
          <i />
          <span className="shared-price">One price</span>
          <i />
          <span>Sell</span>
        </>
      ) : kind === 'pace' ? (
        <>
          <span className="pace-single" />
          <MoveRight size={20} />
          <span className="pace-series">
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </>
      ) : (
        <svg viewBox="0 0 300 72">
          <path
            d="M0 52H25L32 15L39 52H90L98 29L106 52H148L155 4L162 52H208L216 23L224 52H300"
            stroke="var(--axis)"
            strokeWidth="1"
            fill="none"
            strokeDasharray="3 3"
          />
          <path
            d="M0 49C35 49 36 36 72 36S108 44 144 36S180 28 216 32S260 28 300 28"
            stroke="var(--brand-mint)"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      )}
    </div>
  )
}

const scenarios = [
  {
    label: 'Balanced flow',
    buy: 1500,
    sell: 10,
    explanation:
      '1,500 USDC meets 10 SOL per second. Both sides exchange at 150 USDC per SOL.',
  },
  {
    label: 'More buying',
    buy: 1800,
    sell: 10,
    explanation:
      'More USDC meets the same SOL flow. The clearing price rises to 180 USDC per SOL.',
  },
  {
    label: 'More selling',
    buy: 1500,
    sell: 12,
    explanation:
      'More SOL meets the same USDC flow. The clearing price falls to 125 USDC per SOL.',
  },
] as const

function AuctionIllustration() {
  const [selected, setSelected] = useState(0)
  const scenario = scenarios[selected]
  const price = scenario.buy / scenario.sell

  return (
    <div className="auction-illustration">
      <div className="auction-toolbar">
        <span className="landing-micro">A SIMPLIFIED MARKET</span>
        <span className="auction-example">Example, before fees</span>
      </div>
      <div
        className="auction-scenarios"
        role="group"
        aria-label="Explore clearing price scenarios"
      >
        {scenarios.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="auction-diagram">
        <div className="auction-inputs">
          <div className="auction-flow">
            <span className="flow-token">$</span>
            <div>
              <span className="landing-label">Buy flow</span>
              <p>
                {scenario.buy.toLocaleString('en-US')}{' '}
                <span>USDC / second</span>
              </p>
            </div>
          </div>
          <div className="auction-flow">
            <span className="flow-token">
              <Waves size={21} aria-hidden="true" />
            </span>
            <div>
              <span className="landing-label">Sell flow</span>
              <p>
                {scenario.sell} <span>SOL / second</span>
              </p>
            </div>
          </div>
        </div>
        <svg
          className="auction-connectors"
          viewBox="0 0 100 160"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 30H25Q50 30 50 60V70Q50 80 70 80H100M0 130H25Q50 130 50 100V90Q50 80 70 80"
            fill="none"
            stroke="var(--action)"
            strokeWidth="1"
          />
          <circle cx="90" cy="80" r="3" fill="var(--brand-mint)" />
        </svg>
        <div className="auction-clearing" aria-live="polite" aria-atomic="true">
          <span className="landing-label">One clearing price</span>
          <p>
            {price}
            <span> USDC</span>
          </p>
          <span className="landing-label">per SOL, for both sides</span>
        </div>
      </div>
      <div className="auction-equation">
        <span>USDC flow</span>
        <span>÷</span>
        <span>SOL flow</span>
        <span>=</span>
        <span>Clearing price</span>
      </div>
      <p className="auction-explanation" aria-live="polite">
        {scenario.explanation}
      </p>
      <p className="auction-note">
        Flows include traders and liquidity providers. The price changes as
        those flows change.
      </p>
    </div>
  )
}

const faqs = [
  {
    question: 'How is this different from a regular DCA?',
    answer:
      "Scheduled DCA tools typically send separate swaps to other trading venues at set times. That can mean a DCA service fee on top of the destination venue's trading fee. Each swap also faces that venue's toxic flow: fast, opportunistic trading that can make execution more costly. Mato is a standalone trading venue built around a new market structure, the continuous clearing auction. Your funded stream trades directly in Mato's market over your chosen duration, alongside other traders and liquidity providers. You pay Mato's platform fee without an additional destination-venue fee. Continuous execution spreads your trade over time and is designed to reduce toxic flow.",
  },
  {
    question: 'Does no spread mean no trading costs?',
    answer:
      'No. Buyers and sellers share the same clearing price before fees, so there is no separate bid–ask spread. Platform fees, network fees, and account rent can still apply. Your stream also changes market flow and can affect the clearing price. Check the app for the current fee and estimated price impact.',
  },
  {
    question: 'Why use a longer duration?',
    answer:
      'For the same total amount, a longer duration means less input entering the market per moment. With otherwise unchanged liquidity, that reduces your stream’s price impact. It also spreads execution across more market prices. A longer stream does not guarantee a better final price, and the market can move against you.',
  },
  {
    question: 'Can I pause or stop my stream?',
    answer:
      'Yes. You can pause an active stream, resume it, send available output to your wallet, or close it to receive the available output and refundable input. These actions are wallet transactions and require network fees.',
  },
  {
    question: 'Is the price fixed when I start?',
    answer:
      'No. The estimate reflects liquidity now. The clearing price changes with the market’s aggregate flows while your stream runs. If there is no opposing flow, trading does not accrue for those slots and the unused input remains refundable.',
  },
  {
    question: 'What should I know before starting?',
    answer:
      'Mato is an experimental protocol. Liquidity is limited, and the smart contracts have not been fully audited. Trading involves market and smart-contract risk, including loss of funds. Review the fee, duration, estimated price impact, and risk notice in the app before you start.',
  },
]

export function LandingPage() {
  return (
    <div className="mato-landing">
      <a className="landing-skip" href="#main">
        Skip to content
      </a>
      <header className="landing-header landing-container">
        <a href="/" aria-label="Mato home" className="landing-logo">
          <img
            src="/brand/mato-logo-mint-ui.svg"
            width="174"
            height="59"
            alt="mato"
          />
        </a>
        <nav aria-label="Landing page navigation">
          <a href="#why-mato">Why mato</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">FAQ</a>
        </nav>
        <AppLink className="landing-button-small">Open app</AppLink>
      </header>

      <main id="main">
        <section
          className="landing-hero landing-container"
          aria-labelledby="hero-title"
        >
          <div className="hero-copy">
            <p className="landing-eyebrow">
              <span className="landing-dot" /> CONTINUOUS DCA ON SOLANA
            </p>
            <h1 id="hero-title">
              Give your
              <br />
              trade <span>time.</span>
            </h1>
            <p className="hero-description">
              Build a position. Unwind at your pace.
              <br />
              Stream your swaps over time with low fees and one shared clearing
              price.
            </p>
            <div className="hero-actions">
              <AppLink />
              <a className="landing-text-link" href="#how-it-works">
                See how it works <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="hero-detail">
              SOL / USDC <span>·</span> Your amount. Your duration.
            </p>
          </div>
          <StreamIllustration />
        </section>

        <div className="landing-principles landing-container">
          <div>
            <Waves size={19} aria-hidden="true" />
            <span>Continuous execution</span>
          </div>
          <div>
            <span className="principle-equals" aria-hidden="true">
              =
            </span>
            <span>No bid–ask spread</span>
          </div>
          <div>
            <SlidersHorizontal size={18} aria-hidden="true" />
            <span>You set the pace</span>
          </div>
          <div>
            <Pause size={18} aria-hidden="true" />
            <span>Pause when you need to</span>
          </div>
        </div>

        <section
          id="why-mato"
          className="landing-benefits landing-container landing-section"
          aria-labelledby="benefits-title"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">MADE FOR THE LONGER TRADE</p>
              <h2 id="benefits-title">
                Less friction.
                <br />
                <span>More room to breathe.</span>
              </h2>
            </div>
            <p>
              A larger trade doesn't have to happen all at once. Give it time,
              and let a smaller stream do the work.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <BenefitGraphic kind="price" />
              <span className="benefit-number">01 / CLEARER COSTS</span>
              <h3>
                A shared price.
                <br />A transparent fee.
              </h3>
              <p>
                Buyers and sellers meet at one clearing price, before platform
                fees. No separate bid–ask spread to cross on every swap.
              </p>
              <a href="#questions" className="benefit-link">
                Understand the costs{' '}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
            <article>
              <BenefitGraphic kind="pace" />
              <span className="benefit-number">02 / SMALLER FOOTPRINT</span>
              <h3>
                More time.
                <br />
                Less price impact.
              </h3>
              <p>
                Spread the same amount over a longer duration to reduce your
                flow at any moment. With the same liquidity, that means lower
                price impact.
              </p>
              <span className="benefit-detail">
                Your pace is part of your execution.
              </span>
            </article>
            <article>
              <BenefitGraphic kind="flow" />
              <span className="benefit-number">03 / CALMER FLOW</span>
              <h3>
                Built for patience.
                <br />
                Made for steady flow.
              </h3>
              <p>
                Long streams trade gradually instead of reacting with a whole
                order at once. The design aims to reduce toxic, opportunistic
                flow.
              </p>
              <span className="benefit-detail">
                A market designed around time.
              </span>
            </article>
          </div>
          <p className="benefits-note">
            No spread does not mean no price impact. Fees apply, and prices can
            move while your stream runs.
          </p>
        </section>

        <section
          id="how-it-works"
          className="landing-how landing-section"
          aria-labelledby="how-title"
        >
          <div className="landing-container">
            <div className="section-heading">
              <div>
                <p className="landing-eyebrow">THE IDEA IS SIMPLE</p>
                <h2 id="how-title">
                  Two sides.
                  <br />
                  <span>One continuous auction.</span>
                </h2>
              </div>
              <p>
                Mato's continuous clearing auction brings buy and sell flows
                together. Their ratio sets a shared price, which changes as the
                flows change.
              </p>
            </div>
            <div className="how-grid">
              <ol className="how-steps">
                <li>
                  <span>01</span>
                  <div>
                    <h3>Turn your trade into a stream.</h3>
                    <p>
                      Choose what to swap, your total amount, and how long it
                      should run.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>Join the flow.</h3>
                    <p>
                      Your stream joins other traders and liquidity providers on
                      the buy or sell side.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>Clear together, continuously.</h3>
                    <p>
                      Both sides exchange at the same price before fees. Your
                      output accrues as the stream runs.
                    </p>
                  </div>
                </li>
              </ol>
              <AuctionIllustration />
            </div>
          </div>
        </section>

        <section
          className="landing-control landing-container landing-section"
          aria-labelledby="control-title"
        >
          <div>
            <p className="landing-eyebrow">SET THE PACE. KEEP THE CONTROL.</p>
            <h2 id="control-title">
              Let your plan run.
              <br />
              <span>Get on with your day.</span>
            </h2>
            <p>
              One funded stream. No need to come back for every swap. Follow its
              progress and change course when you need to.
            </p>
            <AppLink />
          </div>
          <div className="control-list">
            <div>
              <Check size={20} aria-hidden="true" />
              <span>Choose your amount and duration</span>
            </div>
            <div>
              <Check size={20} aria-hidden="true" />
              <span>Track your stream as it fills</span>
            </div>
            <div>
              <Check size={20} aria-hidden="true" />
              <span>Pause and resume an active stream</span>
            </div>
            <div>
              <Check size={20} aria-hidden="true" />
              <span>Withdraw available output or close your stream</span>
            </div>
            <p>
              Managing a stream requires wallet transactions and network fees.
            </p>
          </div>
        </section>

        <section
          id="questions"
          className="landing-faq landing-container landing-section"
          aria-labelledby="faq-title"
        >
          <div>
            <p className="landing-eyebrow">A LITTLE MORE CLARITY</p>
            <h2 id="faq-title">Good questions.</h2>
            <p>The details behind a slower, steadier way to swap.</p>
          </div>
          <div className="faq-list">
            {faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="landing-closing landing-container"
          aria-labelledby="closing-title"
        >
          <p className="landing-eyebrow">YOUR NEXT MOVE, AT YOUR PACE</p>
          <h2 id="closing-title">
            Think long.
            <br />
            <span>Trade gradually.</span>
          </h2>
          <AppLink>Find your pace</AppLink>
          <p>Start with SOL / USDC on Solana.</p>
        </section>
      </main>

      <footer className="landing-footer landing-container">
        <div className="footer-top">
          <a href="/" aria-label="Mato home" className="landing-logo">
            <img
              src="/brand/mato-logo-mint-ui.svg"
              width="174"
              height="59"
              alt="mato"
            />
          </a>
          <span>A little at a time.</span>
          <a href={APP_URL}>
            Open app <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="footer-bottom">
          <p>
            Experimental protocol. Limited liquidity. Smart contracts have not
            been fully audited. Trading involves risk, including loss of funds.
          </p>
          <span>Built on Solana</span>
        </div>
      </footer>
    </div>
  )
}
