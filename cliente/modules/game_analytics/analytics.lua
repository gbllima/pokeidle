local window, analyzerPanel, currentSelector

local ExtendedOpcodes = {
  AnalyticsLoot = 207,
  AnalyticsSupply = 208,
  AnalyticsKill = 209,
  AnalyticsExperience = 210,
  AnalyticsRequestSession = 211
}

function init()
  ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.AnalyticsLoot, onAnalyticsLoot)
  ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.AnalyticsSupply, onAnalyticsSupply)
  ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.AnalyticsKill, onAnalyticsKill)
  ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.AnalyticsExperience, onAnalyticsExperience)
  ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.AnalyticsRequestSession, onAnalyticsSessionData)

  connect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })

  window = g_ui.loadUI("analytics", modules.game_interface.getRightPanel())
  window:setup()

  analyzerPanel = AnalyzerPanel:new(window.contentsPanel)
end

function terminate()
  ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.AnalyticsLoot)
  ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.AnalyticsSupply)
  ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.AnalyticsKill)
  ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.AnalyticsExperience)
  ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.AnalyticsRequestSession)

  disconnect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })

  onGameEnd()

  currentSelector = nil

  window:destroy()
  window = nil
end

function onAnalyticsLoot(protocol, opcode, buffer)
  local status, data = pcall(json.decode, buffer)
  if not status then
    return
  end

  for _, item in pairs(data.items or {}) do
    local dummyItem = {
      getId = function() return item.id end,
      getCount = function() return item.count end
    }

    local name = item.name or "Unknown Item"
    local price = item.price or 0

    onLootAnalyzer(dummyItem, name, price)
  end
end

function onAnalyticsSupply(protocol, opcode, buffer)
  local status, data = pcall(json.decode, buffer)
  if not status then
    return
  end

  for _, item in pairs(data.items or {}) do
    local serverId = item.serverId or item.id
    local clientId = item.id

    local dummyItem = {
      getId = function() return clientId end,
      getCount = function() return item.count end
    }

    local itemType = ItemType[serverId]
    local name = itemType and itemType.name or (item.name or "Unknown Item")
    local price = tonumber(item.price) or 0

    onSupplyAnalyzer(dummyItem, name, price)
  end
end

function onAnalyticsKill(protocol, opcode, buffer)
  local status, data = pcall(json.decode, buffer)
  if not status then
    return
  end

  local outfit = nil
  if data.outfit then
    outfit = {
      type = tonumber(data.outfit.lookType) or 0,
      head = tonumber(data.outfit.lookHead) or 0,
      body = tonumber(data.outfit.lookBody) or 0,
      legs = tonumber(data.outfit.lookLegs) or 0,
      feet = tonumber(data.outfit.lookFeet) or 0,
      addons = tonumber(data.outfit.lookAddons) or 0,
      category = ThingCategoryCreature
    }

    if outfit.type == 0 then
      outfit.type = 2
    end
  end

  onKillAnalyzer(data.monster, outfit)
end

function onAnalyticsExperience(protocol, opcode, buffer)
  local status, data = pcall(json.decode, buffer)
  if not status then
    return
  end

  onExperienceChange(g_game.getLocalPlayer(), data.experience, data.oldExperience)
end

function onAnalyticsSessionData(protocol, opcode, buffer)
  local status, data = pcall(json.decode, buffer)
  if not status then
    return
  end

  if analyzerPanel then
    analyzerPanel:doClear()
  end
end

function onLootAnalyzer(item, name, price)
  if analyzerPanel then
    analyzerPanel:onUpdateLoot(item, name, price)
  end
end

function onSupplyAnalyzer(item, name, price)
  if analyzerPanel then
    analyzerPanel:onUpdateSupply(item, name, price)
  end
end

function onKillAnalyzer(name, outfit)
  if analyzerPanel then
    analyzerPanel:onUpdateKill(name, outfit)
  end
end

function onExperienceChange(player, experience, oldExperience)
  if analyzerPanel then
    analyzerPanel:onUpdateExperience(player, experience, oldExperience)
  end
end

function onGameStart()
  analyzerPanel = AnalyzerPanel:new(window.contentsPanel)
end

function onGameEnd()
  if analyzerPanel then
    analyzerPanel:doStopSession()
  end
end

function onCreateMenu()
  local menu = g_ui.createWidget("PopupMenu")

  menu:addOption(tr("Start new session"), function()
    if analyzerPanel then
      analyzerPanel:doClear()
    end
  end)

  menu:addOption(tr("Copy to clipboard"), function()
    if analyzerPanel then
      analyzerPanel:doClipboard()
    end
  end)

  menu:display()
end

function setSelectorPanel(button)
  local lastSelector = currentSelector or {
    panel = window.contentsPanel.analyzer.hunt,
    button = window.contentsPanel.selector.hunt
  }

  currentSelector = {
    panel = window.contentsPanel.analyzer[button:getId()],
    button = button
  }

  if lastSelector then
    lastSelector.button:setOn(false)
    lastSelector.panel:hide()
  end

  if currentSelector then
    currentSelector.button:setOn(true)
    currentSelector.panel:show()
  end
end

function toggleAnalytics()
  if window:isVisible() then
    window:close()
  else
    window:open()
  end
end
