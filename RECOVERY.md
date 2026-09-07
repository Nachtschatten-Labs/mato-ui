# Recovery record

Source branch: `v1` in `nightshade-labs/mato-ui`.
Source commit: `cf518f850a847a29b3ef12d38da36ec1ef4bbdc9`.

## Preserved

Application components, styles, trading calculations, tests, read-data adapters,
wallet integrations, generated client, and IDL were recovered as text from the
pinned snapshot. File contents were checked against their original Git blob hashes.
Original PNG icons were checked against their blob hashes and PNG chunk checksums.
The source branch differences remain separate in the new `main` and `v1` branches.
`recovery-manifest.json` records the source file provenance.

## Recreated or excluded

Build and test configuration, dependency manifest/lockfile, formatter settings,
and development documentation were recreated. Old Git history, all root scripts,
assistant/editor automation, deployment settings, package-manager configuration,
demo routes/data, and the duplicate unused generated-client tree were excluded.
There is no executable Prettier configuration. Route types are freshly generated.

The recovered code was statically checked for known loader patterns, hidden
padding/invisible characters, dynamic execution APIs, and unexpected imports.
Network and transaction entry points were inspected. Every exported transaction
entry point now checks explicit enablement and a configured matching program ID
before using the wallet or RPC. Regression tests exercise these disabled paths.
Missing read API configuration no longer crashes the main route or price-stream
effect. The read API rejects non-HTTP(S) URLs and embedded credentials. The main
branch uses an explicit Vite environment lookup and the standard mainnet-beta
RPC hostname. Developer overlays were removed; the original interface is retained.

## Limits

This is targeted source recovery, not a complete forensic, dependency-source,
smart-contract, or wallet-security audit. The checks do not establish what the
previously executed payload did. Restoring this repository does not revoke
stolen credentials or prove that old services/accounts are trustworthy.

No live trading, wallet signing, or production deployment is performed as part
of validation. Read API ownership and on-chain deployment/IDL authenticity remain
to be verified. The application needs your service configuration for live data.
