-- Mato: play-money SOL/USDC streams for a Solana OS badge.
-- The badge only draws and calls the paper server. Clearing runs on the
-- server because live Mato flows do not fit in the badge's 32-bit numbers,
-- and because every badge has to share one book.
--
-- Host: config.json, and the same name in app.json "hosts".
-- HTTP goes out through the badge server (https, port 443).
-- Poll: 4s idle, 1.5s while a stream is open (40/min, under the 60/min cap).

local cfg = fs.json("config.json")
local host = "mato-ui-mainnet.up.railway.app"
if type(cfg) == "table" and type(cfg.host) == "string" then
  host = cfg.host
end
host = host:gsub("^https://", ""):gsub("/.*$", ""):lower()
if not host:match("^[-a-z0-9.]+$") or host:find("..", 1, true) then
  host = "mato-ui-mainnet.up.railway.app"
end
local BASE = "https://" .. host

local SLOW_MS = 4000
local FAST_MS = 1500
local DUR_S = {600, 1800, 3600}
local DUR = {"10 min", "30 min", "1 h"}

local screen = 1
local snap = nil
local nick = nil
local busy = false
local modal = false
local inflight = false
local primed = false
local seen = {}
local side = "buy"
local buy_amt = 1000
local sell_amt = 10
local dur_i = 1
local focus = 2
local stream_i = 1
local board_sel = 1
local board_off = 0
local board_dirty = false
local BOARD_VIS = 6
local BOARD_LIM = 12
local poll_timer = nil
local poll_ms = 0
local tick_timer = nil
local snap_ms = 0
local arm_tick

ui.bg("bg")
local edge = nil
local buy_box = nil
local sell_box = nil
local bar_track = nil
local bar_thumb = nil
if ui.rect then
  edge = {
    ui.rect(0, 0, 8, 2, {color = "aqua"}),
    ui.rect(0, 0, 8, 2, {color = "aqua"}),
    ui.rect(0, 0, 2, 8, {color = "aqua"}),
    ui.rect(0, 0, 2, 8, {color = "aqua"}),
  }
  for i = 1, 4 do edge[i]:show(false) end
  buy_box = ui.rect(56, 58, 108, 20, {color = "panel", radius = 4})
  sell_box = ui.rect(172, 58, 108, 20, {color = "pink", radius = 4})
  bar_track = ui.rect(310, 64, 6, 104, {color = "panel", radius = 2})
  bar_thumb = ui.rect(310, 64, 6, 16, {color = "aqua", radius = 2})
  buy_box:show(false)
  sell_box:show(false)
  bar_track:show(false)
  bar_thumb:show(false)
end
local price = ui.label(214, 2, "--", {size = 14, w = 98, align = "right"})
local bal = ui.label(8, 4, "10000.00 USDC  100.0000 SOL", {size = 12, w = 206})
local pnl = ui.label(8, 22, "PnL --", {size = 32, w = 304, align = "center"})
local cursor = ui.label(2, 56, ">", {size = 20, w = 16, color = "aqua"})
local tog_l = ui.label(34, 56, "<", {size = 20, w = 16, color = "aqua"})
local tog_r = ui.label(286, 56, ">", {size = 20, w = 16, color = "aqua"})
cursor:show(false)
tog_l:show(false)
tog_r:show(false)

local ticket = {
  ui.label(56, 56, "Buy", {size = 20, w = 108, align = "center"}),
  ui.label(22, 80, "", {size = 20, w = 290}),
  ui.label(22, 104, "", {size = 20, w = 290}),
  ui.label(22, 132, "", {size = 14, w = 290}),
  ui.label(0, 0, "", {size = 14, w = 8}),
  ui.label(22, 152, "", {size = 20, w = 290}),
  ui.label(22, 176, "", {size = 20, w = 290}),
}
local sell_label = ui.label(172, 56, "Sell", {size = 20, w = 108, align = "center"})
sell_label:show(false)
local charts = {}
for i = 1, 3 do
  charts[i] = {label = ui.label(8, 0, "", {size = 14, w = 304})}
  charts[i].label:show(false)
end
if ui.canvas then
  charts[1].canvas = ui.canvas(52, 0, 260, 44, {color = "bg"})
  charts[1].canvas:show(false)
