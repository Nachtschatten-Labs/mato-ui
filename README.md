# Mato UI — v1

Trading dashboard plus selectable markets, updated order book/positions, pause/resume and swapped-funds withdrawal controls, and the v1 program interface.

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
`CCAd78ZgUBAFNQmCCD5z4oGuFzb8uXLw5kfnBcRvDw16`; it is inherited from the reviewed snapshot and still needs
independent deployment verification before enabling transactions.
