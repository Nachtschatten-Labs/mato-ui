# September 2026 devnet connection

The UI targets `CCAdkkosRFpzrb1BAWHnrzVGHMg4nNmurFCQefn7JtLX` on Solana devnet.
This replaces the retired `CCAd78ZgUBAFNQmCCD5z4oGuFzb8uXLw5kfnBcRvDw16`
deployment. The IDL, generated client, deployment target, and RPC scan allowlist
must refer to the same program.

## Verified deployment

Read-only devnet RPC verification on 2026-09-24 at slot `503470456` confirmed:

- Devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.
- The executable program, its ProgramData link, and expected upgrade authority.
- Deployed ELF SHA-256 `a7402a92aac327e2132fd18c9056ada471c8523c1d059885b68ccb28ad3eb53a`, matching the prepared `devnet-authority` artifact.
- ProgramConfig at `9zQGyHTCCg3fLS2AcWQ1F76QN8NThAcWbadjpMyLyyef`.
- All four dedicated markets, their bookkeeping accounts, and token vault owners/mints.
- Market IDs, base/quote mints, decimals, fee settings, maker/operator, and deposit minimums match the setup runbook.

The IDL comes from the program's `codex/fresh-devnet-deployment` checkout, based
on `v1@94824f8`. Compared with the previously integrated v1 IDL, only the program
address and `initialize_program_config` bootstrap authority changed. Trading
instruction and account layouts are unchanged.

## Markets

| ID  | Pair      | Market account                                 |
| --- | --------- | ---------------------------------------------- |
| 1   | SOL/USDC  | `F41sZg6i75dd8BC3ZbAqCkYGFtHRo3H1fD6anm4H8AsW` |
| 2   | MATO/USDC | `BywYSLZGJC1HCC6V6mAEnsd4mNVtk2apKVqUFauEZQNo` |
| 3   | SB/USDC   | `Dddab66eZDak7CrS9tk9prqWryyqUknwrkgKq1ZHz8wy` |
| 4   | SF/USDC   | `AAgPKkH1c8YjL9Poyp7a3k1XKCgx4qVVUS3igehXDDLm` |

Market PDAs use the ordered base mint, quote mint, and little-endian u32 ID.
The quote mint is devnet USDC `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.
SOL uses the legacy Token program; MATO, SB, and SF use Token-2022. Mint addresses
and minimum deposits are in `src/features/trading/constants.ts`. Regression
tests check all four PDA vectors against the generated program identity.

All four markets had zero base/quote flows at verification time. Until quotes
are available, execution estimates remain unavailable; creating the market alone
does not fund liquidity or configure maker quotes.

## Reference prices and trading

Every market displays mainnet SOL/USDC price history from market `1` at
`https://read-api-production-f8ea.up.railway.app`. The chart header, 24-hour
change, and chart share that explicitly labeled reference source and SOL/USDC
decimals. The reference price never substitutes for a devnet execution quote.
Wallet balances, active positions, order books, and transaction accounts come
from the selected devnet market. Closed-position history remains unsupported.

Copy `.env.example` to `.env.local` and configure dedicated devnet HTTP/WebSocket
endpoints in `.dev.vars` for local chart and account reads; see
[DEVELOPMENT.md](DEVELOPMENT.md). To enable local devnet trading with `pnpm dev`,
set `VITE_ENABLE_TRANSACTIONS=true` and
`VITE_VERIFIED_PROGRAM_ID=CCAdkkosRFpzrb1BAWHnrzVGHMg4nNmurFCQefn7JtLX` in
`.env.local`. Preview builds remain read-only. For a production build of the
devnet UI, set the same values in
`.env.production.local`, with devnet HTTP/WebSocket RPC endpoints. Run
`pnpm rpc:prepare` and rebuild after changing those server-only endpoints.
Publishing and updating Cloudflare secrets are separate steps described in
`DEPLOYMENT.md`.

The dedicated provider was verified through the local Worker: HTTP calls
confirmed devnet, read all four markets under the new program, and scanned its
market accounts; a WebSocket slot subscription also succeeded. The public
devnet endpoint rejected local Workerd requests with HTTP 403 (IP blocked).
Local Worker RPC bindings belong
in ignored `.dev.vars`; production preview bindings are prepared in
`.dev.vars.production` by `pnpm rpc:prepare`. Do not put provider credentials in
`VITE_*` variables. This connection update does not publish the UI or replace
the deployed Cloudflare secrets.
