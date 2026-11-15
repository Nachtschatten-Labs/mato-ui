import {
  DONE_VISIBLE_MS,
  MAX_OPEN_ORDERS,
  MAX_PLAYERS,
  MAX_SECONDS,
  MIN_BASE_ATOMS,
  MIN_QUOTE_ATOMS,
  MIN_SECONDS,
  PRESETS,
  START_SOL_ATOMS,
  START_USDC_ATOMS,
  STALE_MS,
} from './constants.mjs'
import {
  aggregateFlows,
  consumedAtoms,
  durationSlots,
  executionFlows,
  fillForSlots,
  formatDuration,
  formatImpact,
  formatPrice,
  formatUnits,
  impactPercent,
  markQuoteAtoms,
  netOutput,
  parseAtoms,
  scaledFlowFor,
  secondsLeft,
} from './clearing.mjs'

function cloneOrder(order) {
  return {
    amountAtoms: order.amountAtoms.toString(),
    finishedAt: order.finishedAt,
    grossOut: order.grossOut.toString(),
    id: order.id,
    netCredited: order.netCredited.toString(),
    playerId: order.playerId,
    remainingAtoms: order.remainingAtoms.toString(),
    scaledFlow: order.scaledFlow.toString(),
    seconds: order.seconds,
    side: order.side,
    slotsLeft: order.slotsLeft,
    spent: order.spent.toString(),
    status: order.status,
  }
}

function reviveOrder(order) {
  return {
    ...order,
    amountAtoms: BigInt(order.amountAtoms),
    grossOut: BigInt(order.grossOut),
    netCredited: BigInt(order.netCredited),
    remainingAtoms: BigInt(order.remainingAtoms),
    scaledFlow: BigInt(order.scaledFlow),
    spent: BigInt(order.spent),
  }
}

export function sanitizeName(raw) {
  if (typeof raw !== 'string') return ''
  const cleaned = raw
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 12)
  return cleaned
}

function defaultName(id) {
  const visible = id.replace(/^dev:/, '').slice(0, 8)
  return visible || 'badge'
}

function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? null
}

