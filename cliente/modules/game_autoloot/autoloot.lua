local autoLootItemsPanel

local function onAutoLoot(protocol, opcode, data)
  if not data or not data.items then
    return
  end

  for _, entry in ipairs(data.items) do
    local id = entry.id
    local count = entry.count or 0
    if id and count > 0 then
      showItem(id, count)
    end
  end
end

function init()
  autoLootItemsPanel = g_ui.loadUI("autoloot", modules.game_interface.getMapPanel())
  ProtocolGame.registerExtendedJSONOpcode(56, onAutoLoot)
end

function terminate()
  ProtocolGame.unregisterExtendedJSONOpcode(56)
  if autoLootItemsPanel then
    autoLootItemsPanel:destroy()
    autoLootItemsPanel = nil
  end
end

function showItem(id, count)
  local key = tostring(id)
  local lootWidget = autoLootItemsPanel[key]

  if lootWidget then
    lootWidget:setItemCount(lootWidget:getItemCount() + count)
    return
  end

  lootWidget = g_ui.createWidget("AutoLootItem", autoLootItemsPanel)
  lootWidget:setId(key)
  lootWidget:setItemId(id)
  lootWidget:setItemCount(count)

  g_effects.fadeIn(lootWidget, 500)
  scheduleEvent(function() g_effects.fadeOut(lootWidget, 500) end, 5000)
  scheduleEvent(function() lootWidget:destroy() end, 5500)
end
