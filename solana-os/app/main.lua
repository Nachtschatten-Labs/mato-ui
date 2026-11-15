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
local nav = 2
local stream_i = 1
local board_i = 1
local poll_timer = nil
local poll_ms = 0

ui.bg("bg")
ui.label(8, 2, "Mato", {size = 14, color = "green"})
local price = ui.label(120, 2, "--", {size = 14, w = 192, align = "right"})
local usdc = ui.label(8, 20, "10000.00 USDC", {size = 20, w = 304})
local sol = ui.label(8, 44, "100.0000 SOL", {size = 20, w = 304})
local pnl = ui.label(8, 68, "PnL --", {size = 32, w = 304, align = "center"})

local ticket = {
  ui.label(8, 104, "", {size = 20, w = 304}),
  ui.label(8, 128, "", {size = 20, w = 304}),
  ui.label(8, 152, "", {size = 20, w = 304}),
  ui.label(8, 176, "", {size = 14, w = 304}),
  ui.label(8, 194, "", {size = 14, w = 304}),
}
local charts = {}
for i = 1, 3 do
  charts[i] = {label = ui.label(8, 0, "", {size = 12, w = 304})}
  charts[i].label:show(false)
  if ui.canvas then
    charts[i].canvas = ui.canvas(8, 0, 304, 16, {color = "bg"})
    charts[i].canvas:show(false)
  end
end
local board = {}
for i = 1, 7 do
  board[i] = ui.label(8, 0, "", {size = 14, w = 304})
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

local function hide_all()
  for i = 1, #ticket do ticket[i]:show(false) end
  for i = 1, 3 do
    charts[i].label:show(false)
    if charts[i].canvas then charts[i].canvas:show(false) end
  end
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
  local impact = "--"
  if snap and type(snap.quote) == "table" and snap.quote.impact then
    impact = snap.quote.impact
  end
  ticket[1]:text((focus == 1 and "> " or "  ") .. (side == "buy" and "Buy" or "Sell"))
  ticket[1]:color(tone(focus == 1))
  ticket[2]:text((focus == 2 and "> " or "  ") .. tostring(amt) .. " " .. unit)
  ticket[2]:color(tone(focus == 2))
  ticket[3]:text((focus == 3 and "> " or "  ") .. DUR[dur_i])
  ticket[3]:color(tone(focus == 3))
  ticket[4]:text("impact " .. tostring(impact))
  ticket[4]:color("dim")
  local dest = nav == 3 and "Leaderboard" or "Open streams"
  ticket[5]:text((focus == 4 and "> " or "  ") .. dest)
  ticket[5]:color(tone(focus == 4))
  for i = 1, #ticket do ticket[i]:show(true) end
  if focus == 2 then
    set_hint(side == "buy" and "L/R 100 USDC   SEL go" or "L/R 1 SOL   SEL go")
  elseif focus == 3 then
    set_hint("L/R time   SEL go")
  elseif focus == 4 then
    set_hint("L/R screen   SEL open")
  else
    set_hint("L/R side   SEL go")
  end
end

local function draw_chart(canvas, points, color)
  canvas:clear("bg")
  if type(points) ~= "table" or #points < 1 then return end
  local minv, maxv = points[1], points[1]
  for i = 2, #points do
    if points[i] < minv then minv = points[i] end
    if points[i] > maxv then maxv = points[i] end
  end
  if maxv == minv then maxv = minv + 1 end
  local w, h, n = 303, 15, #points
  if n == 1 then
    canvas:pixel(0, 8, color)
    return
  end
  local prevx, prevy
  for i = 1, n do
    local x = math.floor((i - 1) * w / (n - 1))
    local y = math.floor((maxv - points[i]) * h / (maxv - minv))
    if prevx then canvas:line(prevx, prevy, x, y, color) end
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
    ticket[1]:text("No open streams")
    ticket[1]:color("dim")
    ticket[1]:show(true)
    set_hint("CANCEL trade   L/R screen")
    return
  end
  if stream_i > #list then stream_i = 1 end
  if stream_i < 1 then stream_i = #list end
  for i = 1, 3 do
    local order = list[i]
    local row = charts[i]
    if order then
      local y = 104 + (i - 1) * 32
      local mark = i == stream_i and "> " or "  "
      local kind = order.side == "sell" and "Sell" or "Buy"
      row.label:text(mark .. kind .. " " .. (order.filled or "0") .. "  avg " .. (order.avg or "--") .. "  " .. tostring(order.pct or 0) .. "%")
      row.label:pos(8, y)
      row.label:color(i == stream_i and "aqua" or "text")
      row.label:show(true)
      if row.canvas then
        row.canvas:pos(8, y + 14)
        row.canvas:show(true)
        local color = order.side == "sell" and "pink" or "green"
        draw_chart(row.canvas, order.px, color)
      end
    end
  end
  set_hint("U/D pick   SEL stop   L/R screen")
