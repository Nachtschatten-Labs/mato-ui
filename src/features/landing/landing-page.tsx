import { useState } from 'react'
import { StreamExplorer } from './stream-explorer'
import { faqs, MATO_X_URL, MATO_TELEGRAM_URL, MATO_GITHUB_URL } from './content'
import {
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
    </a>
  )
}

function StreamIllustration() {
  const [planIndex, setPlanIndex] = useState(1)
  const plan = plans[planIndex]
  const amountLabel = STREAM_EXAMPLE_AMOUNT.toLocaleString('en-US')
  const pace = (
    STREAM_EXAMPLE_AMOUNT /
    (plan.days * 24 * 60 * 60)
  ).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
  // Keep the same vertical scale so the graphic reflects the actual flow ratio.
  const barHeight = 150 * (plans[0].days / plan.days)

  return (
    <div className="stream-illustration">
      <div className="stream-topline">
        <span>
          <span className="landing-dot" /> Your amount. Your duration.
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
          <span>CONTINUOUS SPENDING</span>
          <span>LONGER DURATION, SMALLER FLOW</span>
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
          <rect
            className="stream-bar"
            x="0"
            y={165 - barHeight}
            width="480"
            height={barHeight}
            fill="url(#stream-bar-fill)"
          />
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
          <Waves size={16} aria-hidden="true" /> One continuous stream
        </span>
      </div>
      <p className="stream-footnote">
        Same amount, more time, less flow at any moment.
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
              <span className="landing-dot" /> Continuous DCA on Solana
            </p>
            <h1 id="hero-title">
              Better execution. <span>One continuous stream.</span>
            </h1>
            <p className="hero-description">
              Turn your buy or sell order into a continuous stream. Mato clears
              overlapping streams together, giving both sides one price and
              putting your trading interval to work for better execution.
            </p>
            <p className="hero-fees">
              <strong>0.02%–0.1% platform fee</strong>, depending on the asset.
              No additional exchange fee.
            </p>
            <div className="hero-actions">
              <AppLink />
              <a className="landing-text-link" href="#how-it-works">
                Explore how it works
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
            <span>Overlapping streams trade together</span>
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
          className="landing-problem landing-container landing-section"
          aria-labelledby="problem-title"
        >
          <p className="landing-eyebrow">YOUR TIME IS PART OF THE TRADE</p>
          <h2 id="problem-title">
            A DCA order already tells us <span>something useful.</span>
          </h2>
          <p>
            You want to trade an amount over a period of time. A regular DCA
            splits that order into chunks and sends each one to an exchange. The
            interval becomes a schedule for separate swaps.
          </p>
          <p>
            Mato treats the whole order as a continuous stream. Buy and sell
            streams overlap in time, so they can trade together. That creates a
            market around the trading interest already there.
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
                <p className="landing-eyebrow">SEE THE OVERLAP</p>
                <h2 id="how-title">
                  Many streams.
                  <br />
                  <span>One shared price.</span>
                </h2>
              </div>
              <p>
                At any moment, Mato adds up the active buy and sell flows. USDC
                per slot divided by SOL per slot gives the price that both sides
                trade at. Move the line to see it happen.
              </p>
            </div>
            <StreamExplorer />
            <p className="how-resolution">
              The price is calculated from the buy and sell flows in each slot.
              As streams start and finish, those flows change.
            </p>
          </div>
        </section>

        <section
          id="why-mato"
          className="landing-benefits landing-container landing-section"
          aria-labelledby="benefits-title"
        >
          <div className="section-heading">
            <div>
              <p className="landing-eyebrow">WHY STREAM WITH MATO</p>
              <h2 id="benefits-title">
                Better execution starts with <span>trading together.</span>
              </h2>
            </div>
            <p>
              The time you allow gives your trade a smaller footprint. Clearing
              streams together gives buyers and sellers the same price, and
              reduces the advantage of being first in line.
            </p>
          </div>
          <div className="benefit-grid">
            <article>
              <BenefitGraphic kind="price" />
              <span className="benefit-number">ONE MARKET</span>
              <h3>One price for both sides.</h3>
              <p>
                Active buy and sell streams exchange at the same price before
                fees. There is no bid–ask spread and no extra fee for routing
                your trade to another exchange.
              </p>
            </article>
            <article>
              <BenefitGraphic kind="pace" />
              <span className="benefit-number">LESS PRICE IMPACT</span>
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
            </article>
            <article>
              <BenefitGraphic kind="flow" />
              <span className="benefit-number">SHARED EXECUTION</span>
              <h3>Less advantage from racing ahead.</h3>
              <p>
                Your stream meets other buy and sell interest at a shared price.
                Getting ahead of another stream in the same clearing does not
                buy a different execution price.
              </p>
            </article>
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
              Choose your amount and duration, then fund your stream. Follow its
              progress, pause it, or close it early if your plans change.
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
            <p className="landing-eyebrow">BEFORE YOU START</p>
            <h2 id="faq-title">The practical details.</h2>
            <p>Your price, your costs, and what happens to your funds.</p>
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
          <p className="landing-eyebrow">YOUR NEXT STREAM</p>
          <h2 id="closing-title">
            Put your trading interval to work.
            <br />
            <span>Start with one stream.</span>
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
            Experimental protocol. Limited liquidity. The program has not been
            fully audited. Trading involves risk, including loss of funds.
          </p>
          <span>Built on Solana</span>
        </div>
      </footer>
    </div>
  )
}
