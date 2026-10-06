# Mato temporary offline page

This standalone Worker responds with “Mato is temporarily offline” and HTTP 503
for every request to `mato.markets/*`. It does not forward requests to the app,
including `/rpc` and `/rpc/ws`. `/healthz` returns HTTP 503 with
`{"status":"offline","tradingEnabled":false}`. Responses are not cached.

The Worker route runs before the `mato-ui` custom-domain Worker. The original app
and its configuration remain available for restoration. Ordinary deployments of
`mato-ui` do not remove this separate route. The route only matches the root
hostname; `devnet.mato.markets` is not included.

Cloudflare documents this behavior under
[Interaction with Routes](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/#interaction-with-routes).

From the repository root, validate and publish with the explicit config:

```sh
pnpm exec wrangler deploy --config ops/maintenance/wrangler.jsonc --dry-run
pnpm exec wrangler deploy --config ops/maintenance/wrangler.jsonc
```

Verify that `https://mato.markets/` displays the offline message and that
`https://mato.markets/healthz` reports `offline` with HTTP 503. Also check a nested
path and `/rpc` to confirm they cannot reach the app.

To restore the app when authorized, remove the `mato.markets/*` route from
**Cloudflare → Workers & Pages → mato-maintenance → Settings → Domains & Routes**.
The existing `mato-ui` custom domain then serves the app again. Remove the route
from this config as well if retaining the Worker, to prevent a later maintenance
deployment from enabling the page again.

## Deployment record

Published on 2026-10-01 as Worker `mato-maintenance`, version
`acbce80d-b655-4d99-8777-51fd77a1c062`.

Live checks confirmed the message and HTTP 503 on `/`, `/rent`, an asset path,
`/rpc` (POST), `/rpc/ws`, and `/healthz`, plus an empty HEAD response. The devnet
health endpoint continued to return HTTP 200. The page was also checked in a browser.
