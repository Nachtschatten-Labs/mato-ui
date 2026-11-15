# Install Mato Paper on a Solana OS badge

Mato Paper is a play-money version of Mato for the Solana Breakpoint 2026
badge. Every player starts with **10,000 USDC and 100 SOL**. Nothing is signed,
nothing is sent to the chain, and the balances cannot be withdrawn.

The badge app is `solana-os/app/` (Lua). The shared book is
`solana-os/server/` (Node, no dependencies).

## Architecture

Solana OS badges (ESP32-C5, 320×240 ILI9341, six buttons) run store apps as
sandboxed Lua. The area under the status bar is 320×218. An app's HTTP calls
do not leave the badge directly: Solana OS asks `https://badge-api.solana.com`
to make the request, and the answer has to be about **3.5 KB or smaller**.
WebSockets would go direct from the badge and would block every other server
call, so the app polls.

Live Mato flows are integers around 10^19. Badge Lua only has 32-bit numbers,
so the badge cannot clear the market itself. It is a thin screen:

1. The server polls the same read API the Mato UI uses.
2. It settles every open paper stream against those flows plus every other
   paper stream on this server.
3. The badge calls `GET /v1/badge` about every 4 seconds and draws the
   snapshot. Placing or canceling a stream is one `POST`.

```text
badge  --https via badge-api-->  paper server  --read only-->  Mato read API
                                      |
                                      +-- one JSON file of balances and streams
laptop operator page  --GET /v1/board-+
```

Identity is the badge id from the signed `X-Badge-*` headers (an emulator id
starts with `e`). The nickname is a display name stored on the badge. It is
not a secret and it does not have to be unique.

## How prices and impact work

The trading UI loads the spot from

`GET /v1/markets/FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3/price`

and the depth from the latest row of

`GET /v1/markets/FUDH6hiwDNjdQKbH7fveFFPoEE3mXk9i1g2WbgnSqob3/updates?limit=1`

(`base_flow`, `quote_flow`). That is the same client as
`src/features/trading/api/market-repository.ts`. The default host is
`https://read-api-production-f8ea.up.railway.app`, override with
`MATO_READ_API_URL`.

Mato is not a constant-product pool. A stream is a horizontal flow for its
whole duration, overlapping streams run at once, and one clearing price is the
ratio of aggregate quote flow to aggregate base flow:

```text
USDC per SOL = (quote_flow / base_flow) * 10^(9 - 6)
```

Checked against a live sample (slot 469859683, 15 Nov 2026): the flow ratio
was 71.230960 USDC, the same number the `/price` endpoint returned. Run
`node src/live-check.mjs` from `solana-os/server` to repeat that check.

A paper stream of `amount` over `seconds` uses the UI's slot length of 200ms:

```text
slots = round(seconds / 0.2)
scaled flow = amount_atoms * 1e9 / slots
```

Buys add that flow to quote flow. Sells add it to base flow. The book that
clears is:

```text
quote = live quote_flow + every open paper buy
base  = live base_flow  + every open paper sell
```

Everyone in that slot, including the new stream, trades at the new ratio. A
buy raises the price by about `my_flow / quote_flow`. A sell lowers it by
about `my_flow / (base_flow + my_flow)`. That is the same impact formula as
`src/features/trading/lib/price-impact.ts` when the UI's extra half end-slot
interval is not applied.

Output uses the program's truncated bookkeeping
(`src/features/trading/lib/position-progress.ts`). The fee is taken from
output and rounded up, matching `tradeFeeAtoms`. The default is **2 bps
(0.02%)**. The read API config payload does not include `feeBps`; set
`PAPER_FEE_BPS` if the live market account uses a different fee.

If either side of the book is zero, or the read API has been failing for more
than 15 seconds, the slot does not trade and the unspent input stays in the
wallet. Wall-clock time still passes, so a stream can end unfilled during an
outage. That matches Mato slots with no opposing flow.

Paper flow is **not** added to the real exchange. It cannot move the Mato
price other people see on mato.markets. It moves the price these badges
execute at, using the published depth as the liquidity, plus every other
badge streaming on this same server. Two overlapping paper streams therefore
see one shared price, which is the Mato idea, without touching real funds.

The UI's order ticket also shortens the duration by half an end-slot interval
(5.5 slots) because on-chain end slots are aligned. Paper streams start
immediately and run for the exact slot count, so the impact number on the
badge is the impact the simulator actually uses, not that more conservative
warning.

Mark-to-market uses the **live** ratio, not the ratio after paper flow.
Execution is at the impacted price, so a stream that lifts the price buys SOL
for more than the mark and shows a loss if the market does not move. The
contest mark is the first good live ratio after the state file is created.
Every player, including someone who joins later, is measured against that same
mark:

```text
equity = USDC balance + SOL balance * live price
start  = 10000 USDC + 100 SOL * contest mark
PnL    = equity - start
```

Unfilled input is still in the wallet, so it is already inside equity.
Wiping the state file starts a new contest. Restarting the process does not,
as long as the file is still there.

## Run the leaderboard server

