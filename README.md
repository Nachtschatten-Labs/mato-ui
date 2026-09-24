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

Transactions are disabled in local development and preview builds. Production
trading requires the matching program ID in the environment configuration.

See [DEPLOYMENT.md](DEPLOYMENT.md) for Cloudflare configuration and publishing.
