# Development

This repository recovers the Mato application into new Git history. It uses Node
26.8.1 through nvm and pnpm 12.3.4. Node 24 LTS is also supported by the manifest.

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

The local server listens on `http://127.0.0.1:3000`. Stop it before switching
between `main` and `v1`, then run `pnpm install --frozen-lockfile` and restart it.

## Checks

```sh
pnpm security:source
pnpm typecheck
pnpm test
pnpm build:preview
pnpm audit
```

`pnpm check` runs the source check, type check, tests, and preview build. Generated route
types are tracked so type checking also works before starting the server.
`pnpm format:check` checks formatting; `pnpm format` applies it.

## Updating the v1 program client

The checked-in IDL is the devnet artifact from `twob-anchor`'s
`codex/fresh-devnet-deployment`, based on `v1@94824f8` (2026-09-24).
It uses program ID `CCAdkkosRFpzrb1BAWHnrzVGHMg4nNmurFCQefn7JtLX` and the devnet
bootstrap authority. The UI does not initialize ProgramConfig. The deployment's
binary, configuration, four dedicated markets, vaults, and mint settings were
verified with read-only devnet RPC calls; see [DEVNET.md](DEVNET.md).

After building the IDL for the intended program revision and authority feature:

```sh
cp ../twob-anchor/target/idl/twob_anchor.json src/lib/idl/twob_anchor.json
pnpm generate:twob
pnpm check
```

`generate:twob` uses pinned Codama tools and replaces only
`src/lib/generated/twob/src/generated`. Generated events live in `events/` and
include their Anchor discriminators. The small `kit-compat.ts` adapter supplies
the client-extension type used by the renderer while retaining Solana Kit 6.5.

Market PDAs use the ordered base mint, quote mint, and a four-byte market ID.
The selected market definitions supply all three; on-chain position queries and
controls use the resulting address, not the numeric ID alone. Interval accounts
contain 30 entries, with a fixed seven-slot end interval. These two constants are
not present in Anchor's IDL, so keep `ARRAY_LENGTH` and `END_SLOT_INTERVAL` in
`src/features/trading/constants.ts` aligned with the program when updating it.

The read API is the existing mainnet service. Every devnet market uses its
numeric market `1` (SOL/USDC) price, candle, and 24-hour-change routes as an
explicitly labeled reference. Never use that price to estimate MATO, SB or SF
execution or decode devnet positions: trading estimates use selected-market
on-chain flows only. Missing or zero flows show unavailable estimates.
Closed-position history is unsupported until a devnet history backend exists.

## Configure services

Copy `.env.example` to `.env.local` for the public mainnet reference-data API
configuration. For a dedicated devnet RPC, create an ignored `.dev.vars` file:

```dotenv
SOLANA_RPC_URL=https://your-devnet-provider-endpoint
SOLANA_WS_URL=wss://your-devnet-provider-endpoint
```

These values are server-only Worker bindings. Without them, local development
uses the public devnet endpoint, which may reject or rate-limit Worker traffic.
Restart `pnpm dev` after changing environment values.

All `VITE_*` variables are public and can appear in browser code. Never put wallet
seeds, private keys, privileged API tokens, or deployment credentials in them.
Keep provider credentials in `SOLANA_RPC_URL` and `SOLANA_WS_URL` only.

To enable devnet trading with hot reload, set these values in `.env.local` and
restart `pnpm dev`:

```dotenv
VITE_ENABLE_TRANSACTIONS=true
VITE_VERIFIED_PROGRAM_ID=CCAdkkosRFpzrb1BAWHnrzVGHMg4nNmurFCQefn7JtLX
```

Local development requires an explicit opt-in, the devnet deployment target,
and a matching program ID. This enables orders, position closure, rent
reclamation, and the additional v1 position controls. Preview builds
(`pnpm build:preview`) always stay read-only. Closed-position history remains
unsupported.

To test a production build locally, put the same two settings and the server-only
devnet HTTP/WebSocket endpoints in `.env.production.local`.

Stop `pnpm dev`, then run:

```sh
pnpm rpc:prepare
pnpm build
pnpm preview
```

This serves the production build locally at `http://127.0.0.1:3000`; it does not
deploy anything. `rpc:prepare` writes the ignored `.dev.vars.production` bindings
used by this local production preview. Repeat preparation and the build after
changing the endpoints in `.env.production.local`. `pnpm dev` uses the separate
`.dev.vars` file above.

The UI retains its original live-data integrations. Missing backend settings
produce empty/error states; mock prices are not presented as real market data.
See [DEPLOYMENT.md](DEPLOYMENT.md) for the production service mapping and deployment steps.

## Dependency and tooling policy

- Direct dependencies and pnpm are pinned; commit changes to the new lockfile.
- Dependency lifecycle scripts remain disabled through `ignoreScripts: true`.
- New dependency releases must be at least 24 hours old.
- Formatting uses `.prettierrc.json`. No executable Prettier configuration is needed.
- Old assistant hooks, deployment scripts, package-manager configuration, and
  Git history were not imported.
- Review new scripts, executable configuration, package sources, and lockfile
  changes before running them. `ignoreScripts` does not sandbox `pnpm dev`,
  `pnpm build`, explicitly invoked commands, or arbitrary configuration hooks.

The source check looks for the incident's execution techniques and unexpected
imports. Dependency auditing checks published advisories. Neither is a complete
malware audit or a guarantee about third-party packages or the on-chain program.
