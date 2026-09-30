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

The devnet program is `CCAdkkosRFpzrb1BAWHnrzVGHMg4nNmurFCQefn7JtLX`.
The UI connects to its four dedicated markets: SOL/USDC, MATO/USDC, SB/USDC, and
SF/USDC. Charts and reference prices use mainnet SOL/USDC for every market;
execution estimates and wallet positions use only the selected devnet market.
Closed-position history is not supported. See [DEVNET.md](DEVNET.md) for verified
market addresses and deployment details.

Local devnet trading requires `VITE_ENABLE_TRANSACTIONS=true` and the matching
`VITE_VERIFIED_PROGRAM_ID` in `.env.local`. Production builds use the same
settings in `.env.production.local`. Preview builds remain read-only.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare configuration and publishing.
