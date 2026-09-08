# Mato UI — main

Original trading dashboard, chart history, order book, orders, active/closed positions, wallet balances, and rent accounts.

Recovered application source with fresh build tooling and dependency lockfile.
The old repository history and compromised configuration files are excluded.

```sh
nvm use
pnpm install --frozen-lockfile
pnpm dev
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup, checks, and service configuration.
See [RECOVERY.md](RECOVERY.md) for the recovery scope and limitations.

Transactions are disabled by default. The restored program address is
`CCAmAqvza37EWzou7LoYCaGKzdJsCu1CLPMp3Wvx3Bc5`; it is inherited from the reviewed snapshot and still needs
independent deployment verification before enabling transactions.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare configuration and publishing.
