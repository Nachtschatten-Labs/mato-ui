-- Mato paper: play-money SOL/USDC streams for a Solana OS badge.
-- The badge only draws and calls the paper server. Clearing runs on the
-- server because live Mato flows do not fit in the badge's 32-bit numbers,
-- and because every badge has to share one book.
--
-- Edit config.json "host" and the same name in app.json "hosts" before
-- installing. HTTP goes out through the badge server, so the host must be
-- public HTTPS on port 443.

local cfg = fs.json("config.json")
local host = "paper.example.com"
if type(cfg) == "table" and type(cfg.host) == "string" then
  host = cfg.host
end
host = host:gsub("^https://", ""):gsub("/.*$", ""):lower()
if not host:match("^[-a-z0-9.]+$") or host:find("..", 1, true) then
  host = "paper.example.com"
end
local BASE = "https://" .. host

local screen = 1
local snap = nil
local rows = {}
local nick = nil
local busy = false
local modal = false
local inflight = false
local primed = false
local seen = {}

ui.bg("bg")
ui.label(8, 2, "Mato paper", {size = 14, color = "green"})
local price = ui.label(150, 0, "--", {size = 20, w = 162, align = "right"})
local bal = ui.label(8, 26, "10,000 USDC   100 SOL", {size = 12, w = 304})
local pnl = ui.label(8, 42, "PnL --", {size = 12, w = 304, color = "dim"})
local list

local function set_hint(text)
  ui.hint(text)
end

local function enc(text)
  return (text:gsub("[^%w%-%.]", function(char)
    return string.format("%%%02X", string.byte(char))
  end))
end

local function show_net(text)
  price:text((text or "offline"):sub(1, 16))
  price:color("orange")
end

local function paint()
  local titles = {"Trade", "Streams", "Board"}
  set_hint(titles[screen] .. "   U/D move   SELECT")
  rows = {}
  local view = {}
  if not snap then
    view[1] = "Connecting..."
    rows[1] = {kind = "info"}
  elseif screen == 1 then
    for _, preset in ipairs(snap.presets or {}) do
      rows[#rows + 1] = {kind = "preset", preset = preset}
      view[#view + 1] = {
        title = preset.title or "Stream",
        sub = (preset.sub or "") .. "  px " .. (preset.px or "--"),
        right = preset.impact or "--",
      }
    end
    rows[#rows + 1] = {kind = "custom"}
    view[#view + 1] = {title = "Custom", sub = "buy 100 60", right = ""}
    rows[#rows + 1] = {kind = "nav", screen = 2}
    view[#view + 1] = {title = "My streams", sub = "cancel from here"}
    rows[#rows + 1] = {kind = "nav", screen = 3}
    view[#view + 1] = {title = "Leaderboard"}
  elseif screen == 2 then
    local any = false
    for _, order in ipairs(snap.orders or {}) do
      if order.status == "open" then
        any = true
        rows[#rows + 1] = {kind = "cancel", id = order.id}
        view[#view + 1] = {
          title = order.title or "Stream",
          sub = order.sub or "",
          right = order.right or "",
        }
      end
    end
    if not any then
      rows[#rows + 1] = {kind = "info"}
      view[#view + 1] = {title = "No open streams", sub = "SELECT does nothing"}
    end
    rows[#rows + 1] = {kind = "nav", screen = 1}
    view[#view + 1] = {title = "Back to trade"}
  else
    for _, row in ipairs(snap.top or {}) do
      rows[#rows + 1] = {kind = "info"}
      view[#view + 1] = {title = row.name or "?", right = row.pnl or "--"}
    end
    if #view == 0 then
      rows[#rows + 1] = {kind = "info"}
      view[#view + 1] = {title = "No players yet"}
    end
    rows[#rows + 1] = {kind = "rename"}
    view[#view + 1] = {title = "Rename", sub = nick or ""}
    rows[#rows + 1] = {kind = "nav", screen = 1}
    view[#view + 1] = {title = "Back to trade"}
  end
  list:items(view)
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
    pnl:text("PnL " .. (me.pnl or "--") .. "  #" .. tostring(me.rank or "-"))
    if type(me.pnl) == "string" and me.pnl:sub(1, 1) == "-" then
      pnl:color("pink")
    elseif type(me.pnl) == "string" and me.pnl ~= "+0.00" and me.pnl ~= "--" then
      pnl:color("green")
    else
      pnl:color("dim")
    end
  end
  note_finished()
  paint()
end

local function refresh()
  if inflight or busy or modal or not nick then return end
  inflight = true
  http.get(BASE .. "/v1/badge?name=" .. enc(nick), function(ok, res)
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

function confirm_preset(preset)
  local text = (preset.title or "Stream") .. " / " .. (preset.sub or "")
  modal = true
  ui.confirm(text .. "?", function(yes)
    modal = false
    if not yes then return end
    post("/v1/badge/orders", {
      name = nick,
      preset = preset.id,
    }, "Streaming")
  end)
end

function custom_order()
  modal = true
  ui.input("buy 100 60", 24, function(text)
    modal = false
    if not text then return end
    local side, amount, seconds = text:match("^(%a+)%s+([%d%.]+)%s+(%d+)$")
    if side ~= "buy" and side ~= "sell" then
      ui.toast("Use: buy 100 60")
      return
    end
    post("/v1/badge/orders", {
      amount = amount,
      name = nick,
      seconds = tonumber(seconds),
      side = side,
    }, "Streaming")
  end)
end

function confirm_cancel(id)
  modal = true
  ui.confirm("Stop this stream?", function(yes)
    modal = false
    if not yes then return end
    post("/v1/badge/orders/cancel", {id = id, name = nick}, nil)
  end)
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

function on_key(key)
  if modal or busy then return true end
  if key == "left" or key == "right" then
    local dir = key == "right" and 1 or -1
    screen = (screen - 1 + dir) % 3 + 1
    paint()
    return true
  end
  return false
end

if not http or not json or not ui.list then
  price:text("Update OS")
  return
end

list = ui.list(0, 58, ui.W, ui.H - 58 - 16, {"Connecting..."}, {
  on_select = function(index)
    local row = rows[index]
    if not row or modal or busy then return end
    if row.kind == "nav" then
      screen = row.screen
      timer.after(1, paint)
    elseif row.kind == "preset" then
      confirm_preset(row.preset)
    elseif row.kind == "custom" then
      custom_order()
    elseif row.kind == "cancel" then
      confirm_cancel(row.id)
    elseif row.kind == "rename" then
      rename()
    end
  end,
})

print("mato paper host " .. host .. " badge " .. tostring(badge.id()))
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

timer.every(4000, refresh)
if nick then refresh() end
