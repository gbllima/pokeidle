local THUMB_TIME = 2 * 60 * 1000
local OPCODE = 145

local window = nil
local host = nil
local stop = nil
local spectateControlWatching = nil
local spectateControlStreaming = nil
local viewerManagerWindow = nil

local protocolGame = nil
isHosting = false
isSpectating = false
local lastFetchTime = 0
local hostStartTime = 0
local currentDescription = ""
local currentPassword = ""

function init()
  connect(
    g_game,
    {
      onGameStart = create,
      onGameEnd = destroy
    }
  )

  ProtocolGame.registerOpcode(GameServerOpcodes.GameServerSpectate, onStartSpectate)
  ProtocolGame.registerOpcode(0x2, onCallback)

  pcall(function()
    ProtocolGame.unregisterExtendedOpcode(OPCODE)
  end)

  ProtocolGame.registerExtendedOpcode(OPCODE, onExtendedOpcode)
end

function terminate()
  disconnect(
    g_game,
    {
      onGameStart = create,
      onGameEnd = destroy
    }
  )

  ProtocolGame.unregisterOpcode(GameServerOpcodes.GameServerSpectate)
  ProtocolGame.unregisterOpcode(0x2)
  ProtocolGame.unregisterExtendedOpcode(OPCODE)

  destroy()
end

function create()
end

function createMainUI()
  if window then
    return
  end
  
  window = g_ui.loadUI("spectate", modules.game_interface.getRootPanel())
  if window then
    window:hide()
  end

  host = g_ui.loadUI("host", modules.game_interface.getRootPanel())
  if host then
    host:hide()
  end

  stop = g_ui.loadUI("stop", modules.game_interface.getRootPanel())
  if stop then
    stop:hide()
  end

  protocolGame = g_game.getProtocolGame()
end

function createWatchingControl()
  if spectateControlWatching then
    return spectateControlWatching
  end
  
  spectateControlWatching = g_ui.loadUI("spectateControl_watching", modules.game_interface.getRightPanel())
  if spectateControlWatching then
    spectateControlWatching:setup()
    spectateControlWatching:hide()
  end
  
  return spectateControlWatching
end

function createStreamingControl()
  if spectateControlStreaming then
    return spectateControlStreaming
  end
  
  spectateControlStreaming = g_ui.loadUI("spectateControl_streaming", modules.game_interface.getRightPanel())
  if spectateControlStreaming then
    spectateControlStreaming:setup()
    spectateControlStreaming:hide()
  end
  
  return spectateControlStreaming
end

function destroy()
  isHosting = false
  isSpectating = false
  lastFetchTime = 0
  hostStartTime = 0

  if window then
    window:destroy()
    window = nil
  end

  if host then
    host:destroy()
    host = nil
  end

  if stop then
    stop:destroy()
    stop = nil
  end

  if spectateControlWatching then
    spectateControlWatching:destroy()
    spectateControlWatching = nil
  end

  if spectateControlStreaming then
    spectateControlStreaming:destroy()
    spectateControlStreaming = nil
  end
end

function onExtendedOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then
    return false
  end

  local status, json_data = pcall(function()
    return json.decode(buffer)
  end)
  
  if not status then
    return false
  end

  local action = json_data.action
  local data = json_data.data

  if action == "show" then
    show(data)
  elseif action == "hosting" then
    onStartHosting()
  elseif action == "stopHosting" then
    onStopHosting()
  elseif action == "stopSpectating" then
    onStopSpectating()
  elseif action == "hosterData" then
    updateHosterData(data)
  elseif action == "updateHost" then
    updateHosterData(data)
  elseif action == "openHost" then
    showHosting()
  elseif action == "viewersList" then
    populateViewersList(data)
  elseif action == "bannedList" then
    populateBannedList(data)
  elseif action == "updateViewers" then
    updateViewersCount(data.viewers)
  end
end

