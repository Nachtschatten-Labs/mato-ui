# Development

Use Node from `.nvmrc` and pnpm 12.3.4:

```sh
nvm use
pnpm install --frozen-lockfile --ignore-scripts
cp .env.example .env.local  # only when creating a new local configuration
pnpm dev
```

The local server listens on `http://127.0.0.1:3000`. Development and preview builds
are read-only, even if old local settings enable trading. Mainnet data uses the
read API in the example file and same-origin `/rpc` and `/rpc/ws`.

Dedicated RPC endpoints belong in ignored `.dev.vars` for local development and
`.env.production.local` for release preparation. Use **mainnet** endpoints. All
`VITE_*` variables are public browser configuration; never put provider credentials,
wallet keys, seeds, or deployment tokens in them. A public mainnet RPC is the local
fallback and can rate-limit requests.

## Checks

```sh
pnpm check              # source scan, types, tests, read-only preview build
pnpm mainnet:verify     # read-only check of the configured release RPC and API
pnpm audit --audit-level high
pnpm format:check
```

See [MAINNET.md](MAINNET.md) for the opt-in fork integration test. Its test keys and
balances are temporary and local. The source check and dependency audit cover known
indicators and published advisories; they do not establish program security.

## Program client

The checked-in IDL targets `TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A`.
Provenance and observed live layouts are recorded in [MAINNET.md](MAINNET.md).
Regenerate after a reviewed IDL update:

```sh
pnpm generate:twob
pnpm check
```

The generator replaces `src/lib/generated/twob/src/generated` using pinned Codama
tools. Do not copy an IDL for another program identity into this checkout. Market
PDAs use the ordered mints and a u32 ID. Interval PDAs use `market_interval`, market
address, and u64 index. Keep `ARRAY_LENGTH = 16` and `END_SLOT_INTERVAL = 11` in
sync with the Rust release; these constants are not emitted by Anchor's IDL.

The API routes use full market addresses. Empty quote history is an expected state
before quoting starts; the UI does not fabricate prices. Closed history is available
from the same mainnet API and is filtered by wallet and market address.

## Production preview

Prepare `.env.production.local` using the example, then:

```sh
pnpm rpc:prepare
pnpm build
pnpm preview
```

This serves the production build locally without publishing. `rpc:prepare` creates
ignored owner-readable `.dev.vars.production` and `.cloudflare/rpc-secrets.json`.
Keep these files private. Trading defaults off; see [DEPLOYMENT.md](DEPLOYMENT.md)
for its explicit production opt-in.

Dependencies and pnpm stay exactly pinned. Lifecycle scripts remain disabled via
`ignoreScripts`. Review new scripts/configuration and lockfile changes before running
them. `.prettierrc.json` is the formatting configuration; no executable formatter
configuration is needed. The prior devnet release is documented in [DEVNET.md](DEVNET.md)
for historical reference only.
