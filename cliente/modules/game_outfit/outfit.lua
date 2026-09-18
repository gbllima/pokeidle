-- chunkname: @/modules/game_outfit/outfit.lua
PlayerCustom = {}

local protocol = runinsandbox("protocol")
local window, outfitsPanel, titlesPanel, nameEffectsPanel
local PlayerCustomize = {}
local pendingTitles
local pendingNameEffects

local function parseOutfits(list)
  if not outfitsPanel or not outfitsPanel.list then return end
  for i, value in ipairs(list) do
    local button = g_ui.createWidget("PanelCustomOutfit", outfitsPanel.list)
    local outfit = table.copy(PlayerCustomize.outfit)
    outfit.type = value[1]
    button:setId(outfit.type)
    button:setTooltip(value[2])
    button.outfit:setOutfit(outfit)
  end
  local panelButton = outfitsPanel.list[PlayerCustomize.outfit.type]
  if panelButton then
    panelButton:focus()
    onOutfitSelect(panelButton)
  end
  outfitsPanel.scroll:setVisible(#list > 15)
end

local function parseTitles(title)
  if not titlesPanel or not titlesPanel.list then return end
  titlesPanel.list:destroyChildren()
  local noneButton = g_ui.createWidget("PanelCustomTitle", titlesPanel.list)
  noneButton.name:setText("Without Title")
  noneButton:setId(0)
  for _, t in ipairs(title.Titles) do
    local button = g_ui.createWidget("PanelCustomTitle", titlesPanel.list)
    button:setId(t.ID)
    button.name:setText(t.Text)
    if t.Color then
      button.name:setColor(t.Color)
    end
    if t.Font then
      button.name:setFont(t.Font)
    end
  end
  local selectedButton = titlesPanel.list[tostring(title.Enabled)]
  if selectedButton then
    selectedButton:focus()
    onTitleSelect(selectedButton)
  end
  titlesPanel.scroll:setVisible(#title.Titles > 9)
end

local function parseNameEffects(nameEffects)
  if not nameEffectsPanel or not nameEffectsPanel.list then return end
  nameEffectsPanel.list:destroyChildren()
  local noneButton = g_ui.createWidget("PanelCustomNameEffect", nameEffectsPanel.list)
  noneButton.name:setText("Without Name Effect")
  noneButton:setId(0)
  for _, nameEffectId in ipairs(nameEffects.NameEffects) do
    local info = NameEffectsConfig[nameEffectId]
    if info then
      local effectButton = g_ui.createWidget("PanelCustomNameEffect", nameEffectsPanel.list)
      effectButton:setId(nameEffectId)
      effectButton.name:setText(info.Name)
      effectButton.texture:setImageSource(info.Texture)
    end
  end
  local panelButton = nameEffectsPanel.list[tostring(nameEffects.Enabled)]
  if panelButton then
    panelButton:focus()
    onNameEffectSelect(panelButton)
  end
  nameEffectsPanel.scroll:setVisible(#nameEffects.NameEffects > 9)
end

local function onTabChange(tabBar, tab)
  local selectedTabId = tab.tabPanel:getId()
  if selectedTabId == "outfitsPanel" then
    local panelButton = outfitsPanel.list:getFocusedChild()
    outfitsPanel.list:ensureChildVisible(panelButton)
    onOutfitSelect(panelButton)
  elseif selectedTabId == "titlesPanel" then
    local panelButton = titlesPanel.list:getFocusedChild()
    titlesPanel.list:ensureChildVisible(panelButton)
    onTitleSelect(panelButton)
  elseif selectedTabId == "nameEffectsPanel" then
    local panelButton = nameEffectsPanel.list:getFocusedChild()
    nameEffectsPanel.list:ensureChildVisible(panelButton)
    onNameEffectSelect(panelButton)
  end
  updatePreview()
end

local function onTitles(titles)
  if not titlesPanel then
    pendingTitles = titles
    return
  end
  parseTitles(titles)
end

local function onNameEffects(nameEffects)
  if not nameEffectsPanel then
    pendingNameEffects = nameEffects
    return
  end
  parseNameEffects(nameEffects)
end

local function onOpen(playerData, outfits)
  if window and not window:isHidden() then
    return
  end
  window = g_ui.displayUI("outfitwindow")
  window:onVisibilityChange(true)
  window.mainTabBar:setContentWidget(window.mainTabContent)
  outfitsPanel     = g_ui.loadUI("ui/outfitsPanel")
  titlesPanel      = g_ui.loadUI("ui/titlesPanel")
  nameEffectsPanel = g_ui.loadUI("ui/nameEffectsPanel")
  window.mainTabBar:addTab(tr("Outfit"), outfitsPanel)
  window.mainTabBar:addTab(tr("Titles"), titlesPanel)
  window.mainTabBar:addTab(tr("Name Effects"), nameEffectsPanel)
  window.mainTabBar.onTabChange = onTabChange
  PlayerCustomize = playerData
  PlayerCustomize.titleId = PlayerCustomize.titleId or 0
  PlayerCustomize.nameEffectId = PlayerCustomize.nameEffectId or 0
  parseOutfits(outfits)
  if pendingTitles then
    parseTitles(pendingTitles)
    pendingTitles = nil
  end
  if pendingNameEffects then
    parseNameEffects(pendingNameEffects)
    pendingNameEffects = nil
  end
  updatePreview()
end

local function onNameEffectChange(creature, nameEffect)
  local cfg = NameEffectsConfig and NameEffectsConfig[nameEffect]
  if cfg and cfg.Texture then
    creature:setNameEffectTexture(cfg.Texture)
  else
    creature:setNameEffectTexture("")
  end
end

function init()
  protocol.initProtocol()
  connect(g_game, {
    onGameEnd = destroy
  })
  connect(PlayerCustom, {
    onOpen = onOpen,
    onTitles = onTitles,
    onNameEffects = onNameEffects
  })
  connect(Creature, {
    onNameEffectChange = onNameEffectChange
  })
end

function terminate()
  protocol.terminateProtocol()
  disconnect(g_game, {
    onGameEnd = destroy
  })
  disconnect(PlayerCustom, {
    onOpen = onOpen,
    onTitles = onTitles,
    onNameEffects = onNameEffects
  })
  disconnect(Creature, {
    onNameEffectChange = onNameEffectChange
  })
  destroy()
end

function destroy()
  if window then
    window:destroy()
    window = nil
    outfitsPanel, titlesPanel, nameEffectsPanel = nil, nil, nil
    PlayerCustomize = {}
    pendingTitles, pendingNameEffects = nil, nil
  end
end

function onOutfitSelect(panelButton)
  if not panelButton or not panelButton.outfit then return end
  PlayerCustomize.outfit = panelButton.outfit:getOutfit()
  updatePreview()
end

function onTitleSelect(panelButton)
  if not panelButton or not panelButton.name then return end
  PlayerCustomize.title = panelButton.name:getText()
  PlayerCustomize.color = panelButton.name:getColor()
  PlayerCustomize.font = panelButton.name:getFont()
  PlayerCustomize.titleId = tonumber(panelButton:getId()) or 0
  updatePreview()
end

function onNameEffectSelect(panelButton)
  if not panelButton then return end
  PlayerCustomize.nameEffectId = tonumber(panelButton:getId()) or 0
  updatePreview()
end

function updatePreview()
  if not window or not window.previewPanel then return end
  window.previewPanel.title:setText(PlayerCustomize.title or "")
  if PlayerCustomize.color then
    window.previewPanel.title:setColor(PlayerCustomize.color)
  end
  window.previewPanel.title:setVisible((PlayerCustomize.titleId or 0) > 0)
  if PlayerCustomize.font then
    window.previewPanel.title:setFont(PlayerCustomize.font)
  end
  local id = PlayerCustomize.nameEffectId or 0
  local cfg = NameEffectsConfig and NameEffectsConfig[id]
  if cfg and cfg.Texture then
    window.previewPanel.texture:setVisible(true)
    window.previewPanel.texture:setImageSource(cfg.Texture)
  else
    window.previewPanel.texture:setVisible(false)
  end
  if PlayerCustomize.name then
    window.previewPanel.name:setText(PlayerCustomize.name)
  end
  if PlayerCustomize.outfit then
    window.previewPanel.outfit:setOutfit(PlayerCustomize.outfit)
  end
end

function confirmChoose()
  protocol.sendChooseNameEffect(PlayerCustomize.nameEffectId or 0)
  protocol.sendChooseTitle(PlayerCustomize.titleId or 0)
  if PlayerCustomize.outfit then
    g_game.changeOutfit(PlayerCustomize.outfit)
  end
  destroy()
end