function updateHosterData(data)
  if not data then
    return
  end
  
  local hosterName = data.name
  local hosterDescription = data.description
  local hosterPokeballs = data.pokeballs
  local hosterViewers = data.viewers

  if not spectateControlWatching then
    spectateControlWatching = createWatchingControl()
  end

  if spectateControlWatching then
    spectateControlWatching:show()
    
    local contentsPanel = spectateControlWatching:getChildById('contents')
    local hostNameLabel, viewersLabel, pokemonsContainer
    
    if contentsPanel then
      hostNameLabel = contentsPanel:getChildById('hostNameLabel')
      viewersLabel = contentsPanel:getChildById('viewersLabel')
      pokemonsContainer = contentsPanel:getChildById('pokemons')
    else
      hostNameLabel = spectateControlWatching:getChildById('hostNameLabel')
      viewersLabel = spectateControlWatching:getChildById('viewersLabel')
      pokemonsContainer = spectateControlWatching:getChildById('pokemons')
    end
    
    if hostNameLabel then
      hostNameLabel:setText(hosterDescription or hosterName or "Live Stream")
    end
    
    if viewersLabel then
      viewersLabel:setText(("Viewers: %d"):format(hosterViewers))
    end
    
    if pokemonsContainer and hosterPokeballs then
      pokemonsContainer:destroyChildren()
      
      for id = 1, math.min(4, #hosterPokeballs) do
        local pokemon = hosterPokeballs[id]
        
        local widget = g_ui.createWidget("PokemonHost", pokemonsContainer)
        if widget then
          widget:setId("pokemon_" .. id)
          
          local pokeImage = widget:getChildById('pokeImage')
          if pokeImage then
            local portraitPath = getPokemonPortrait(pokemon.name)
            if portraitPath then
              pokeImage:setImageSource(portraitPath)
              
              local tooltipText = pokemon.name .. " (" .. pokemon.health .. "%)"
              if pokemon.boost and pokemon.boost > 0 then
                tooltipText = tooltipText .. " [+" .. pokemon.boost .. "]"
              end
              pokeImage:setTooltip(tooltipText)
              
              if pokemon.health <= 0 then
                pokeImage:setColor("#FF4444")
                pokeImage:setOpacity(0.6)
              else
                pokeImage:setColor("#FFFFFF")
                pokeImage:setOpacity(1.0)
              end
            end
          end
        end
      end
      
      if #hosterPokeballs > 4 then
        local spacer = g_ui.createWidget("UIWidget", pokemonsContainer)
        if spacer then
          spacer:setSize({width = 34, height = 34})
          spacer:setVisible(false)
        end
        
        for id = 5, #hosterPokeballs do
          local pokemon = hosterPokeballs[id]
          
          local widget = g_ui.createWidget("PokemonHost", pokemonsContainer)
          if widget then
            widget:setId("pokemon_" .. id)
            
            local pokeImage = widget:getChildById('pokeImage')
            if pokeImage then
              local portraitPath = getPokemonPortrait(pokemon.name)
              if portraitPath then
                pokeImage:setImageSource(portraitPath)
                
                local tooltipText = pokemon.name .. " (" .. pokemon.health .. "%)"
                if pokemon.boost and pokemon.boost > 0 then
                  tooltipText = tooltipText .. " [+" .. pokemon.boost .. "]"
                end
                pokeImage:setTooltip(tooltipText)
                
                if pokemon.health <= 0 then
                  pokeImage:setColor("#FF4444")
                  pokeImage:setOpacity(0.6)
                else
                  pokeImage:setColor("#FFFFFF")
                  pokeImage:setOpacity(1.0)
                end
              end
            end
          end
        end
        
        if #hosterPokeballs == 6 then
          local spacer2 = g_ui.createWidget("UIWidget", pokemonsContainer)
          if spacer2 then
            spacer2:setSize({width = 34, height = 34})
            spacer2:setVisible(false)
          end
        end
      end
    end
  end
end

function onStartHosting()
  spectateControlStreaming = createStreamingControl()
  
  if not spectateControlStreaming then
    return
  end
  
  isHosting = true
  hostStartTime = os.time()
  
  local contentsPanel = spectateControlStreaming:getChildById('contentsPanel')
  
  if contentsPanel then
    local hostNameLabel = contentsPanel:getChildById('hostNameLabel')
    local viewersLabel = contentsPanel:getChildById('viewersLabel')
    
    if hostNameLabel then
      -- Mostrar a descrição da live ao invés do nome do player
      hostNameLabel:setText(currentDescription or "Live Stream")
    end
    
    if viewersLabel then
      viewersLabel:setText("Viewers: 0")
    end
  end
  
  spectateControlStreaming:show()
  
  scheduleEvent(updateHostTime, 1000)
end

function onStopHosting()
  isHosting = false
  hostStartTime = 0
  currentDescription = ""
  currentPassword = ""
  
  if spectateControlStreaming then
    local contentsPanel = spectateControlStreaming:getChildById('contentsPanel')
    if contentsPanel then
      local hostTimeLabel = contentsPanel:getChildById('hostTimeLabel')
      if hostTimeLabel then
        hostTimeLabel:setText("00:00:00")
      end
    end
    
    spectateControlStreaming:hide()
  end
  hide()
end

function onStopSpectating()
  if isSpectating then
    isSpectating = false
    
    if spectateControlWatching then
      spectateControlWatching:hide()
    end
    
    modules.game_interface.getMapPanel():followCreature(g_game.getLocalPlayer())
    
    hide()
  end
end

function showHosting()
  if not host then
    createMainUI()
  end
  
  if not host then
    return
  end

  if isHosting then
    host.description:setText(currentDescription)
    host.password:setText(currentPassword)
    
    local hostButton = host:getChildById('hostButton')
    if hostButton then
      hostButton:setText("Edit")
    end
    
    host:raise()
    host:show()
    return
  end

  host.description:setText("")
  host.password:setText("")
  
  local hostButton = host:getChildById('hostButton')
  if hostButton then
    hostButton:setText("Host")
  end
  
  host:raise()
  host:show()
end

function confirmHost()
  if not host then
    return
  end
  
  local description = host.description:getText()
  local password = host.password:getText()
  if password:len() == 0 then
    password = nil
  end
  
  if description and description:len() > 20 then
    modules.game_textmessage.displayGameMessage("Description must be 20 characters or less!")
    return
  end
  
  currentDescription = description or ""
  currentPassword = password or ""
  
  host:hide()
  if window then
    window:hide()
  end

  if isHosting then
    if spectateControlStreaming and spectateControlStreaming:isVisible() then
      local contentsPanel = spectateControlStreaming:getChildById('contentsPanel')
      if contentsPanel then
        local hostNameLabel = contentsPanel:getChildById('hostNameLabel')
        if hostNameLabel then
          hostNameLabel:setText(currentDescription or "Live Stream")
        end
      end
    end
    
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({
      action = "editHost",
      data = { description = description, password = password }
    }))
  else
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({
      action = "host",
      data = { description = description, password = password }
    }))
  end
