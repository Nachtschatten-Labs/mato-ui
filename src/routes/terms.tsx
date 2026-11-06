import { createFileRoute } from '@tanstack/react-router'
import { LegalContact, LegalPage } from '@/features/legal/legal-page'
import landingCss from '@/features/landing/landing.css?url'
import legalCss from '@/features/legal/legal.css?url'

export const Route = createFileRoute('/terms')({
  head: () => ({
    meta: [
      { title: 'Terms of Service · Mato' },
      {
        name: 'description',
        content:
          'Terms for using the Mato website and Solana trading interface, including wallet responsibilities, fees, and protocol risks.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: landingCss },
      { rel: 'stylesheet', href: legalCss },
    ],
  }),
  component: TermsPage,
})

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of mato.markets and its trading interface
        (the “Service”). “Mato,” “we,” and “us” refer to the team providing the
        Service under the Mato project name. Read these terms before using the
        Service. If you do not agree, do not use it.
      </p>
      <section>
        <h2>1. Eligibility and lawful use</h2>
        <p>
          You must be at least 18, have legal capacity to accept these terms,
          and be permitted to use the Service under the laws that apply to you.
          If you act for an organization, you must have authority to bind it.
          You are responsible for complying with applicable laws, sanctions, and
          tax obligations. Do not use the Service where doing so is prohibited.
        </p>
      </section>
      <section>
        <h2>2. The interface and your wallet</h2>
        <p>
          Mato provides an interface to Solana smart contracts for streaming
          trades. You control your wallet and authorize transactions with it.
          Mato does not hold your wallet’s private keys or recovery phrase.
          Funding a stream transfers tokens into protocol-controlled on-chain
          accounts; recovery and withdrawals depend on the smart contracts and
          the network.
        </p>
        <p>
          Review each transaction, token, amount, duration, fee, and address
          before signing. You are responsible for securing your wallet.
          Confirmed blockchain transactions generally cannot be reversed by the
          Mato team.
        </p>
      </section>
      <section>
        <h2>3. Execution, estimates, and fees</h2>
        <p>
          A stream executes over your chosen duration at prices determined by
          market flows. Estimates, illustrative examples, and timing information
          are not guaranteed quotes or promises of completion. The 200ms
          clearing cadence is based on slot timing, which can vary; it is not a
          transaction-confirmation guarantee. A stream can remain partly
          unfilled when there is no opposing flow.
        </p>
        <p>
          Platform fees apply at the rates configured for the market. Check the
          app before submitting or managing a stream. Solana network fees and
          account rent may also apply, including when transactions fail.
          Pausing, resuming, withdrawing, and closing require transactions.
          Refundable input and recoverable rent are subject to the protocol’s
          rules; completed trades and fees already incurred are not
          automatically refundable.
        </p>
      </section>
      <section>
        <h2>4. Risks and no investment advice</h2>
        <p>
          Mato is experimental, liquidity is limited, and the smart contracts
          have not been fully audited. You can lose some or all of your funds
          through price movements, insufficient liquidity, software defects,
          attacks, network disruptions, token issues, or protocol changes. A
          scheduled or completed audit does not eliminate these risks.
        </p>
        <p>
          The Service provides no investment, legal, or tax advice, and makes no
          recommendation about whether or when to trade. DCA, longer durations,
          shared pricing, and reduced ordering advantages do not guarantee a
          better price, profit, or protection from every form of market
          manipulation.
        </p>
      </section>
      <section>
        <h2>5. Acceptable use</h2>
        <p>
          Do not use the Service for fraud, money laundering, market
          manipulation, or other unlawful activity. Do not steal funds, exploit
          vulnerabilities to harm others, interfere with the Service, bypass
          access restrictions or rate limits, or impersonate the team. Report
          suspected vulnerabilities through our official contact channels
          without exposing other users’ data or funds.
        </p>
      </section>
      <section>
        <h2>6. Availability and third parties</h2>
        <p>
          The website, supported markets, and features may change or become
          unavailable. We may restrict access for security, maintenance, or
          legal reasons. Restricting the website does not itself cancel an
          on-chain position. Wallets, Solana, RPC services, data providers, and
          linked websites operate independently and may have their own terms. We
          do not guarantee their availability or accuracy.
        </p>
      </section>
      <section>
        <h2>7. Disclaimers and liability</h2>
        <p>
          To the extent permitted by applicable law, the Service is provided “as
          is” and “as available,” without warranties of uninterrupted operation,
          accuracy, fitness for a particular purpose, or freedom from defects.
          To that same extent, Mato is not liable for indirect or consequential
          losses, lost profits, or losses caused by third-party services, wallet
          compromise, or blockchain failures outside its control.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot lawfully be
          excluded, including for fraud or deliberate misconduct, or limits
          mandatory consumer rights. These terms do not require arbitration or
          waive any court access or statutory protection available to you.
        </p>
      </section>
      <section>
        <h2>8. Content, privacy, and changes</h2>
        <p>
          Mato’s branding and website content may be used only as permitted by
          their rights holders or applicable law. Separately licensed
          open-source code remains governed by its own license. Our{' '}
          <a href="/privacy">Privacy Notice</a> describes data handling when you
          use the Service.
        </p>
        <p>
          We may update these terms by publishing a revised version with an
          updated date and giving additional notice where required. Changes
          apply prospectively, subject to applicable law. If a provision is
          unenforceable, the remaining provisions continue to apply to the
          extent permitted by law.
        </p>
      </section>
      <section>
        <h2>9. Contact</h2>
        <LegalContact />
      </section>
    </LegalPage>
  )
}