Run **one** process. The book is a single JSON file. Two instances would split
the leaderboard and replay-protection memory.

The process listens on plain HTTP. Put TLS on 443 in front of it. The badge
proxy only calls `https` on port 443, and it has to be able to reach the host
from the public internet (the badge itself only talks to
`badge-api.solana.com`). A server that exists only on the venue LAN will not
receive badge traffic.

Node 22 or newer. From a checkout of this branch:

```sh
cd solana-os/server
export NODE_ENV=production
export MATO_PAPER_ALLOW_DEV=0
export PUBLIC_BASE_URL=https://paper.example.com
export PAPER_STATE_PATH=/var/lib/mato-paper/paper.json
node src/live-check.mjs
node src/server.mjs
```

`PUBLIC_BASE_URL` must be the `https://` origin the badge asks for, with no
path. The proxy's signature is over that URL. Behind a load balancer that
rewrites `Host`, a wrong origin rejects every badge with `Bad badge signature`.

`MATO_PAPER_ALLOW_DEV=1` accepts an `x-dev-badge` header instead of a
signature, and the operator page shows a play-money form. Leave it off on any
host a stranger can reach. The Docker image sets it off.

| Variable               | Default                         | Role                               |
| ---------------------- | ------------------------------- | ---------------------------------- |
| `PORT`                 | `8080`                          | Listen port                        |
| `PUBLIC_BASE_URL`      | request host, forced to `https` | URL covered by the badge signature |
| `PAPER_STATE_PATH`     | none (memory only)              | Book file. Set this in production  |
| `PAPER_FEE_BPS`        | `2`                             | Output fee, 0–100                  |
| `PAPER_POLL_MS`        | `2000`                          | How often the read API is polled   |
| `MATO_READ_API_URL`    | the production read API above   | Mato market data                   |
| `PAPER_APP_ID`         | `mato-paper`                    | Must match `id` in `app.json`      |
| `MATO_PAPER_ALLOW_DEV` | on unless `NODE_ENV=production` | Unsigned dev badges                |
| `NODE_ENV`             | unset                           | `production` disables dev badges   |

Docker, from `solana-os/server`:

```sh
docker build -t mato-paper .
docker run -d --name mato-paper \
  -p 8080:8080 \
  -v mato-paper:/data \
  -e PUBLIC_BASE_URL=https://paper.example.com \
  mato-paper
```

The image already sets `NODE_ENV=production`, `MATO_PAPER_ALLOW_DEV=0`, and
`PAPER_STATE_PATH=/data/paper.json`.

Host it wherever you can terminate TLS and keep one disk, for example:

- **Railway or Fly.io.** One service, one volume mounted at `/data`, the
  platform's `https://` hostname as `PUBLIC_BASE_URL`. This is the simplest
  option for a conference weekend.
- **A small VPS.** Run the container as above and point Caddy or nginx at
  port 8080 for `paper.example.com`.

Open `https://paper.example.com/`. That page is the operator leaderboard. It
does not require a badge. `GET /health` returns the price and player count.

Local check without a badge, from `solana-os/server`, with dev badges on:

```sh
NODE_ENV=development MATO_PAPER_ALLOW_DEV=1 PORT=8080 node src/server.mjs
```

In another shell:

```sh
curl -sS -H 'x-dev-badge: alice' 'http://127.0.0.1:8080/v1/badge?name=ada'
curl -sS -H 'x-dev-badge: alice' -H 'content-type: application/json' \
  -d '{"preset":"buy-100-60","name":"ada"}' \
  http://127.0.0.1:8080/v1/badge/orders
curl -sS http://127.0.0.1:8080/v1/board
```

`node --test test/*.test.mjs` from `solana-os/server` (or `pnpm test:paper`
from the repo root) covers clearing, impact, overlap, cancel, stale data,
reload, the 3.5 KB snapshot cap, and signed-header verification.

## Point the app at that host

Edit both of these to the same hostname, with no scheme and no path:

- `solana-os/app/config.json` field `host`
- `solana-os/app/app.json` array `hosts`

`app.json` `id` stays `mato-paper` unless you also set `PAPER_APP_ID`. The
badge will refuse any other host. Ship a new version if the hostname changes.

Build the zip from inside the app directory so `main.lua` is at the root of
the archive:

```sh
cd solana-os/app
zip ../mato-paper.zip app.json config.json main.lua
```

## Install it on a badge

These steps follow Solana OS as documented at
<https://solana.com/breakpoint/badge/apps/docs> and in
`solana-foundation/solana-os` `docs/LUA_API.md`. They were checked against that
reference, not against a physical badge. The hardware section below says what
still has to be tried on a device.

1. Update the badge to **Solana OS 0.5.0 or later**. 0.4 and older will not
   install store apps. Use Settings, Software update, or the firmware flasher
   at <https://solana.com/breakpoint/badge/stock> with a USB-C cable.
2. Insert a microSD card. Store apps install under `/sdcard/hh/apps/`.
3. Join Wi-Fi and claim the badge. HTTP test runs also need the owner's X
   account linked at the badge site.