end

function cancelHost()
  if host then
    host:hide()
  end
end

function onCallback(protocol, msg)
  local movementBlocked = msg:getU8()
  local localPlayer = g_game.getLocalPlayer()
  if movementBlocked == 1 then
    localPlayer:setCanWalk(false)
  else
    localPlayer:setCanWalk(true)
  end
end

function onStartSpectate(protocol, msg)
  local start = msg:getU8()
  local creature = g_map.getCreatureById(msg:getU32())
  
  if start == 1 then
    isSpectating = true
    spectateControlWatching = createWatchingControl()
    if spectateControlWatching then
      spectateControlWatching:show()
    end
    
    if creature then
      modules.game_interface.getMapPanel():followCreature(creature)
    end
  else
    isSpectating = false
    if spectateControlWatching then
      spectateControlWatching:hide()
    end
    
    modules.game_interface.getMapPanel():followCreature(g_game.getLocalPlayer())
  end
  
  hide()
end

function show(data)
  if not window then
    createMainUI()
  end
  
  if not window then
    return
  end

  if not data then
    return
  end

  if lastFetchTime + (THUMB_TIME / 1000) < os.time() then
    lastFetchTime = os.time()
  end

  window.hosts:destroyChildren()
  
  for _, hostData in ipairs(data) do
    local widget = g_ui.createWidget("HostPanel", window.hosts)
    
    if not widget then
      return
    end
    
    widget:setId(hostData.name)
    
    if widget.name then
      widget.name:setText(hostData.name)
    end
    
    if widget.desc then
      widget.desc:setText(hostData.description or "No description")
    end
    
    if widget.viewers then
      widget.viewers:setText(tostring(hostData.viewers or 0))
    end
    
    if widget.lockIcon then
      widget.lockIcon:setVisible(hostData.password or false)
    end
    
    widget.onClick = function() selectChannel(widget) end
  end

  window:show()
end


local selectedChannel = nil
function selectChannel(widget)
  if selectedChannel then
    selectedChannel:setOn(false)
  end
  selectedChannel = widget
  selectedChannel:setOn(true)
end

function watchSelectedChannel()
  if not selectedChannel then return end
  
  if not spectateControlWatching then
    spectateControlWatching = createWatchingControl()
  end
  
  if selectedChannel.lockIcon and selectedChannel.lockIcon:isVisible() then
    modules.client_textedit.show(
      "",
      {
        title = "Password",
        description = "Enter password to spectate this player",
        width = 280
      },
      function(password)
        protocolGame:sendExtendedOpcode(OPCODE, json.encode({
          action = "spectate",
          data = { name = selectedChannel:getId(), password = password }
        }))
      end
    )
  else
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({
      action = "spectate",
      data = { name = selectedChannel:getId() }
    }))
    
    if window then
      window:hide()
    end
  end
end

function hideProtected(widget)
  local checked = widget:isChecked()
  for _, hostWidget in pairs(window.hosts:getChildren()) do
    if checked then
      hostWidget:setVisible(true)
    else
      hostWidget:setVisible(not (hostWidget.lockIcon and hostWidget.lockIcon:isVisible()))
    end
  end
  widget:setChecked(not checked)
end

function kickPlayer(name)
  protocolGame:sendExtendedOpcode(OPCODE, json.encode({
    action = "kick",
    data = name
  }))
end

function banPlayer(name)
  protocolGame:sendExtendedOpcode(OPCODE, json.encode({
    action = "ban",
    data = name
  }))
