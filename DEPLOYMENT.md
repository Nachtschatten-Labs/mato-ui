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
pnpm rpc:prepare
pnpm cf:typegen
```

The example uses public endpoints and disables every transaction path. Environment
files are ignored. All `VITE_*` values are bundled for browsers: do not include
private keys, wallet seeds, privileged tokens, or Cloudflare credentials.
Put the provider endpoints in `SOLANA_RPC_URL` and `SOLANA_WS_URL`, without a
`VITE_` prefix. `pnpm rpc:prepare` reads `.env.production.local` and writes ignored,
owner-readable `.dev.vars.production` and `.cloudflare/rpc-secrets.json` files.
The former is used by local production previews; the latter is uploaded as
Cloudflare secrets. Never commit or share either file. Development/preview builds
fall back to the branch's public RPC; optionally put server endpoints in ignored
`.dev.vars` for local development.

Browsers use same-origin `/rpc` and `/rpc/ws`. The Worker forwards to fixed secret
endpoints, limits request/response sizes, strips provider errors and redirects,
restricts methods and program scans, and rate-limits each IP. Limits are approximate
and per Cloudflare location; they reduce quota abuse but are not authentication.
Set provider spending limits separately. Production requires both RPC secrets.
`pnpm security:bundle` checks compiled client and server code for configured RPC
tokens. Builds reject legacy `VITE_SOLANA_RPC_URL` / `VITE_SOLANA_WS_URL` inputs.

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
pnpm rpc:upload
pnpm deploy:production
```

Main previews use the existing `mato-ui-preview` Worker. Optional v1 previews use
`mato-ui-devnet-preview`; this is separate from the public devnet domain.
`pnpm deploy:production` reruns the source scan, types, tests, and production build before
publishing to the branch's custom domain. Never reuse another branch's build.
Cloudflare selects the target during the Vite build; the generated
`dist/server/wrangler.json` controls the following deployment.
`pnpm deploy:dry-run` validates the most recent build without uploading it.

## Automatic production deployment

The `Validate and deploy application` GitHub Actions workflow validates pull requests
and pushes to `main` and `v1`. After a push to `main` (including a merged pull request),
the production deployment job runs only if all validation, dry-run, and dependency
audit checks pass. It builds the same commit for production, checks the bundle,
publishes the `mato-ui` Worker at `https://mato.markets`, and checks `/healthz` with
trading enabled. Pull requests and `v1` do not publish. Runs for the same branch are
serialized without interrupting an active deployment.

The workflow preserves the current production read API, market 1, and verified
trading configuration in the deployment job's public `VITE_*` environment values.
GitHub does not read your local `.env.production.local`; change the workflow when
changing these production settings. The account and custom domain come from
`wrangler.jsonc`. RPC secrets remain on the Cloudflare Worker and are not copied to
GitHub or uploaded on each deployment.

Before the first automatic deployment, add `CLOUDFLARE_API_TOKEN` under the
repository's **Settings → Secrets and variables → Actions**, or as a secret in its
`production` environment. Use a Cloudflare Workers deployment token scoped to the
configured account and the `mato.markets` zone; do not use a global API key. The
workflow makes this token available only to the publish step. Configure the
`production` environment to allow `main` without required reviewers if deployments
should complete without a manual approval. Leave any separate Cloudflare Git
deployment integration disabled to avoid competing publishers.

To retry a deployment after fixing a missing/expired token, rerun the failed job.
To publish the latest `main` again, select **Actions → Validate and deploy application
→ Run workflow → main**. Manual runs on other branches only validate. The local
publishing commands above remain available for manual deployments.

## Verify a release

- `/healthz` must return HTTP 200 and the intended `tradingEnabled` setting.
- Open each domain, confirm a current market price/chart and the intended trading controls.
- On devnet, confirm the mainnet-reference banner and unavailable closed history.
- Check browser errors, Worker errors, and response security headers.
- Test wallet reads separately before enabling any signing operation.

Server responses use a per-request script nonce and an endpoint-limited content
security policy. Dynamic responses are not cached. Hashed assets are cached for a
year. Preview and devnet HTML are excluded from indexing. Worker observability is
enabled; `/healthz` checks application availability, not backend or RPC health.

To enable production trading, set `VITE_ENABLE_TRANSACTIONS=true` and
`VITE_VERIFIED_PROGRAM_ID` to this branch's `deployment-target.json` program ID
in `.env.production.local`, then rebuild and deploy. Previews always disable
transactions. A configured program ID records operator acceptance of the deployed
program and matching interface; it is not proof of program integrity. After a
release the operator should connect a wallet and check an order's full lifecycle.
No private wallet key is needed by this app or its Cloudflare Worker.

## Recovery

Record the clean Worker version IDs after each successful release. To restore a
known-clean version, use `pnpm exec wrangler rollback <version-id> --name <worker>`
from the appropriate checkout, then repeat the release checks. Do not roll back to
an unreviewed pre-recovery release. Alternatively rebuild and deploy a known-clean
Git revision with its matching branch configuration and environment file.