end
local exec = ui.label(176, 100, "--", {size = 12, w = 136})
exec:show(false)
local axis = {
  hi = ui.label(4, 0, "", {size = 12, w = 46}),
  lo = ui.label(4, 0, "", {size = 12, w = 46}),
  t0 = ui.label(52, 0, "0", {size = 12, w = 40}),
  t1 = ui.label(180, 0, "", {size = 12, w = 132, align = "right"}),
}
axis.hi:show(false)
axis.lo:show(false)
axis.t0:show(false)
axis.t1:show(false)
local board = {}
for i = 1, 7 do
  board[i] = ui.label(20, 0, "", {size = 14, w = 284})
  board[i]:show(false)
end

local function set_hint(text)
  ui.hint(text)
end

local function enc(text)
  return (text:gsub("[^%w%-%.]", function(char)
    return string.format("%%%02X", string.byte(char))
  end))
end

local function whole(text)
  local n = tonumber(text)
  if not n or n < 0 then return 0 end
  return math.floor(n)
end

local function free_amounts()
  local me = snap and snap.me
  if not me then return 0, 0 end
  return whole(me.freeUsdc or me.usdc), whole(me.freeSol or me.sol)
end

local function clamp()
  local maxu, maxs = free_amounts()
  if maxu > 0 then
    if buy_amt > maxu then buy_amt = maxu end
    if buy_amt < 1 then buy_amt = math.min(100, maxu) end
  end
  if maxs > 0 then
    if sell_amt > maxs then sell_amt = maxs end
    if sell_amt < 1 then sell_amt = math.min(1, maxs) end
  end
end

local function amount_now()
  clamp()
  if side == "buy" then return buy_amt end
  return sell_amt
end

local function hide_edge()
  if not edge then return end
  for i = 1, 4 do edge[i]:show(false) end
end

local function show_edge(x, y, w, h)
  if not edge or w < 4 or h < 4 then return end
  edge[1]:pos(x, y)
  edge[1]:size(w, 2)
  edge[2]:pos(x, y + h - 2)
  edge[2]:size(w, 2)
  edge[3]:pos(x, y)
  edge[3]:size(2, h)
  edge[4]:pos(x + w - 2, y)
  edge[4]:size(2, h)
  for i = 1, 4 do edge[i]:show(true) end
end

local function hide_all()
  for i = 1, #ticket do ticket[i]:show(false) end
  sell_label:show(false)
  cursor:show(false)
  tog_l:show(false)
  tog_r:show(false)
  hide_edge()
  if buy_box then buy_box:show(false) end
  if sell_box then sell_box:show(false) end
  if bar_track then bar_track:show(false) end
  if bar_thumb then bar_thumb:show(false) end
  for i = 1, 3 do
    charts[i].label:show(false)
  end
  if charts[1].canvas then charts[1].canvas:show(false) end
  exec:show(false)
  axis.hi:show(false)
  axis.lo:show(false)
  axis.t0:show(false)
  axis.t1:show(false)
  for i = 1, #board do board[i]:show(false) end
end

local function tone(on)
  if on then return "aqua" end
  return "text"
end

