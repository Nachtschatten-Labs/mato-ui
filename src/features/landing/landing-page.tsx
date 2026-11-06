import { useState } from 'react'
import { faqs, MATO_X_URL, MATO_TELEGRAM_URL, MATO_GITHUB_URL } from './content'
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
          <Waves size={16} aria-hidden="true" /> Clears every 200ms
        </span>
      </div>
      <p className="stream-footnote">
        A smaller flow over your duration. A clearing price every 200ms.
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
        <AppLink className="landing-button-small" />
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
              The DCA that prices <span>every 200ms.</span>
            </h1>
            <p className="hero-description">
              Most DCA tools send a separate swap every few minutes or hours. A
              Mato stream trades continuously, at one shared price every 200ms.
            </p>
            <p className="hero-fees">
              <strong>0.02%–0.1% platform fee</strong>, depending on the asset.
              No additional destination-venue fee.
            </p>
            <div className="hero-actions">
              <AppLink />
              <a className="landing-text-link" href="#how-it-works">
                See how it works <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
            <p className="hero-detail">
              SOL / USDC <span>·</span> From 5 seconds to months.
            </p>
          </div>
          <StreamIllustration />
        </section>

        <ul
          className="landing-use-cases landing-container"
          aria-label="Ways to use Mato"
        >
          <li>Build a position over days or weeks.</li>
          <li>Exit a large position with less price impact.</li>
          <li>Spread a treasury or buyback order over time.</li>
        </ul>

        <div className="landing-principles landing-container">
          <div>
            <Waves size={19} aria-hidden="true" />
            <span>A clearing price every 200ms</span>
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
              <p className="landing-eyebrow">BUILT FOR YOUR SIZE</p>
              <h2 id="benefits-title">
                Your stream clears with the market <span>every 200ms.</span>
              </h2>
            </div>
            <p>
              Choose how much you trade and how long it runs. Mato turns it into
              a continuous flow, with the same clearing price for everyone
              trading in the same slot.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <BenefitGraphic kind="price" />
              <span className="benefit-number">01 / CLEARER COSTS</span>
              <h3>One price, with a 0.02%–0.1% fee.</h3>
              <p>
                Buyers and sellers share one price before fees. Pay Mato’s
                platform fee, depending on the asset, with no additional
                destination-venue fee and no separate bid–ask spread.
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
                A new clearing price every 200ms, at any duration.
              </span>
            </article>
            <article>
              <BenefitGraphic kind="flow" />
              <span className="benefit-number">03 / FAIRER EXECUTION</span>
              <h3>Much harder to sandwich.</h3>
              <p>
                Everyone trading in the same slot gets the same price before
                fees. That reduces the incentive to get in front of your order
                and sell back to you at a higher price.
              </p>
              <span className="benefit-detail">
                Shared pricing reduces ordering advantages; it does not
                eliminate all MEV.
              </span>
            </article>
          </div>
          <p className="benefits-note">
            No spread does not mean no price impact. Network fees and account
            rent can also apply. Prices can move while your stream runs.
          </p>
        </section>

        <section
          className="landing-comparison landing-container"
          aria-labelledby="comparison-title"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">BEYOND SCHEDULED SWAPS</p>
              <h2 id="comparison-title">
                One stream replaces a schedule of swaps.
              </h2>
            </div>
            <p>
              Your trade stays in Mato’s market, with a shared clearing price
              every 200ms.
            </p>
          </div>
          <div
            className="comparison-scroll"
            role="region"
            aria-label="DCA comparison"
            tabIndex={0}
          >
            <table className="comparison-table">
              <caption>How scheduled DCA compares with a Mato stream</caption>
              <thead>
                <tr>
                  <th scope="col">What changes</th>
                  <th scope="col">A regular DCA</th>
                  <th scope="col">A Mato stream</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">How it executes</th>
                  <td>
                    Separate swaps on a schedule, often minutes or hours apart.
                  </td>
                  <td>
                    One continuous stream, with a new clearing price every
                    200ms.
                  </td>
                </tr>
                <tr>
                  <th scope="row">What you pay</th>
                  <td>
                    Service, routing, and destination-venue fees may apply to
                    each slice, depending on the provider.
                  </td>
                  <td>
                    One platform fee of 0.02%–0.1%, depending on the asset. No
                    additional destination-venue fee.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Who gets ahead</th>
                  <td>
                    Each slice is a separate swap, with its own place in the
                    transaction order.
                  </td>
                  <td>
                    Every matching order in the same slot gets the same price
                    before fees.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="comparison-note">
            Network fees and account rent can apply to both. Scheduled DCA
            features and fees vary by provider.
          </p>
        </section>

        <section
          className="landing-problem landing-container landing-section"
          aria-labelledby="problem-title"
        >
          <p className="landing-eyebrow">WHY STREAM A TRADE?</p>
          <h2 id="problem-title">A big swap can be an expensive moment.</h2>
          <p>
            On many DEXs, a big swap hits the market all at once. You take the
            price impact, and traders who get in front of your order can profit
            from it. That is why large traders already split their orders over
            time.
          </p>
          <p>
            Many use a DCA tool, but each slice is still a separate swap with
            its own fees and its own place in line. A Mato stream does it in one
            order, with a shared clearing price every 200ms.
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
                together. Their ratio sets a shared clearing price every 200ms,
                which changes as the flows change.
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
                      should run, from 5 seconds to months.
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
                    <h3>Clear together, every 200ms.</h3>
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
            <h2 id="control-title">Manage the whole trade in one stream.</h2>
            <p>
              Fund once and trade at a shared clearing price every 200ms. Follow
              your stream’s progress and change course when you need to.
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
            <p>What to know before you start a stream.</p>
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
          className="landing-trust landing-container landing-section"
          aria-labelledby="trust-title"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">CHECK THE WORK</p>
              <h2 id="trust-title">Built to be verifiable.</h2>
            </div>
            <p>
              See how prices are formed, where the audit stands, and what we are
              building next.
            </p>
          </div>
          <div className="trust-grid">
            <article>
              <span className="landing-eyebrow">ON-CHAIN PRICING</span>
              <h3>Recompute every clearing price.</h3>
              <p>
                Clearing prices come from on-chain flows. Every clearing price
                can be recomputed from that data.
              </p>
              <a
                className="landing-text-link"
                href="https://explorer.solana.com/address/TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A"
              >
                View the Solana program{' '}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
            <article>
              <span className="landing-eyebrow">AUDIT SCHEDULED</span>
              <h3>Neodyme · December 2026</h3>
              <p>
                An audit with Neodyme is scheduled for December 2026. The smart
                contracts have not yet been fully audited.
              </p>
            </article>
            <article>
              <span className="landing-eyebrow">FOLLOW THE BUILD</span>
              <h3>Stay close to what comes next.</h3>
              <p>
                Follow product updates on X or join the Mato community on
                Telegram.
              </p>
              <div className="trust-links">
                <a className="landing-text-link" href={MATO_X_URL}>
                  Follow @MatoMarkets{' '}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
                <a className="landing-text-link" href={MATO_TELEGRAM_URL}>
                  Join Telegram <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              </div>
            </article>
          </div>
        </section>

        <section
          className="landing-closing landing-container"
          aria-labelledby="closing-title"
        >
          <p className="landing-eyebrow">YOUR NEXT STREAM</p>
          <h2 id="closing-title">
            Choose your size and your duration.
            <br />
            <span>Mato prices it every 200ms.</span>
          </h2>
          <AppLink />
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
          <span>Continuous DCA on Solana.</span>
          <a href={APP_URL}>
            Start a stream <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
        <nav className="footer-links" aria-label="Mato links">
          <a href={MATO_X_URL}>X / @MatoMarkets</a>
          <a href={MATO_TELEGRAM_URL}>Telegram</a>
          <a href={MATO_GITHUB_URL}>GitHub</a>
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy</a>
        </nav>
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
