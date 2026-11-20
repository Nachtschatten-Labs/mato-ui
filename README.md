# Mato UI

Mainnet SOL/USDC and ANT/USDC streaming trades for program
`TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A`, including order book, positions,
pause/resume, withdrawals, closed history, and interval rent reclamation.

The DCA landing page is at `/`, with interactive illustrations of spending
pace and continuous clearing. Its examples are illustrative, not live quotes.
The trading app is at `/trade`. Existing `/?market=1` links redirect to the trading
app, and `/welcome` redirects to the homepage.
ANT/USDC (Anthropic) is listed under Equities and opens at `/trade?market=0`.

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

Play-money streaming for the Solana Breakpoint 2026 badge is in
[solana-os/](solana-os/). Install steps, the clearing model, and the
leaderboard server are in [docs/solana-os-install.md](docs/solana-os-install.md).