local function paint_trade()
  clamp()
  local amt = side == "buy" and buy_amt or sell_amt
  local unit = side == "buy" and "USDC" or "SOL"
  local step = side == "buy" and "+/-100" or "+/-1"
  local impact = "--"
  if snap and type(snap.quote) == "table" and snap.quote.impact then
    impact = snap.quote.impact
  end
  local px = "--"
  if snap and type(snap.quote) == "table" and snap.quote.px then px = snap.quote.px end
  local row = {56, 80, 104, 152, 176}
  if buy_box then
    buy_box:color(side == "buy" and "green" or "panel")
    sell_box:color(side == "sell" and "pink" or "panel")
    buy_box:pos(56, 58)
    sell_box:pos(172, 58)
    buy_box:show(true)
    sell_box:show(true)
    ticket[1]:text("Buy")
    sell_label:text("Sell")
  else
    ticket[1]:text(side == "buy" and "[Buy]" or "Buy")
    sell_label:text(side == "sell" and "[Sell]" or "Sell")
  end
  ticket[1]:pos(56, 56)
  ticket[1]:color("text")
  sell_label:pos(172, 56)
  sell_label:color("text")
  sell_label:show(true)
  if focus == 1 then
    tog_l:pos(34, 56)
    tog_r:pos(286, 56)
    tog_l:show(true)
    tog_r:show(true)
    show_edge(30, 54, 276, 26)
  end
  if focus == 2 then
    ticket[2]:text("< " .. tostring(amt) .. " " .. unit .. " " .. step .. " >")
  else
    ticket[2]:text(tostring(amt) .. " " .. unit .. "  " .. step)
  end
  ticket[2]:pos(22, 80)
  ticket[2]:color(tone(focus == 2))
  if focus == 3 then
    ticket[3]:text("< " .. DUR[dur_i] .. " >")
  else
    ticket[3]:text(DUR[dur_i])
  end
  ticket[3]:pos(22, 104)
  ticket[3]:color(tone(focus == 3))
  ticket[4]:text("Price impact  " .. tostring(impact) .. "    ~" .. tostring(px))
  ticket[4]:pos(22, 128)
  ticket[4]:color("text")
  ticket[5]:show(false)
  ticket[6]:text("Open streams")
  ticket[6]:pos(22, 152)
  ticket[6]:color(tone(focus == 4))
  ticket[7]:text("Leaderboard")
  ticket[7]:pos(22, 176)
  ticket[7]:color(tone(focus == 5))
  for i = 1, #ticket do
    if i ~= 5 then ticket[i]:show(true) end
  end
  if focus ~= 1 then
    show_edge(18, row[focus] - 2, 296, 24)
  end
  cursor:pos(2, row[focus])
  cursor:show(true)
  if focus == 1 then
    set_hint("< > switch side   ^v move   OK go")
  elseif focus == 2 then
    set_hint("< > " .. step .. " " .. unit .. "   ^v move   OK go")
  elseif focus == 3 then
    set_hint("< > 10m / 30m / 1h   ^v move   OK go")
  else
    set_hint("^v move   OK open")
  end
end

local function chart_xy(point)
  if type(point) ~= "table" then return nil end
  local along = point[1]
  local value = point[2]
  if along == nil then along = point.p end
  if value == nil then value = point.c end
  if type(along) ~= "number" or type(value) ~= "number" then return nil end
  return along, value
end

local function cents_label(cents)
  if cents < 0 then cents = 0 end
  local whole = math.floor(cents / 100)
  local frac = math.floor(cents % 100)
  if frac < 10 then return whole .. ".0" .. frac end
  return whole .. "." .. frac
end

local function dur_label(sec)
  sec = tonumber(sec) or 0
  if sec <= 0 then return "" end
  if sec % 3600 == 0 then return (sec / 3600) .. "h" end
  if sec % 60 == 0 then return (sec / 60) .. "m" end
  return sec .. "s"
end

