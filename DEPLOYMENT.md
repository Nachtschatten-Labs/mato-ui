# Cloudflare deployment

The recovered UI runs on Cloudflare Workers with server rendering and static assets.
The account is `a47cdd329426d3fe463b84d562f36f45` (thomas.gehrmann@nachtschattenlabs.org).

| Branch | Worker         | Domain                      | Wallet network      |
| ------ | -------------- | --------------------------- | ------------------- |
| main   | mato-ui        | https://mato.markets        | Solana mainnet-beta |
| v1     | mato-ui-devnet | https://devnet.mato.markets | Solana devnet       |

Both branches use `https://read-api-production-f8ea.up.railway.app` for mainnet
market data. The v1 dashboard labels its SOL/USDC reference chart, retains devnet
wallet/position queries, and does not present mainnet closed-position history as
devnet history. No devnet history backend is configured.

## Configure and validate

```sh
nvm use
pnpm install --frozen-lockfile --ignore-scripts
cp .env.production.example .env.production.local
cp .env.production.example .env.preview.local
pnpm check
pnpm audit --audit-level high
pnpm cf:typegen
```

The example uses public endpoints and disables every transaction path. Environment
files are ignored. All `VITE_*` values are bundled for browsers: do not include
private keys, wallet seeds, privileged tokens, or Cloudflare credentials.
Public RPC endpoints can reject or rate-limit browser traffic; use a dedicated,
browser-authorized RPC service before enabling trading.

`pnpm check` builds a preview and always disables transactions, even if an
environment file requests them. Production builds require a secure read API URL.
The branch fixes its canonical site URL and expected program ID in
`deployment-target.json`. Custom RPC URLs must be checked independently against
the intended cluster; URL validation alone does not verify the network.

## Publish

```sh
pnpm exec wrangler login
pnpm deploy:preview
# Check the URL printed by Wrangler, then publish the current branch:
pnpm deploy:production
```

Main previews use the existing `mato-ui-preview` Worker. Optional v1 previews use
`mato-ui-devnet-preview`; this is separate from the public devnet domain.
`pnpm deploy:production` reruns the source scan, types, tests, and production build before
publishing to the branch's custom domain. Never reuse another branch's build.
Cloudflare selects the target during the Vite build; the generated
`dist/server/wrangler.json` controls the following deployment.
`pnpm deploy:dry-run` validates the most recent build without uploading it.

The GitHub workflow checks both branches without deployment credentials. Publishing
is currently manual. Review any existing Cloudflare Git integration before allowing
it to publish; it must point at the recovered repository and correct branch.

## Verify a release

- `/healthz` must return HTTP 200 and `tradingEnabled: false` for this rollout.
- Open each domain, confirm a current market price/chart and the read-only label.
- On devnet, confirm the mainnet-reference banner and unavailable closed history.
- Check browser errors, Worker errors, and response security headers.
- Test wallet reads separately before enabling any signing operation.

Server responses use a per-request script nonce and an endpoint-limited content
security policy. Dynamic responses are not cached. Hashed assets are cached for a
year. Preview and devnet HTML are excluded from indexing. Worker observability is
enabled; `/healthz` checks application availability, not backend or RPC health.

Transactions remain disabled pending independent verification of the on-chain
program and its deployment, suitable RPC service, and wallet testing. A configured
program ID is an operator acknowledgement, not proof of program integrity.

## Recovery

Record the clean Worker version IDs after each successful release. To restore a
known-clean version, use `pnpm exec wrangler rollback <version-id> --name <worker>`
from the appropriate checkout, then repeat the release checks. Do not roll back to
an unreviewed pre-recovery release. Alternatively rebuild and deploy a known-clean
Git revision with its matching branch configuration and environment file.