end

local function paint_board()
  local rows = (snap and snap.top) or {}
  local shown = math.min(#rows, 6)
  if board_i > shown + 1 then board_i = 1 end
  if board_i < 1 then board_i = shown + 1 end
  for i = 1, 6 do
    local row = rows[i]
    if i <= shown and row then
      local mark = board_i == i and "> " or "  "
      board[i]:text(mark .. tostring(i) .. " " .. (row.name or "?") .. "  " .. (row.pnl or "--"))
      board[i]:pos(8, 104 + (i - 1) * 16)
      board[i]:color(board_i == i and "aqua" or "text")
      board[i]:show(true)
    else
      board[i]:show(false)
    end
  end
  local mark = board_i == shown + 1 and "> " or "  "
  board[7]:text(mark .. "Rename  " .. (nick or ""))
  board[7]:pos(8, 104 + shown * 16)
  board[7]:color(board_i == shown + 1 and "aqua" or "text")
  board[7]:show(true)
  set_hint("U/D pick   L/R screen   CANCEL trade")
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

local function set_poll()
  local want = open_count() > 0 and FAST_MS or SLOW_MS
  if poll_timer and want == poll_ms then return end
  if poll_timer then timer.cancel(poll_timer) end
  poll_ms = want
  poll_timer = timer.every(want, function() refresh() end)
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
    usdc:text((me.usdc or "--") .. " USDC")
    sol:text((me.sol or "--") .. " SOL")
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
  paint()
  set_poll()
end

refresh = function()
  if inflight or busy or modal or not nick then return end
  inflight = true
  local amt = amount_now()
  local url = string.format(
    "%s/v1/badge?name=%s&ticket=1&side=%s&amount=%d&seconds=%d",
    BASE, enc(nick), side, amt, DUR_S[dur_i]
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
    if focus < 1 then focus = 4 end
  elseif key == "down" then
    focus = focus + 1
    if focus > 4 then focus = 1 end
  elseif key == "left" or key == "right" then
    local delta = key == "right" and 1 or -1
    if focus == 1 then
      side = side == "buy" and "sell" or "buy"
    elseif focus == 2 then
      bump(delta)
    elseif focus == 3 then
      dur_i = (dur_i - 1 + delta) % 3 + 1
    else
      nav = nav == 2 and 3 or 2
    end
  elseif key == "select" then
    if focus == 4 then
      screen = nav
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
  if key == "up" or key == "down" then
    if #list > 0 then
      local delta = key == "down" and 1 or -1
      stream_i = (stream_i - 1 + delta) % #list + 1
      paint()
    end
    return true
  end
  if key == "left" then
    screen = 1
    paint()
    return true
  end
  if key == "right" then
    screen = 3
    paint()
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

local function board_key(key)
  local rows = (snap and snap.top) or {}
  local shown = math.min(#rows, 6)
  local last = shown + 1
  if key == "up" or key == "down" then
    local delta = key == "down" and 1 or -1
    board_i = (board_i - 1 + delta) % last + 1
    paint()
    return true
  end
  if key == "left" then
    screen = 1
    paint()
    return true
  end
  if key == "right" then
    screen = 2
    paint()
    return true
  end
  if key == "select" and board_i == last then rename() end
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