local function draw_chart(canvas, points, color)
  canvas:clear("bg")
  local parsed = {}
  if type(points) == "table" then
    for i = 1, #points do
      local along, value = chart_xy(points[i])
      if along then parsed[#parsed + 1] = {along, value} end
    end
  end
  local w, h = 259, 43
  canvas:line(0, h, w, h, "dim")
  canvas:line(0, 0, 0, h, "dim")
  if #parsed == 0 then
    axis.hi:text("")
    axis.lo:text("")
    return
  end
  local minv, maxv = parsed[1][2], parsed[1][2]
  for i = 2, #parsed do
    if parsed[i][2] < minv then minv = parsed[i][2] end
    if parsed[i][2] > maxv then maxv = parsed[i][2] end
  end
  local span = maxv - minv
  if span < 4 then span = 4 end
  local pad = math.floor(span / 5)
  if pad < 2 then pad = 2 end
  local ymin = minv - pad
  local ymax = maxv + pad
  if ymax <= ymin then ymax = ymin + 1 end
  axis.hi:text(cents_label(ymax))
  axis.lo:text(cents_label(ymin))
  local function xy(i)
    local x = math.floor(parsed[i][1] * (w - 2) / 1000)
    if x < 0 then x = 0 end
    if x > w - 1 then x = w - 1 end
    local y = 1 + math.floor((ymax - parsed[i][2]) * (h - 2) / (ymax - ymin))
    if y < 1 then y = 1 end
    if y > h - 1 then y = h - 1 end
    return x, y
  end
  if #parsed == 1 then
    local x, y = xy(1)
    canvas:pixel(x, y, color)
    return
  end
  local prevx, prevy = xy(1)
  for i = 2, #parsed do
    local x, y = xy(i)
    canvas:line(prevx, prevy, x, y, color)
    prevx, prevy = x, y
  end
end

local function open_orders()
  local list = {}
  if not snap or type(snap.orders) ~= "table" then return list end
  for _, order in ipairs(snap.orders) do
    if order.status == "open" then list[#list + 1] = order end
  end
  return list
end

local function paint_streams()
  local list = open_orders()
  if #list == 0 then
    charts[1].label:text("No open streams")
    charts[1].label:pos(8, 70)
    charts[1].label:color("dim")
    charts[1].label:show(true)
    set_hint("CANCEL ticket")
    return
  end
  if stream_i > #list then stream_i = 1 end
  if stream_i < 1 then stream_i = 1 end
  local order = list[stream_i]
  local kind = order.side == "sell" and "Sell" or "Buy"
  charts[1].label:text(stream_i .. "/" .. #list .. "  " .. kind)
  charts[1].label:pos(8, 62)
  charts[1].label:color("aqua")
  charts[1].label:show(true)
  charts[2].label:text(order.flow or ("spent " .. (order.filled or "0")))
  charts[2].label:pos(8, 82)
  charts[2].label:color("text")
  charts[2].label:show(true)
  charts[3].label:text("avg " .. (order.avg or "--") .. "   " .. tostring(order.pct or "0.00") .. "%")
  charts[3].label:pos(8, 96)
  charts[3].label:color("text")
  charts[3].label:show(true)
  local plot_y = 128
  if charts[1].canvas then
    charts[1].canvas:pos(52, plot_y)
    charts[1].canvas:show(true)
    local color = order.side == "sell" and "pink" or "green"
    draw_chart(charts[1].canvas, order.px, color)
  end
  axis.hi:pos(4, plot_y)
  axis.lo:pos(4, plot_y + 30)
  axis.t0:pos(52, plot_y + 46)
  axis.t1:pos(180, plot_y + 46)
  axis.t1:text(dur_label(order.sec))
  axis.hi:show(true)
  axis.lo:show(true)
  axis.t0:show(true)
  axis.t1:show(true)
  set_hint("U/D order   SEL stop   CANCEL ticket")
end

local function board_page()
  local page = snap and snap.board
  if type(page) ~= "table" then return nil, {}, 0, 0 end
  local rows = type(page.rows) == "table" and page.rows or {}
  local total = type(page.total) == "number" and page.total or #rows
  local off = type(page.offset) == "number" and page.offset or 0
  return page, rows, total, off
end

local function paint_board()
  local _, rows, total, off = board_page()
  if total > 0 and board_sel > total then board_sel = total end
  if board_sel < 0 then board_sel = 0 end
  local view = 1
  if total > 0 then
    local anchor = board_sel >= 1 and board_sel or total
    view = anchor - 2
    if view < 1 then view = 1 end
    local max_view = total - BOARD_VIS + 1
    if max_view < 1 then max_view = 1 end
    if view > max_view then view = max_view end
  end
  for i = 1, BOARD_VIS do
    local rank = view + i - 1
    if total > 0 and rank <= total then
      local row = nil
      if rank >= off + 1 and rank <= off + #rows then
        row = rows[rank - off]
      end
      local name = row and (row.name or "?") or "..."
      local pnl = row and (row.pnl or "--") or ""
      local you = row and row.me and " you" or ""
      board[i]:text(tostring(rank) .. " " .. name .. you .. "  " .. pnl)
      board[i]:pos(20, 64 + (i - 1) * 18)
      if board_sel == rank then
        board[i]:color("aqua")
      elseif row and row.me then
        board[i]:color("green")
      else
        board[i]:color("text")
      end
      board[i]:show(true)
    else
      board[i]:show(false)
    end
  end
  if board_sel >= 1 then
    local slot = board_sel - view + 1
    if slot >= 1 and slot <= BOARD_VIS then
      local y = 64 + (slot - 1) * 18
      show_edge(16, y - 1, 288, 18)
      cursor:pos(2, y)
      cursor:show(true)
    end
  end
  board[7]:text("Rename  " .. (nick or ""))
  board[7]:pos(20, 178)
  board[7]:color(board_sel == 0 and "aqua" or "text")
  board[7]:show(true)
  if board_sel == 0 then
    show_edge(16, 176, 288, 22)
    cursor:pos(2, 178)
    cursor:show(true)
  end
  if bar_track and total > BOARD_VIS then
    local span = BOARD_VIS * 18 - 4
    local thumb_h = math.floor(span * BOARD_VIS / total)
    if thumb_h < 8 then thumb_h = 8 end
    if thumb_h > span then thumb_h = span end
    local travel = span - thumb_h
    local max_view = total - BOARD_VIS + 1
    local along = 0
    if max_view > 1 then along = (view - 1) / (max_view - 1) end
    bar_track:pos(310, 64)
    bar_track:size(6, span)
    bar_track:show(true)
    bar_thumb:pos(310, 64 + math.floor(travel * along))
    bar_thumb:size(6, thumb_h)
    bar_thumb:show(true)
  end
  local shown = board_sel >= 1 and board_sel or (total > 0 and total or 0)
  local above = view > 1 and "^" or " "
  local below = (view + BOARD_VIS - 1 < total) and "v" or " "
  local pos = above .. " " .. tostring(shown) .. "/" .. tostring(total) .. " " .. below
  if board_sel == 0 then
    set_hint(pos .. "  OK rename  CANCEL ticket")
  else
    set_hint(pos .. "  CANCEL ticket")
  end
end

local function paint()
  hide_all()
  if screen == 2 then
    paint_streams()
  elseif screen == 3 then
    paint_board()
  else
    screen = 1
    paint_trade()
  end
  arm_tick()
end

local function show_net(text)
  price:text((text or "offline"):sub(1, 18))
  price:color("orange")
end

local function note_finished()
  if not snap or not snap.orders then return end
  for _, order in ipairs(snap.orders) do
    if order.status ~= "open" and order.id and not seen[order.id] then
      seen[order.id] = true
      if primed then
        ui.toast(order.status == "canceled" and "Canceled" or "Stream done")
      end
    end
  end
  primed = true
end

local function open_count()
  return #open_orders()
end

local refresh

local function fmt_num(n, places)
  if type(n) ~= "number" or n ~= n or n < 0 then n = 0 end
  local scale = 1
  local i = 0
  while i < places do
    scale = scale * 10
    i = i + 1
  end
  local scaled = math.floor(n * scale + 0.5)
  local whole = math.floor(scaled / scale)
  local frac = scaled - whole * scale
  if frac < 0 then frac = 0 end
  local digits = tostring(frac)
  while #digits < places do digits = "0" .. digits end
  return tostring(whole) .. "." .. digits
end

local function tick()
  if screen ~= 2 or modal then return end
  local list = open_orders()
  local order = list[stream_i]
  if not order or type(order.inR) ~= "number" then return end
  local now_ms = sys and sys.millis and sys.millis() or snap_ms
  local dt = (now_ms - snap_ms) / 1000
  if dt < 0 then dt = 0 end
  if dt > 2.5 then dt = 2.5 end
  local inn = (order.in0 or 0) + order.inR * dt
  if type(order.cap) == "number" and inn > order.cap then inn = order.cap end
  local out = (order.out0 or 0) + (order.outR or 0) * dt
  if out < 0 then out = 0 end
  local in_unit = order.side == "sell" and "SOL" or "USDC"
  local out_unit = order.side == "sell" and "USDC" or "SOL"
  local in_places = order.side == "sell" and 4 or 2
  local out_places = order.side == "sell" and 2 or 4
  charts[2].label:text("spent " .. fmt_num(inn, in_places) .. " " .. in_unit .. " -> got " .. fmt_num(out, out_places) .. " " .. out_unit)
end

local function set_poll()
  local want = open_count() > 0 and FAST_MS or SLOW_MS
  if poll_timer and want == poll_ms then return end
  if poll_timer then timer.cancel(poll_timer) end
  poll_ms = want
  poll_timer = timer.every(want, function() refresh() end)
end

arm_tick = function()
  local want = screen == 2 and open_count() > 0
  if want and not tick_timer then
    tick_timer = timer.every(200, tick)
  elseif not want and tick_timer then
    timer.cancel(tick_timer)
    tick_timer = nil
  end
end

local function apply(data)
  snap = data
  local me = data.me
  if me then
    if data.stale then
      price:text((data.price or "--") .. "?")
      price:color("orange")
    else
      price:text(data.price or "--")
      price:color("text")
    end
    bal:text((me.usdc or "--") .. " USDC  " .. (me.sol or "--") .. " SOL")
    pnl:text("PnL " .. (me.pnl or "--"))
    if type(me.pnl) == "string" and me.pnl:sub(1, 1) == "-" then
      pnl:color("pink")
    elseif type(me.pnl) == "string" and me.pnl ~= "+0.00" and me.pnl ~= "--" then
      pnl:color("green")
    else
      pnl:color("text")
    end
  end
  note_finished()
  if sys and sys.millis then snap_ms = sys.millis() end
  paint()
  set_poll()
  arm_tick()
end

refresh = function()
  if inflight or busy or modal or not nick then
    if screen == 3 then board_dirty = true end
    return
  end
  inflight = true
  board_dirty = false
  local requested = board_off
  local amt = amount_now()
  local ord = ""
  local open = open_orders()
  if screen ~= 3 and open[stream_i] and open[stream_i].id then
    ord = "&ord=" .. enc(open[stream_i].id)
  end
  local page = ""
  if screen == 3 then
    page = string.format("&board=1&off=%d&lim=%d", board_off, BOARD_LIM)
  end
  local url = string.format(
    "%s/v1/badge?name=%s&ticket=1&side=%s&amount=%d&seconds=%d%s%s",
    BASE, enc(nick), side, amt, DUR_S[dur_i], ord, page
  )
  http.get(url, function(ok, res)
    inflight = false
    if not ok then
      show_net(res)
      return
    end
    if res.status ~= 200 then
      show_net("HTTP " .. tostring(res.status))
      return
    end
    local data = json.decode(res.body)
    if type(data) == "table" then apply(data) end
    if board_dirty or (screen == 3 and board_off ~= requested) then
      board_dirty = false
      refresh()
    end
  end)
end

local function post(path, body, ok_text)
  if busy then return end
  busy = true
  local timed = timer.after(8000, function()
    if busy then
      busy = false
      ui.toast("No answer")
    end
  end)
  http.post(BASE .. path, body, function(ok, res)
    timer.cancel(timed)
    busy = false
    if not ok then
      ui.toast(tostring(res):sub(1, 24))
      return
    end
    local data = json.decode(res.body)
    if res.status ~= 200 then
      local err = type(data) == "table" and data.error or ("HTTP " .. res.status)
      ui.toast(tostring(err):sub(1, 32))
      return
    end
    if type(data) == "table" then apply(data) end
    if ok_text then ui.toast(ok_text) end
  end)
end

local function place()
  local amt = amount_now()
  if amt < 1 then
    ui.toast("Not enough")
    return
  end
  local unit = side == "buy" and "USDC" or "SOL"
  modal = true
  ui.confirm(side .. " " .. amt .. " " .. unit .. " / " .. DUR[dur_i] .. "?", function(yes)
    modal = false
    if not yes then return end
    post("/v1/badge/orders", {
      amount = tostring(amt),
      name = nick,
      seconds = DUR_S[dur_i],
      side = side,
      ticket = 1,
    }, "Streaming")
  end)
end

local function bump(delta)
  local maxu, maxs = free_amounts()
  if side == "buy" then
    local nextv = buy_amt + delta * 100
    if maxu > 0 and nextv > maxu then nextv = maxu end
    if nextv < 100 and (maxu == 0 or maxu >= 100) then nextv = 100 end
    if nextv < 1 then nextv = maxu end
    buy_amt = nextv
  else
    local nextv = sell_amt + delta
    if maxs > 0 and nextv > maxs then nextv = maxs end
    if nextv < 1 and (maxs == 0 or maxs >= 1) then nextv = 1 end
    if nextv < 1 then nextv = maxs end
    sell_amt = nextv
  end
  clamp()
end

local function trade_key(key)
  if key == "up" then
    focus = focus - 1
    if focus < 1 then focus = 5 end
  elseif key == "down" then
    focus = focus + 1
    if focus > 5 then focus = 1 end
  elseif key == "left" or key == "right" then
    local delta = key == "right" and 1 or -1
    if focus == 1 then
      side = side == "buy" and "sell" or "buy"
    elseif focus == 2 then
      bump(delta)
    elseif focus == 3 then
      dur_i = (dur_i - 1 + delta) % 3 + 1
    end
  elseif key == "select" then
    if focus == 4 then
      screen = 2
      refresh()
    elseif focus == 5 then
      screen = 3
      local rank = 1
      if snap and snap.me and type(snap.me.rank) == "number" and snap.me.rank > 0 then
        rank = snap.me.rank
      end
      board_sel = rank
      board_off = math.max(0, rank - 5)
      if snap then snap.board = nil end
      refresh()
    else
      place()
      return true
    end
  else
    return true
  end
  paint()
  return true
end

local function stream_key(key)
  local list = open_orders()
  if key == "up" or key == "down" or key == "left" or key == "right" then
    if #list > 1 then
      local delta = (key == "down" or key == "right") and 1 or -1
      stream_i = (stream_i - 1 + delta) % #list + 1
      paint()
    end
    return true
  end
  if key == "select" and list[stream_i] then
    local id = list[stream_i].id
    modal = true
    ui.confirm("Stop this stream?", function(yes)
      modal = false
      if not yes then return end
      post("/v1/badge/orders/cancel", {id = id, name = nick, ticket = 1}, nil)
    end)
  end
  return true
end

function rename()
  modal = true
  ui.input("Nickname", 12, function(text)
    modal = false
    if not text or text == "" then return end
    nick = text
    storage.set("nick", nick)
    refresh()
  end)
end

local function follow_board()
  if board_sel < 1 then return end
  local _, rows, total, off = board_page()
  local n = #rows
  local next_off = board_off
  if n == 0 or board_sel < off + 1 or board_sel > off + n then
    next_off = math.max(0, board_sel - 6)
  elseif board_sel <= off + 2 and off > 0 then
    next_off = math.max(0, off - 6)
  elseif board_sel >= off + n - 1 and off + n < total then
    next_off = math.max(0, board_sel - 6)
  end
  if next_off ~= board_off then
    board_off = next_off
    refresh()
  end
end

local function board_key(key)
  local _, _, total = board_page()
  if key == "up" or key == "down" then
    if key == "down" then
      if board_sel >= 1 and board_sel >= total then
        board_sel = 0
      elseif board_sel >= 1 then
        board_sel = board_sel + 1
      end
    elseif board_sel == 0 then
      board_sel = total > 0 and total or 0
    elseif board_sel > 1 then
      board_sel = board_sel - 1
    end
    follow_board()
    paint()
    return true
  end
  if key == "left" or key == "right" then return true end
  if key == "select" and board_sel == 0 then rename() end
  return true
end

function on_key(key)
  if modal or busy then return true end
  if key == "back" then
    if screen ~= 1 then
      screen = 1
      paint()
      return true
    end
    return false
  end
  if screen == 2 then return stream_key(key) end
  if screen == 3 then return board_key(key) end
  return trade_key(key)
end

if not http or not json then
  price:text("Update OS")
  return
end

print("mato host " .. host .. " badge " .. tostring(badge.id()))
paint()

local saved = storage.get("nick")
if type(saved) == "string" and #saved > 0 then
  nick = saved
else
  modal = true
  ui.input("Nickname", 12, function(text)
    modal = false
    nick = (type(text) == "string" and #text > 0) and text or "trader"
    storage.set("nick", nick)
    refresh()
  end)
end

set_poll()
if nick then refresh() end