end

function showViewerManager()
  if not isHosting then
    return
  end
  
  viewerManagerWindow = g_ui.loadUI("viewerManager", modules.game_interface.getRootPanel())
  if viewerManagerWindow then
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getViewers" }))
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getBanned" }))
  end
end

function kickViewer(name)
  kickPlayer(name)
  if viewerManagerWindow and viewerManagerWindow:isVisible() then
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getViewers" }))
  end
end

function banViewer(name)
  banPlayer(name)
  if viewerManagerWindow and viewerManagerWindow:isVisible() then
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getViewers" }))
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getBanned" }))
  end
end

function populateViewersList(viewers)
  if not viewerManagerWindow then
    return
  end
  
  local viewersList = viewerManagerWindow:getChildById('viewersContainer')
  if not viewersList then
    return
  end
  
  viewersList:destroyChildren()
  
  for _, viewer in ipairs(viewers) do
    local viewerItem = g_ui.createWidget('ViewerItem', viewersList)
    if viewerItem then
      viewerItem.viewerName = viewer.name
      
      local nameLabel = viewerItem:getChildById('nameLabel')
      
      if nameLabel then 
        nameLabel:setText(viewer.name .. " (Level " .. viewer.level .. " " .. viewer.vocation .. ")")
      end
      
      local kickButton = viewerItem:getChildById('kickButton')
      local banButton = viewerItem:getChildById('banButton')
      
      if kickButton then
        kickButton.onClick = function() kickViewer(viewer.name) end
      end
      if banButton then
        banButton.onClick = function() banViewer(viewer.name) end
      end
    end
  end
end

function populateBannedList(bannedPlayers)
  if not viewerManagerWindow then
    return
  end
  
  local bannedList = viewerManagerWindow:getChildById('bannedContainer')
  if not bannedList then
    return
  end
  
  bannedList:destroyChildren()
  
  for _, player in ipairs(bannedPlayers) do
    local bannedItem = g_ui.createWidget('BannedItem', bannedList)
    if bannedItem then
      -- Armazenar o nome do player no widget para o botão
      bannedItem.playerName = player.name
      
      local nameLabel = bannedItem:getChildById('nameLabel')
      
      if nameLabel then 
        nameLabel:setText(player.name .. " [BANNED]")
      end
      
      -- Configurar botão de unban
      local unbanButton = bannedItem:getChildById('unbanButton')
      if unbanButton then
        unbanButton.onClick = function() unbanPlayer(player.name) end
      end
    end
  end
end

function unbanPlayer(name)
  protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "unban", data = name }))
  -- Atualizar lista para refletir mudanças
  if viewerManagerWindow and viewerManagerWindow:isVisible() then
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "getBanned" }))
  end
end

function updateViewersCount(count)
  -- Atualizar contador na interface de streaming
  if spectateControlStreaming and spectateControlStreaming:isVisible() then
    local contentsPanel = spectateControlStreaming:getChildById('contentsPanel')
    local viewersLabel = nil
    
    if contentsPanel then
      viewersLabel = contentsPanel:getChildById('viewersLabel')
    end
    
    if viewersLabel then
      viewersLabel:setText(("Viewers: %d"):format(count))
    end
  end
end

function hide()
  if window then
    window:hide()
  end
end

function stopSpectating()
  print("[SPECTATE DEBUG] Client: stopSpectating() called")
  
  if not isSpectating then
    print("[SPECTATE DEBUG] Client: ERROR - not currently spectating!")
    return
  end
  
  -- Usar apenas opcode
  print("[SPECTATE DEBUG] Client: Using opcode method to stop spectating")
  if protocolGame then
    protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "stopSpectate" }))
  else
    print("[SPECTATE DEBUG] Client: ERROR - protocolGame is nil!")
  end
end

function stopHosting()
  protocolGame:sendExtendedOpcode(OPCODE, json.encode({ action = "stopHost" }))
end

function updateHostTime()
  if not isHosting then
    return
  end
  
  if not spectateControlStreaming then
    return
  end
  
  if not spectateControlStreaming:isVisible() then
    return
  end
  
  local elapsed = os.time() - hostStartTime
  local hours = math.floor(elapsed / 3600)
  local minutes = math.floor((elapsed % 3600) / 60)
  local seconds = elapsed % 60
  
  local timeText = string.format("%02d:%02d:%02d", hours, minutes, seconds)
  
  local contentsPanel = spectateControlStreaming:getChildById('contentsPanel')
  local hostTimeLabel = nil
  
  if contentsPanel then
    hostTimeLabel = contentsPanel:getChildById('hostTimeLabel')
  end
  
  if hostTimeLabel then
    hostTimeLabel:setText(timeText)
  end
  
  scheduleEvent(updateHostTime, 1000)
end
