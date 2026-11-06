import { createFileRoute } from '@tanstack/react-router'
import { LegalContact, LegalPage } from '@/features/legal/legal-page'
import landingCss from '@/features/landing/landing.css?url'
import legalCss from '@/features/legal/legal.css?url'

export const Route = createFileRoute('/privacy')({
  head: () => ({
    meta: [
      { title: 'Privacy Notice · Mato' },
      {
        name: 'description',
        content:
          'How Mato handles wallet addresses, public blockchain data, technical requests, and local browser preferences.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: landingCss },
      { rel: 'stylesheet', href: legalCss },
    ],
  }),
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <LegalPage title="Privacy Notice">
      <p>
        This notice describes data handling on mato.markets and its trading
        interface. Mato is the public project name of the team providing the
        website. Using a wallet does not make activity anonymous: public
        addresses and transactions can be linked to you.
      </p>
      <section>
        <h2>1. Information used by the Service</h2>
        <ul>
          <li>
            <strong>Wallet and blockchain data.</strong> When you connect a
            wallet, the interface receives the public address and connection
            information exposed by your wallet. It requests balances, positions,
            transaction status, and history from Solana RPC and market-data
            services. Signed transactions are sent to the network. Mato does not
            request your private keys or recovery phrase.
          </li>
          <li>
            <strong>Technical data.</strong> Hosting, security, RPC, and data
            services process requests that can include IP addresses, browser
            information, requested URLs, timestamps, wallet addresses, and error
            or diagnostic information. The RPC gateway uses IP addresses to
            limit abusive request rates.
          </li>
          <li>
            <strong>Communications.</strong> If you contact the team, the
            channel you use may share your profile, contact details, and message
            contents. Share only what is needed to address your request.
          </li>
        </ul>
      </section>
      <section>
        <h2>2. Why information is processed</h2>
        <p>
          Information is used to display markets and wallet activity, prepare
          and relay transactions you authorize, maintain the Service, prevent
          abuse, investigate errors, respond to requests, and meet applicable
          legal obligations. Where data-protection law requires a legal basis,
          these purposes may rely on providing the service you request,
          legitimate interests in operating and securing it, or legal
          obligations. Processing that requires consent must be based on that
          consent.
        </p>
      </section>
      <section>
        <h2>3. Browser storage</h2>
        <p>
          The interface uses local browser storage to remember favorite markets
          and the date you acknowledged the risk notice. These preferences
          remain until replaced or removed, including when you clear site data.
          Clearing them resets the preferences; it does not remove on-chain
          activity. Wallet software may store its own settings separately.
        </p>
        <p>
          The current interface does not include advertising trackers or
          third-party marketing analytics. Infrastructure providers may process
          technical information needed to deliver and protect the site.
        </p>
      </section>
      <section>
        <h2>4. Providers and public networks</h2>
        <p>
          Mato uses Cloudflare for website delivery and security, a market-data
          API hosted on Railway, and Solana RPC infrastructure. Requests are
          shared with the services needed to fulfill them. Providers may process
          information in countries other than your own under their terms and
          applicable data-protection requirements. See{' '}
          <a href="https://www.cloudflare.com/privacypolicy/">
            Cloudflare’s privacy policy
          </a>{' '}
          and{' '}
          <a href="https://railway.com/legal/privacy">
            Railway’s privacy policy
          </a>{' '}
          for their practices.
        </p>
        <p>
          Wallets, block explorers, X, and Telegram have separate privacy
          practices. Following a link or using those services is subject to
          their policies. Blockchain transactions and account data are public
          and can be copied by anyone; Mato cannot delete or control copies of
          the Solana ledger.
        </p>
      </section>
      <section>
        <h2>5. Retention and security</h2>
        <p>
          Browser preferences remain on your device until cleared or replaced.
          Public blockchain records persist independently of Mato. Technical
          logs and support communications may be retained for service operation,
          security, resolving requests, and legal obligations; retention depends
          on the relevant provider and purpose.
        </p>
        <p>
          No website, wallet, or blockchain can guarantee complete security or
          confidentiality. Do not send private keys, recovery phrases, or
          unnecessary identity documents to the team.
        </p>
      </section>
      <section>
        <h2>6. Your choices and rights</h2>
        <p>
          You can browse the landing page without connecting a wallet,
          disconnect through the app or wallet, and clear local site data.
          Disconnecting does not cancel an active stream or erase public
          transactions.
        </p>
        <p>
          Depending on applicable law, you may have rights to access, correct,
          delete, or receive a copy of personal data, restrict or object to
          processing, withdraw consent where relied upon, or complain to a
          data-protection authority. These rights have legal limits and do not
          allow us to alter a public blockchain. Contact the team to arrange a
          private channel for a request; we may need proportionate verification
          of your authority, never your wallet’s private key.
        </p>
      </section>
      <section>
        <h2>7. Updates and contact</h2>
        <p>
          We may update this notice as the Service changes, with the latest
          revision date shown above and additional notice where required. The
          Service is intended for adults, not children.
        </p>
        <LegalContact />
      </section>
    </LegalPage>
  )
}
