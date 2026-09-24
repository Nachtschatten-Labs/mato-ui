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

The checked-in IDL comes from `twob-anchor`'s `v1` branch at `94824f8`
(2026-09-24). It was checked against a fresh IDL build. The source artifact uses
the test bootstrap authority; a devnet build differs in the authority accepted
by `initialize_program_config`. The trading UI does not initialize that account.

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

The separate read API keeps its existing numeric market routes. Its indexer must
decode the new event layouts (market addresses and `u128` flows) and map each
address to the corresponding API market ID. Updating the UI's IDL does not
update that service or migrate old on-chain accounts.

## Configure services

Copy `.env.example` to `.env.local` and supply the read API and RPC endpoints you
control. Each branch has its own intended cluster and generated program client.
Restart the development server after changing environment values.

All `VITE_*` variables are public and can appear in browser code. Never put wallet
seeds, private keys, privileged API tokens, or deployment credentials in them.
Use browser-safe RPC credentials with appropriate restrictions.

Transactions are blocked by default, including orders, position closure, rent
reclamation, and the additional v1 position controls. Before enabling them,
independently confirm the cluster, program address, deployed program/IDL, and
read API ownership. Then set both `VITE_ENABLE_TRANSACTIONS=true` and
`VITE_VERIFIED_PROGRAM_ID` to the program address you verified. A matching value
only records that configuration decision; the UI cannot prove the program is safe.
Test with a fresh devnet wallet before any production use.

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
