# Cloudflare deployment

The application targets Worker `mato-ui` and `https://mato.markets` on Solana
mainnet-beta. The separate preview Worker is `mato-ui-preview`. Account:
`a47cdd329426d3fe463b84d562f36f45`. This checkout must not publish to the historical
devnet Worker.

## Prepare a release

```sh
nvm use
pnpm install --frozen-lockfile --ignore-scripts
# For a new configuration only; preserve any existing provider credentials:
cp .env.production.example .env.production.local
pnpm check
pnpm audit --audit-level high
pnpm mainnet:verify
```

Use a mainnet provider in server-only `SOLANA_RPC_URL` and `SOLANA_WS_URL`.
Production secrets already stored on `mato-ui` are retained by normal deployment.
**Do not run `rpc:upload` with the old local devnet configuration.** Only when
intentionally replacing production RPC secrets, configure the intended endpoints
and run:

```sh
pnpm mainnet:verify
pnpm rpc:upload
```

`rpc:prepare` writes ignored owner-readable `.dev.vars.production` and
`.cloudflare/rpc-secrets.json`. The former supports local production previews;
the latter supports an intentional secret upload. Neither belongs in Git. All
`VITE_*` variables are public; provider URLs and credentials must not use that
prefix. Builds reject browser RPC URL overrides.

The public read API is `https://read-api-production-f8ea.up.railway.app`.
`pnpm mainnet:verify` checks the configured local RPC's genesis hash, observed
program upgrade slot, market/mints/config/vaults, and the API's market address.
It does not read Cloudflare secret contents. Existing production RPC secrets must
be confirmed independently before opening the service.

## Build and publish

Development and preview builds always disable transactions. For a trading-enabled
production build, set these public values in `.env.production.local`:

```dotenv
VITE_ENABLE_TRANSACTIONS=true
VITE_VERIFIED_PROGRAM_ID=TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A
VITE_MARKET_ID=1
VITE_READ_API_URL=https://read-api-production-f8ea.up.railway.app
```

A matching program ID is a deployment configuration check, not proof of program
integrity. See [MAINNET.md](MAINNET.md) for interface provenance and validation.

```sh
pnpm exec wrangler login
pnpm deploy:preview       # read-only, optional
pnpm deploy:production    # verifies mainnet, scans source, checks types/tests,
                         # builds production, scans bundle, then publishes
```

For build-only verification, run `pnpm build`, `pnpm security:bundle`, then
`pnpm deploy:dry-run`. The Vite build selects the Cloudflare target and generates
`dist/server/wrangler.json`; never reuse a build from another branch or mode.
GitHub Actions validates code and builds without deployment credentials. Publication
remains manual in this checkout; review any separately configured Git integration
before merging to its deployment branch.

## Open the service

Deploying `mato-ui` does **not** remove the maintenance page. The
`mato-maintenance` route `mato.markets/*` takes precedence, including for `/rpc`,
`/rpc/ws`, and `/healthz`. Keep it until the maker is quoting and launch checks are
complete. Restoration instructions are in [ops/maintenance/README.md](ops/maintenance/README.md).

After the authorized removal of that route, check:

- `/healthz`: HTTP 200, `cluster: mainnet-beta`, the expected program ID and
  `tradingEnabled` value. HTTP 503/offline is expected while maintenance is active.
- Wallet connection targets mainnet; SOL and USDC balances load correctly.
- Market prices/history load once quoting is active, without browser errors.
- A small operator order can be paused, resumed, withdrawn, and closed; balances
  and closed history update. Fork validation does not replace wallet-extension QA.
- Response security headers and Worker logs are healthy.

Browsers use same-origin `/rpc` and `/rpc/ws`. The proxy uses fixed server secrets,
method restrictions, response limits, and per-IP Cloudflare rate limits. Provider
spending controls remain separate. `/healthz` reports application configuration,
not RPC or backend health.

## Recovery

Record the Worker version ID after release. Restore a known-clean version with
`pnpm exec wrangler rollback <version-id> --name mato-ui`, then repeat checks.
Never roll back to an unreviewed pre-recovery release. The standalone maintenance
Worker can keep the public service offline independently of the application version.
