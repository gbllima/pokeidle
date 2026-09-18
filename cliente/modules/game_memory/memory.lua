-- chunkname: @/modules/game_memory/memory.lua

local uiMemoryWindow, uiMessageWindow, mouseGrabberWidget

local ExtendsOpcodes = {
    SendTransform = 5,
    SendSelected  = 4,
    SendBuy       = 3,
    ParseData     = 1,
    Memory        = 111,
    ParseClose    = 2,
    SendCancel    = 6
}

local function offline()
    if uiMemoryWindow then
        uiMemoryWindow:destroy()
        uiMemoryWindow = nil
    end
    if uiMessageWindow then
        uiMessageWindow:destroy()
        uiMessageWindow = nil
    end
end

local function requestAction(action, slotId, pokemonName)
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
        protocolGame:sendExtendedJSONOpcode(ExtendsOpcodes.Memory, {
            action = action,
            data = { pokemonName = pokemonName, slotId = slotId }
        })
    end
end

local function requestBuySlot(slotId)
    if slotId < 3 then
        modules.game_shop.show()
    else
        uiMessageWindow = displayConfirmBox(tr("Buy"),
            "Você deseja comprar 1 (um) Slot extra para o Ditto Memory ? {#e2bb5b|Valor: 50 P-Bucks.}",
            function() requestAction(ExtendsOpcodes.SendBuy, slotId) end)
    end
end

local function requestSelected(slotId, pokemonName)
    requestAction(ExtendsOpcodes.SendSelected, slotId, pokemonName)
end

local function requestTransform(slotId)
    requestAction(ExtendsOpcodes.SendTransform, slotId)
end

local function requestRevert()
    requestAction(ExtendsOpcodes.SendTransform, 0)
end

local function requestRemove(pokemonName, slotId)
    uiMessageWindow = displayConfirmBox(tr("Remove") .. " - " .. pokemonName,
        "Você deseja remover este pokemon do ditto memory?",
        function() requestAction(ExtendsOpcodes.SendCancel, slotId) end)
end

local function parseData(data)
    offline()

    uiMemoryWindow = g_ui.loadUI("memory", modules.game_interface.getLeftPanel())

    local uiMemoryList     = uiMemoryWindow:recursiveGetChildById("uiMemoryList")
    local uiDittoImage     = uiMemoryWindow:recursiveGetChildById("uiDittoImage")
    local uiTransformImage = uiMemoryWindow:recursiveGetChildById("uiTransformImage")
    local uiRevertButton   = uiMemoryWindow:recursiveGetChildById("uiRevertButton")

    if uiRevertButton then
        function uiRevertButton.onClick() requestRevert() end
    end
    if uiDittoImage then
        function uiDittoImage.onMouseRelease(widget, mousePos, mouseButton)
            requestRevert()
            return true
        end
    end

    for slotId, slot in pairs(data.memorys or {}) do
        local uiSlot = g_ui.createWidget("MemorySlot", uiMemoryList)
        local isLocked = slot.isLocked
        local canRemovePokemon = slot.pokemonName ~= "" and not isLocked

        if isLocked then
            uiSlot.locked:show()
            uiSlot.portrait:setTooltip("Clique aqui para comprar!")
        else
            uiSlot.locked:hide()
            uiSlot.level:setVisible(slot.level > 0)

            if g_resources.fileExists(IMAGE_PATHS.PORTRAIT .. slot.pokemonName:lower() .. ".png") then
                uiSlot.portrait:setImageSource(getPokemonPortrait(slot.pokemonName))
            else
                uiSlot.portrait:setItemId(slot.portrait)
            end

            uiSlot.portrait:setTooltip(slot.pokemonName)
            uiSlot.level:setText(tr("Lv. %d", slot.level))
            uiSlot.remove:setVisible(slot.pokemonName:len() > 0)
        end

        function uiSlot.remove.onClick()
            requestRemove(slot.pokemonName, slotId)
        end

        function uiSlot.portrait.onMouseRelease(widget, mousePos, mouseButton)
            if not canRemovePokemon and not isLocked then
                startChooseItem(slotId)
            elseif isLocked then
                requestBuySlot(slotId)
            elseif data.currentTransform ~= slot.pokemonName then
                requestTransform(slotId)
            end
            return true
        end
    end

    uiMemoryWindow:show()
    uiMemoryWindow:setup()
    uiMemoryWindow:setText(data.pokemonName)
    uiDittoImage:setImageSource(getPokemonImage(data.pokemonName))
    uiTransformImage:setImageSource(getPokemonImage(data.currentTransform))
end

local function parseClose()
    offline()
end

local parseOpcodesMap = {
    [ExtendsOpcodes.ParseData] = parseData,
    [ExtendsOpcodes.ParseClose] = parseClose
}

local function parseMemory(protocol, opcode, json_data)
    local executeAction = parseOpcodesMap[json_data.action]
    if executeAction then
        executeAction(json_data.data)
    end
end

function init()
    connect(g_game, { onGameEnd = onGameEnd })
    ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.Memory, parseMemory)

    mouseGrabberWidget = g_ui.createWidget("UIWidget")
    mouseGrabberWidget:setVisible(false)
    mouseGrabberWidget:setFocusable(false)
    mouseGrabberWidget.onMouseRelease = onChooseItemMouseRelease
end

function terminate()
    disconnect(g_game, { onGameEnd = onGameEnd })
    ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.Memory)
    if mouseGrabberWidget then mouseGrabberWidget:destroy() end
    offline()
end

function onGameEnd()
    offline()
end

function startChooseItem(slotId)
    if g_ui.isMouseGrabbed() then return end
    mouseGrabberWidget.slotId = slotId
    mouseGrabberWidget:grabMouse()
    g_mouse.pushCursor("target")
end

function onChooseItemMouseRelease(self, mousePosition, mouseButton)
    local clickedWidget = modules.game_interface.getRootPanel():recursiveGetChildByPos(mousePosition, false)
    if clickedWidget:getClassName() == "UIGameMap" then
        local tile = clickedWidget:getTile(mousePosition)
        if tile then
            local creature = tile:getTopCreature()
            if creature and creature:isMonster() and not creature:isSummon() then
                requestSelected(self.slotId, creature:getId())
            end
        end
    end
    g_mouse.popCursor("target")
    self:ungrabMouse()
    return true
end
