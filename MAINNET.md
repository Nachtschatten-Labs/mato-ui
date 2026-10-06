# Mainnet UI release

## Supported deployment

| Item                             | Value                                              |
| -------------------------------- | -------------------------------------------------- |
| Program                          | `TwobwMYkKbT8uMWqgPrEPXTPoyYsKAPmaWun6T2WT4A`      |
| Observed program deployment slot | `452075425`                                        |
| ProgramConfig                    | `BKgwxz23KWsrp9BSgAuCngfUCrpQm6jprgYUbwmyNd2X`     |
| SOL/USDC market (ID 1)           | `FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3`     |
| SOL mint / decimals              | `So11111111111111111111111111111111111111112` / 9  |
| USDC mint / decimals             | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` / 6 |
| Minimum deposits                 | 0.001 SOL / 0.1 USDC                               |
| Market layout                    | 488 bytes, embedded bookkeeping                    |
| Interval layout                  | 1176 bytes, 16 entries × 11 slots                  |
| Position layout                  | 312 bytes                                          |

The UI only lists this verified market. Wallets use `solana:mainnet-beta`; charts,
prices, history, and SSE use the market address. Query keys include the cluster,
program, and market address. Devnet selections and favorites are discarded.

## Interface provenance

The IDL schema comes from `keepers/idls/twob_anchor.json` at keeper commit
`7d97849`, whose account/type schema matches the local mainnet build artifact.
The address is pinned to the program above. The unrelated initializer authority
default was removed: the generated administrative initializer requires an explicit
signer. The UI does not initialize ProgramConfig or use administrative instructions.
Regenerate with `pnpm generate:twob`; do not edit generated files.

The program repository's `runbooks/initialize-dedicated-market/README.md` records
that downloaded mainnet bytecode matches its local mainnet binary after accounting
for program/bootstrap identity constants. The deployed source commit is not proven,
and its Anchor metadata account was absent. This release additionally exercises the
UI's actual transaction builders against the deployed bytecode on a mainnet fork.

## Validation on 2026-10-06

- TypeScript, source checks, 228 unit/component tests, production compilation,
  bundle credential scan, and Cloudflare deployment dry run.
- Mainnet account fixture captured at slot `453870292`, independently decoded with
  the generated 488-byte Market layout.
- Read-only program/market/config/mint/vault/API verification at slot `453883800`.
- Browser check: mainnet identity, SOL/USDC selection, empty-price state, and
  disconnected closed-history panel render. The public fallback RPC returned 502
  through the local Worker; production provider connectivity still needs validation.
- Isolated Surfpool fork: SOL sell with automatic wrapping, USDC buy, pause,
  resume, swapped-SOL withdrawal, exact end-slot snapshot, two-position close,
  and single-account interval rent reclamation.

The fork test creates fresh in-memory keys and simulated SOL/USDC, substitutes the
local market's maker/operator, initializes local bookkeeping, and provides local
maker flows. It never sends to mainnet and does not load real signing keys. It
checks program compatibility; production wallet extensions still need a release
smoke test.

To repeat, start a fresh fork in a temporary directory:

```sh
surfpool start --network mainnet --no-deploy --no-tui --host 127.0.0.1 \
  --port 19899 --ws-port 19900 --studio-port 19901
# In the UI checkout, in another terminal:
pnpm test:mainnet-fork
```

The integration test is skipped in ordinary `pnpm test`. Its RPC destination is
hard-coded to localhost. Restart the fork between runs. See the
[Surfpool cheatcode documentation](https://solana.com/docs/tools/surfpool/rpc/cheatcodes)
for the isolated account and clock controls used by the test.

## Remaining launch operations

1. Confirm the production Worker's HTTP and WebSocket RPC secrets target mainnet.
   Existing local provider settings were for devnet; do not upload those settings
   to `mato-ui`. Keep existing production secrets if they already target mainnet.
2. Start the mainnet maker with the correct market/operator configuration. At the
   verification slot, vaults held 1 SOL and 100 USDC, but both market flows were zero.
   The UI correctly shows unavailable prices until quotes exist. Size inventory
   and quote parameters for the intended launch separately.
3. Build/publish the UI using [DEPLOYMENT.md](DEPLOYMENT.md), then perform a small
   operator wallet smoke test when opening the service.
4. Remove the separate `mato-maintenance` route only when ready to open the site.
   A normal application deployment does not remove it. Until then the public
   homepage, RPC, and health endpoint intentionally return HTTP 503.

`pnpm mainnet:verify` performs only reads and fails if the RPC is not mainnet, the
program has been upgraded since the observed slot, account layouts/identities
change, or the API does not match. It reports inactive flows separately. It checks
the configured local release RPC, not hidden Cloudflare secret values, and is not
a security audit of the program.