4. Open <https://solana.com/breakpoint/badge/apps/submit>, sign in, and drop
   `mato-paper.zip` (or the `solana-os/app` folder) on the form. The manifest
   fills in from `app.json`.
5. **Try in emulator** on that page. The emulator joins demo Wi-Fi. A signed-in
   test run lasts 12 hours and is what allows `http` before the app is public.
   You should get a nickname prompt, then a price. `print` output appears under
   the emulator.
6. **Run on badge** from the same page, in desktop Chrome or Edge. Plug the
   badge in over USB. This copies the files over the serial console, replaces
   any installed app with id `mato-paper`, and starts it. The badge needs the
   SD card. This is the right first test on hardware.
7. **Publish** when that looks right. Other attendees install it from the App
   Store app on the badge, with Wi-Fi on. Publishing needs a linked X account.
   The store compiles the Lua and rejects a file that does not compile.
   Updates download only the files that changed and keep the badge's
   `data.json` (the saved nickname).

Console alternatives, if you are already on the serial REPL: `lua install
mato-paper` once it is in the store, or `lua recv` / Run on badge to sideload
without publishing. Sideload compiles from source on the badge. A published
install runs the store's compiled bytecode from flash. `lua mem` after a run
shows the peak heap.

On the badge:

- Up and down move the list. Select confirms. Left and right change Trade,
  Streams, and Board. Cancel backs out of a prompt, or leaves the app when
  nothing is open. Home always leaves.
- Trade lists six presets (10 / 100 / 1000 USDC and 0.5 / 1 / 10 SOL, over
  30s, 60s, or 5 minutes). The right-hand number is the signed price impact.
- Custom asks for one line, `buy 100 60` or `sell 1 30`. Duration is 10 to
  3600 seconds. A player can have three open streams.
- Streams: Select stops one. The unspent input stays in the wallet.
- Board: top eight by PnL, and Rename.

Minimum size is the market's own minimum: 0.1 USDC or 0.001 SOL.

## What is not verified without a badge

No physical badge or Solana OS emulator binary was available in this
environment. These are the checks still to do on hardware, and how:

| Unverified                                                                                                                                                                                                | How to test on a device                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout on the 320×218 panel. Labels are size 12–20 and the list starts at y=58. They can overlap or clip if the font is taller than assumed.                                                              | Run on badge. If the price collides with the balances, move the labels in `main.lua` and sideload again.                                                                                                                                                                        |
| `ui.list` Select calling `timer.after` to change screens, and left/right reaching `on_key` while a list is focused. The API says a list consumes up/down only.                                            | Move with up/down, Select "Leaderboard", then try left/right. Both paths should change screens.                                                                                                                                                                                 |
| The real badge proxy's signature, clock, and `X-Badge-App: mato-paper`. Unit tests verify the documented payload with a locally generated key. They do not send a request through `badge-api.solana.com`. | Try in emulator or Run on badge against the public server. A 401 `Bad badge signature` means `PUBLIC_BASE_URL` does not match the URL in the app. A 401 `Badge auth required` means the proxy is not attaching headers (test run missing, or the app is not the published one). |
| `http` errors on device: `offline`, `not linked`, `denied`, `host not allowed`, `too fast`.                                                                                                               | Turn Wi-Fi off (price label goes orange). Deny the permission, or point `config.json` at a host that is not in `app.json`.                                                                                                                                                      |
| Heap and the 60 requests/minute cap. The app keeps a handful of labels and one list, and polls every 4 seconds.                                                                                           | After a few minutes, exit and run `lua mem`. Place a stream and refresh the board; you should stay well under the cap.                                                                                                                                                          |
| App Store review and the id `mato-paper` being free.                                                                                                                                                      | Submit. If the id is taken, change `app.json` `id` and `PAPER_APP_ID` together.                                                                                                                                                                                                 |
| Venue Wi-Fi allowing the badge to reach `badge-api.solana.com`.                                                                                                                                           | The badge's own App Store only loads when that path works. If the store loads, this app's HTTP can leave too.                                                                                                                                                                   |

A full pass on one badge: nickname, price matches the operator page within a
poll or two, Buy 100 USDC / 60s, USDC falls and SOL rises within a few
seconds, cancel stops it, a second badge or the laptop board shows both names.

## Assumptions

- One SOL/USDC market, the mainnet address already used by this UI.
- Contest PnL is mark-to-market against the server's first live price, not
  against each player's join price, so late joiners are on the same scale.
- The paper fee defaults to 2 bps. Set `PAPER_FEE_BPS` when the live market
  account uses a different fee.
- Players trust the server operator. The badge signature proves which badge
  and user id called `mato-paper`. It does not prove they ran this exact Lua,
  so the server is what enforces balances, sizes, and the three-stream cap.
- Nicknames are cosmetic. The leaderboard can show two people with the same
  name; the account key is the badge id.
- The book is in-process. A crash keeps the last saved file. A few seconds of
  fills can be replayed or skipped if the process dies between a settle and
  the write; the write happens on each poll and each order.
