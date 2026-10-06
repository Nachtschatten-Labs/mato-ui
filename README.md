# Mato UI

Mainnet SOL/USDC streaming trades for program
`TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A`, including order book, positions,
pause/resume, withdrawals, closed history, and interval rent reclamation.

```sh
nvm use
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Development and preview builds are read-only. Production trading requires explicit
configuration for the verified mainnet program. See [DEVELOPMENT.md](DEVELOPMENT.md)
and [DEPLOYMENT.md](DEPLOYMENT.md).

[MAINNET.md](MAINNET.md) records the supported deployment, validation, and remaining
launch steps. The separate [maintenance Worker](ops/maintenance/README.md) continues
to show “Mato is temporarily offline” until its route is removed.

This is recovered application source with fresh build tooling and dependency
lockfile. See [RECOVERY.md](RECOVERY.md) for the recovery scope and limitations.
