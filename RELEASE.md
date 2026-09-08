# Trading rollout — 8 September 2026

Trading is enabled on both sites:

| Target              | URL                         | Cloudflare version                   |
| ------------------- | --------------------------- | ------------------------------------ |
| main / mato-ui      | https://mato.markets        | 2344cf38-8901-4c4e-91a5-e9c6087511cb |
| v1 / mato-ui-devnet | https://devnet.mato.markets | 81bc4b7c-d606-4e25-a059-7b9a12a001a0 |

- The operator confirmed acceptance of the existing mainnet program and asked to
  stop further program testing. This release does not claim a reproducible build
  or audit of that program.
- Dedicated mainnet and devnet HTTP/WebSocket URLs are stored in Cloudflare secret bindings.
  Browsers connect to same-origin `/rpc` and `/rpc/ws`. No configured RPC tokens
  were found in the compiled client or server code.
- Mainnet UI: 106 tests passed; devnet UI: 151 tests passed. TypeScript, source checks, formatting,
  production build, and Cloudflare deployment dry run passed.
- Local and live checks confirmed each target RPC cluster, trading-enabled health
  status, blocked methods and cross-origin calls, and live slot notifications for
  20 seconds. Local and live browsers on both sites loaded price/chart and trading controls without warnings.
- No wallet was connected and no transaction was signed during these app checks.
  The operator still needs to exercise a wallet order and its lifecycle.
- Devnet uses dedicated provider endpoints after the public endpoint rejected
  Cloudflare runtime traffic. Mainnet reference chart labels and devnet wallet
  routing are preserved. Devnet closed-position history remains unconfigured.
- GitHub CI passed for the mainnet review branch.

The previous versions below are the known-clean read-only rollback targets.
The existing Cloudflare Git/build integration remains unverified; ensure it cannot
publish the compromised repository or overwrite this manual deployment.

# Previous read-only release — 8 September 2026

| Branch / target                | URL                                                 | Clean Cloudflare version             |
| ------------------------------ | --------------------------------------------------- | ------------------------------------ |
| main / mato-ui                 | https://mato.markets                                | 66678a3c-9d08-417f-8a89-319674348222 |
| v1 / mato-ui-devnet            | https://devnet.mato.markets                         | fce3a78b-ff22-41b8-9354-15a39199bae3 |
| main preview / mato-ui-preview | https://mato-ui-preview.thomas-gehrmann.workers.dev | 3806ed27-a716-4014-8c56-af9c6fd0f11c |

## Verification

- Source guards, TypeScript, production builds and deployment passed on both branches.
- Main: 88 tests passed; v1: 136 tests passed. Formatting checks passed.
- Updated shared dependency lockfile: no known vulnerabilities reported by pnpm audit.
- Both live health endpoints return HTTP 200 with trading disabled.
- Live browser checks loaded current prices and charts and the read-only notice.
- Devnet reference-data banner and closed-history explanation verified in-browser.
- Devnet market switching checked in the local Cloudflare runtime.
- Live response CSP nonces match all application scripts. No CSP or hydration errors
  observed. Devnet excludes indexing and permits the devnet RPC origins.
- Public mainnet RPC produced a browser cluster-warmup warning, including on the live
  domain. Market data still loaded from Railway. Devnet had no observed browser errors.

## Remaining before trading or unattended deployment

- Supply a reliable browser-authorized mainnet RPC endpoint and verify wallet reads.
- Independently verify each deployed Solana program and test the transaction paths
  before enabling transactions. No wallet was connected and no transaction was signed
  during these checks.
- Check Cloudflare's existing Git/build connections. Wrangler OAuth could read
  Workers and domains, but the Builds API returned 403 for missing access. The
  dashboard requires an interactive signed-in browser. Existing automatic publishing
  has not been verified or changed; ensure it cannot redeploy the compromised source.
- GitHub validation workflow is prepared locally but has not been run on GitHub.

See DEPLOYMENT.md for reproducible build, publish and known-clean rollback steps.
