import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { MATO_X_URL, MATO_TELEGRAM_URL } from '@/features/landing/content'

export function LegalPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
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
        <a href="/" className="landing-text-link">
          <ArrowLeft size={16} aria-hidden="true" /> Back to Mato
        </a>
      </header>
      <main id="main" className="legal-content landing-container">
        <p className="landing-eyebrow">MATO / LEGAL</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: November 6, 2026</p>
        {children}
      </main>
      <footer className="landing-footer landing-container legal-footer">
        <nav className="footer-links" aria-label="Mato links">
          <a href="/">Home</a>
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy</a>
          <a href={MATO_X_URL}>X / @MatoMarkets</a>
          <a href={MATO_TELEGRAM_URL}>Telegram</a>
        </nav>
      </footer>
    </div>
  )
}

export function LegalContact() {
  return (
    <p>
      For questions or to request a private contact channel, reach the Mato team
      through <a href={MATO_X_URL}>@MatoMarkets on X</a> or the official{' '}
      <a href={MATO_TELEGRAM_URL}>Telegram community</a>. Do not post personal
      documents, private keys, or recovery phrases in public channels. Mato will
      never ask for your private keys or recovery phrase.
    </p>
  )
}