export function createBook({ feeBps = 2, now = Date.now, state = null } = {}) {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 100) {
    throw new Error('feeBps must be an integer from 0 to 100')
  }

  const players = new Map()
  const orders = []
  let nextOrder = 1
  let settledAtMs = null
  let mark0 = null
  let market = null

  if (state) {
    settledAtMs = state.settledAtMs ?? null
    nextOrder = state.nextOrder ?? 1
    if (state.mark0) {
      mark0 = {
        baseFlow: BigInt(state.mark0.baseFlow),
        quoteFlow: BigInt(state.mark0.quoteFlow),
      }
    }
    for (const player of state.players ?? []) {
      players.set(player.id, {
        createdAt: player.createdAt,
        id: player.id,
        name: player.name,
        sol: BigInt(player.sol),
        usdc: BigInt(player.usdc),
      })
    }
    for (const order of state.orders ?? []) orders.push(reviveOrder(order))
  }

  function tradable(at) {
    if (!market) return null
    if (at - market.fetchedAt > STALE_MS) return null
    if (market.baseFlow <= 0n || market.quoteFlow <= 0n) return null
    return market
  }

  function openOrders() {
    return orders.filter(
      (order) => order.status === 'open' && order.slotsLeft > 0,
    )
  }

  function finish(order, at) {
    if (order.status !== 'open') return
    order.slotsLeft = 0
    order.status = 'done'
    order.finishedAt = at
  }

  function credit(order, player, spend, gross) {
    const wallet = order.side === 'buy' ? player.usdc : player.sol
    let paid = spend
    if (paid > wallet) paid = wallet
    if (paid > order.remainingAtoms) paid = order.remainingAtoms
    if (paid < spend && spend > 0n) {
      gross = (gross * paid) / spend
    }
    order.remainingAtoms -= paid
    order.spent += paid
    order.grossOut += gross
    const netTotal = netOutput(order.grossOut, feeBps)
    const netDelta =
      netTotal > order.netCredited ? netTotal - order.netCredited : 0n
    order.netCredited = netTotal
    if (order.side === 'buy') {
      player.usdc -= paid
      player.sol += netDelta
    } else {
      player.sol -= paid
      player.usdc += netDelta
    }
  }

  function fill(elapsed, live, at) {
    let processed = 0
    let guard = 0
    while (processed < elapsed && guard < 10_000) {
      guard += 1
      const active = openOrders()
      if (active.length === 0) return elapsed
      let step = elapsed - processed
      for (const order of active) step = Math.min(step, order.slotsLeft)
      if (step <= 0) return processed
      const flows = aggregateFlows(live, active)
      if (flows.baseFlow <= 0n || flows.quoteFlow <= 0n) {
        for (const order of active) order.slotsLeft -= step
      } else {
        for (const order of active) {
          const player = players.get(order.playerId)
          if (!player) {
            order.slotsLeft -= step
            continue
          }
          const outputFlow =
            order.side === 'buy' ? flows.baseFlow : flows.quoteFlow
          const inputFlow =
            order.side === 'buy' ? flows.quoteFlow : flows.baseFlow
          const spend = consumedAtoms(order.scaledFlow, step)
          const gross = fillForSlots({
            inputFlow,
            outputFlow,
            scaledFlow: order.scaledFlow,
            slots: step,
          })
          credit(order, player, spend, gross)
          order.slotsLeft -= step
        }
      }
      for (const order of active) {
        if (order.slotsLeft <= 0 || order.remainingAtoms <= 0n)
          finish(order, at)
      }
      processed += step
    }
    return processed
  }

  function burn(elapsed, at) {
    for (const order of openOrders()) {
      order.slotsLeft -= Math.min(order.slotsLeft, elapsed)
      if (order.slotsLeft <= 0) finish(order, at)
    }
    return elapsed
  }

  function prune(at) {
    for (let index = orders.length - 1; index >= 0; index -= 1) {
      const order = orders[index]
      if (
        order.status !== 'open' &&
        order.finishedAt !== null &&
        at - order.finishedAt > 60_000
      ) {
        orders.splice(index, 1)
      }
    }
  }

  function settle(at = now()) {
    if (settledAtMs === null) {
      settledAtMs = at
      return
    }
    if (at < settledAtMs) return
    const elapsed = Math.floor((at - settledAtMs) / 200)
    if (elapsed <= 0) return
    const live = tradable(at)
    const processed = live ? fill(elapsed, live, at) : burn(elapsed, at)
    settledAtMs += processed * 200
    prune(at)
  }

  function reserved(playerId, side) {
    let total = 0n
    for (const order of openOrders()) {
      if (order.playerId === playerId && order.side === side) {
        total += order.remainingAtoms
      }
    }
    return total
  }

  function ensurePlayer(id, name, at) {
    let player = players.get(id)
    const clean = sanitizeName(name)
    if (!player) {
      if (players.size >= MAX_PLAYERS) return { error: 'Room is full' }
      player = {
        createdAt: at,
        id,
        name: clean || defaultName(id),
        sol: START_SOL_ATOMS,
        usdc: START_USDC_ATOMS,
      }
      players.set(id, player)
    } else if (clean) {
      player.name = clean
    }
    return { player }
  }

  function pnlAtoms(player, live) {
    if (!mark0 || !live) return null
    const solQuote = markQuoteAtoms(player.sol, live.baseFlow, live.quoteFlow)
    const startQuote = markQuoteAtoms(
      START_SOL_ATOMS,
      mark0.baseFlow,
      mark0.quoteFlow,
    )
    if (solQuote === null || startQuote === null) return null
    return player.usdc + solQuote - (START_USDC_ATOMS + startQuote)
  }

  function ranked(at) {
    const live = tradable(at)
    const rows = []
    for (const player of players.values()) {
      rows.push({
        equity: live
          ? player.usdc +
            (markQuoteAtoms(player.sol, live.baseFlow, live.quoteFlow) ?? 0n)
          : null,
        name: player.name,
        player,
        pnl: pnlAtoms(player, live),
      })
    }
    rows.sort((left, right) => {
      const lp = left.pnl ?? -(10n ** 30n)
      const rp = right.pnl ?? -(10n ** 30n)
      if (lp === rp) return left.name.localeCompare(right.name)
      return rp > lp ? 1 : -1
    })
    return rows
  }

  function orderView(order, live) {
    const book = live
      ? aggregateFlows(
          live,
          openOrders().filter((item) => item.id !== order.id),
        )
      : null
    const flows = book
      ? executionFlows(
          order.side,
          book.baseFlow,
          book.quoteFlow,
          order.scaledFlow,
        )
      : null
    const amountText =
      order.side === 'buy'
        ? `${formatUnits(order.amountAtoms, 6, 2)} USDC`
        : `${formatUnits(order.amountAtoms, 9, 4)} SOL`
    return {
      id: order.id,
      right:
        order.status === 'open' && flows
          ? formatPrice(flows.baseFlow, flows.quoteFlow)
          : order.status === 'canceled'
            ? 'stop'
            : 'done',
      status: order.status,
      sub:
        order.status === 'open'
          ? `${secondsLeft(order.slotsLeft)}s left`
          : formatDuration(order.seconds),
      title: `${order.side === 'buy' ? 'Buy' : 'Sell'} ${amountText}`,
    }
  }

  function presetViews(live, existing) {
    return PRESETS.map((preset) => {
      const decimals = preset.side === 'buy' ? 6 : 9
      const atoms = parseAtoms(preset.amount, decimals)
      const slots = durationSlots(preset.seconds)
      const scaled = scaledFlowFor(atoms, slots)
      if (!live) {
        return {
          ...preset,
          impact: '--',
          px: '--',
          sub: formatDuration(preset.seconds),
        }
      }
      const book = aggregateFlows(live, existing)
      const percent = impactPercent({
        baseFlow: book.baseFlow,
        quoteFlow: book.quoteFlow,
        scaledFlow: scaled,
        side: preset.side,
      })
      const flows = executionFlows(
        preset.side,
        book.baseFlow,
        book.quoteFlow,
        scaled,
      )
      return {
        ...preset,
        impact: formatImpact(preset.side, percent),
        px: formatPrice(flows.baseFlow, flows.quoteFlow),
        sub: formatDuration(preset.seconds),
      }
    })
  }

  function meView(player, at) {
    const live = tradable(at)
    const rows = ranked(at)
    const rank = rows.findIndex((row) => row.player.id === player.id) + 1
    const pnl = pnlAtoms(player, live)
    const equity = live
      ? player.usdc +
        (markQuoteAtoms(player.sol, live.baseFlow, live.quoteFlow) ?? 0n)
      : null
    return {
      eq: equity === null ? '--' : formatUnits(equity, 6, 2),
      name: player.name,
      pnl: pnl === null ? '--' : formatUnits(pnl, 6, 2, { sign: true }),
      rank,
      sol: formatUnits(player.sol, 9, 4),
      usdc: formatUnits(player.usdc, 6, 2),
    }
  }

  function snapshot(playerId, at = now()) {
    settle(at)
    const player = players.get(playerId)
    const live = tradable(at)
    const mine = player
      ? orders.filter(
          (order) =>
            order.playerId === playerId &&
            (order.status === 'open' ||
              (order.finishedAt !== null &&
                at - order.finishedAt < DONE_VISIBLE_MS)),
        )
      : []
    return {
      feeBps,
      me: player ? meView(player, at) : null,
      orders: mine.map((order) => orderView(order, live)),
      players: players.size,
      presets: presetViews(live, openOrders()),
      price: live ? formatPrice(live.baseFlow, live.quoteFlow) : '--',
      slot: live?.slot ?? null,
      stale: !live,
      top: ranked(at)
        .slice(0, 8)
        .map((row) => ({
          eq: row.equity === null ? '--' : formatUnits(row.equity, 6, 2),
          name: row.name,
          pnl:
            row.pnl === null
              ? '--'
              : formatUnits(row.pnl, 6, 2, { sign: true }),
        })),
    }
  }

  function board(at = now()) {
    settle(at)
    const live = tradable(at)
    return {
      players: players.size,
      price: live ? formatPrice(live.baseFlow, live.quoteFlow) : '--',
      rows: ranked(at)
        .slice(0, 50)
        .map((row, index) => ({
          eq: row.equity === null ? '--' : formatUnits(row.equity, 6, 2),
          name: row.name,
          pnl:
            row.pnl === null
              ? '--'
              : formatUnits(row.pnl, 6, 2, { sign: true }),
          rank: index + 1,
        })),
      stale: !live,
    }
  }

  return {
    board,
    cancel(playerId, orderId, at = now()) {
      settle(at)
      const order = orders.find(
        (item) =>
          item.id === orderId &&
          item.playerId === playerId &&
          item.status === 'open',
      )
      if (!order) return { error: 'Unknown stream', ok: false }
      order.finishedAt = at
      order.slotsLeft = 0
      order.status = 'canceled'
      return { ok: true, snapshot: snapshot(playerId, at) }
    },
    hello(id, name, at = now()) {
      settle(at)
      const result = ensurePlayer(id, name, at)
      if (result.error) return { error: result.error, ok: false }
      return { ok: true, snapshot: snapshot(id, at) }
    },
    place(playerId, input, at = now()) {
      settle(at)
      const player = players.get(playerId)
      if (!player) return { error: 'Join first', ok: false }
      if (!tradable(at)) return { error: 'Market offline', ok: false }
      const preset = input?.preset ? presetById(input.preset) : null
      if (input?.preset && !preset)
        return { error: 'Unknown stream', ok: false }
      const side = preset?.side ?? input?.side
      const amount = preset?.amount ?? input?.amount
      const seconds = preset?.seconds ?? Number(input?.seconds)
      if (side !== 'buy' && side !== 'sell') {
        return { error: 'Side must be buy or sell', ok: false }
      }
      if (
        !Number.isInteger(seconds) ||
        seconds < MIN_SECONDS ||
        seconds > MAX_SECONDS
      ) {
        return { error: 'Bad duration', ok: false }
      }
      const atoms = parseAtoms(amount, side === 'buy' ? 6 : 9)
      if (!atoms) return { error: 'Bad amount', ok: false }
      const minimum = side === 'buy' ? MIN_QUOTE_ATOMS : MIN_BASE_ATOMS
      if (atoms < minimum) return { error: 'Amount too small', ok: false }
      const slots = durationSlots(seconds)
      const scaled = scaledFlowFor(atoms, slots)
      if (consumedAtoms(scaled, slots) <= 0n) {
        return { error: 'Duration too long', ok: false }
      }
      const open = openOrders().filter((order) => order.playerId === playerId)
      if (open.length >= MAX_OPEN_ORDERS) {
        return { error: 'Too many streams', ok: false }
      }
      const wallet = side === 'buy' ? player.usdc : player.sol
      if (wallet - reserved(playerId, side) < atoms) {
        return {
          error: side === 'buy' ? 'Not enough USDC' : 'Not enough SOL',
          ok: false,
        }
      }
      const order = {
        amountAtoms: atoms,
        finishedAt: null,
        grossOut: 0n,
        id: `s${nextOrder}`,
        netCredited: 0n,
        playerId,
        remainingAtoms: atoms,
        scaledFlow: scaled,
        seconds,
        side,
        slotsLeft: slots,
        spent: 0n,
        status: 'open',
      }
      nextOrder += 1
      orders.push(order)
      return { ok: true, orderId: order.id, snapshot: snapshot(playerId, at) }
    },
    player(id) {
      return players.get(id) ?? null
    },
    serialize() {
      return {
        feeBps,
        mark0: mark0
          ? {
              baseFlow: mark0.baseFlow.toString(),
              quoteFlow: mark0.quoteFlow.toString(),
            }
          : null,
        nextOrder,
        orders: orders.map(cloneOrder),
        players: [...players.values()].map((player) => ({
          createdAt: player.createdAt,
          id: player.id,
          name: player.name,
          sol: player.sol.toString(),
          usdc: player.usdc.toString(),
        })),
        settledAtMs,
        version: 1,
      }
    },
    setMarket(next, at = now()) {
      market = next
      if (!mark0 && next.baseFlow > 0n && next.quoteFlow > 0n) {
        mark0 = { baseFlow: next.baseFlow, quoteFlow: next.quoteFlow }
      }
      settle(at)
    },
    settle,
    snapshot,
  }
}
