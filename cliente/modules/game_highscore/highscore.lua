-- chunkname: @/modules/game_highscore/highscore.lua

local ExtendsOpcodes = {
    Highscore = 66, -- Unique opcode for highscore, different from daily reward (95)
    SendHighscoreRequest = 1,
    ReceiveHighscoreData = 2,
    RedirectHighscore = 3
}

local highscoreWindow, highscoreButton, selectedSkill, selectedPage, selectedMethod, initialized, ignoreFilterChange
local forceNoneVoc = false
local skills = {
    [HighscoreSkill_t.HIGHSCORE_SKILL_FIST] = "Fist Fighting",
    [HighscoreSkill_t.HIGHSCORE_SKILL_CLUB] = "Club Fighting",
    [HighscoreSkill_t.HIGHSCORE_SKILL_SWORD] = "Sword Fighting",
    [HighscoreSkill_t.HIGHSCORE_SKILL_AXE] = "Axe Fighting",
    [HighscoreSkill_t.HIGHSCORE_SKILL_DISTANCE] = "Distance Fighting",
    [HighscoreSkill_t.HIGHSCORE_SKILL_SHIELDING] = "Shielding",          -- agora no índice 5
    [HighscoreSkill_t.HIGHSCORE_SKILL_FISHING] = "Fishing",
    [HighscoreSkill_t.HIGHSCORE_SKILL_MAGIC] = "Magic Level",
    [HighscoreSkill_t.HIGHSCORE_SKILL_EXPERIENCE] = "Experience Points"  -- índice 8
}

local function getSelectedVocations()
    local vocations = {}
    table.insert(vocations, highscoreWindow.filters.none:isChecked())
    table.insert(vocations, highscoreWindow.filters.sorcerer:isChecked())
    table.insert(vocations, highscoreWindow.filters.druid:isChecked())
    table.insert(vocations, highscoreWindow.filters.paladin:isChecked())
    table.insert(vocations, highscoreWindow.filters.knight:isChecked())
    table.insert(vocations, highscoreWindow.filters.sorcerer:isChecked())
    table.insert(vocations, highscoreWindow.filters.druid:isChecked())
    table.insert(vocations, highscoreWindow.filters.paladin:isChecked())
    table.insert(vocations, highscoreWindow.filters.knight:isChecked())
    return vocations
end

local function calculateExactSize(factor, type, outfit)
    local exactSize = {
        horizontal = 64 * factor,
        vertical = 64 * factor
    }
    local xPattern = 2
    local zPattern = 0
    local animation = math.ceil(type:getAnimationPhases() / 2)

    if outfit.mount ~= 0 then
        -- block empty
    end

    local offset = {
        x = { min = 255, max = 0 },
        y = { min = 255, max = 0 }
    }
    local texture = {
        x = { min = 255, max = 0 },
        y = { min = 255, max = 0 }
    }

    for yPattern = 0, math.max(0, type:getNumPatternY() - 1) do
        if yPattern > 0 and bit.band(0, bit.lshift(1, yPattern - 1)) == 0 then
            -- block empty
        else
            for layer = 0, math.max(0, type:getLayers() - 1) do
                local textureSize = type:getExactTextureSizePoint(layer, xPattern, yPattern, zPattern, animation)
                if g_sprites.isHdFileMod() then
                    textureSize.x = math.min(64, textureSize.x) / 2
                    if textureSize.x == 0 then textureSize.x = 64 end
                    textureSize.y = math.min(64, textureSize.y) / 2
                    if textureSize.y == 0 then textureSize.y = 64 end
                end
                textureSize.x = textureSize.x * factor
                textureSize.y = textureSize.y * factor
                if textureSize.x > texture.x.max then texture.x.max = textureSize.x end
                if textureSize.y > texture.y.max then texture.y.max = textureSize.y end
                if textureSize.x < texture.x.min then texture.x.min = textureSize.x end
                if textureSize.y < texture.y.min then texture.y.min = textureSize.y end

                local textureOffset = type:getExactTextureOffsetSizePoint(layer, xPattern, yPattern, zPattern, animation)
                if g_sprites.isHdFileMod() then
                    textureOffset.x = math.min(64, textureOffset.x) / 2
                    if textureOffset.x == 0 then textureOffset.x = 64 end
                    textureOffset.y = math.min(64, textureOffset.y) / 2
                    if textureOffset.y == 0 then textureOffset.y = 64 end
                end
                textureOffset.x = textureOffset.x * factor
                textureOffset.y = textureOffset.y * factor
                if textureOffset.x > offset.x.max then offset.x.max = textureOffset.x end
                if textureOffset.y > offset.y.max then offset.y.max = textureOffset.y end
                if textureOffset.x < offset.x.min then offset.x.min = textureOffset.x end
                if textureOffset.y < offset.y.min then offset.y.min = textureOffset.y end
            end
        end
    end

    exactSize.horizontal = 64 * factor
    exactSize.horizontal = exactSize.horizontal - (offset.x.min + (type:getWidth() == 1 and 64 * factor / 2 or 0) - 8 * factor)
    exactSize.horizontal = exactSize.horizontal - texture.x.max
    exactSize.horizontal = exactSize.horizontal - (64 * factor - texture.x.max) / 2
    exactSize.vertical = 64 * factor
    exactSize.vertical = exactSize.vertical - (offset.y.min + (type:getHeight() == 1 and 64 * factor / 2 or 0) - 8)
    exactSize.vertical = exactSize.vertical - texture.y.max
    exactSize.vertical = exactSize.vertical - (64 * factor - texture.y.max) / 2

    return exactSize
end

function close()
    highscoreWindow:hide()
    g_keyboard.unbindKeyDown("Escape", close)
end

function toggle()
    if highscoreWindow:isVisible() then
        close()
    else
        loadHighscore()
    end
end

function onGameEnd()
    if highscoreWindow:isVisible() then
        close()
    end
end

function init()
    connect(g_game, {
        onGameEnd = onGameEnd
    })

    highscoreWindow = g_ui.displayUI("highscore")
    highscoreWindow:hide()
    highscoreButton = modules.client_topmenu.addLeftGameButton("highscoreButton", tr("Highscore"), "/images/topbuttons/highscore", toggle, false, 10)
    highscoreWindow.leaderboard = highscoreWindow:getChildById("leaderboard")
    highscoreWindow.leaderboard.skills = highscoreWindow.leaderboard:getChildById("skills")

    for id, name in ipairs(skills) do
        highscoreWindow.leaderboard.skills:addOption(name, id)
    end

    highscoreWindow.leaderboard.creature = highscoreWindow.leaderboard:getChildById("creature")
    highscoreWindow.leaderboard.name = highscoreWindow.leaderboard:getChildById("name")
    highscoreWindow.leaderboard.position = highscoreWindow.leaderboard:getChildById("position")
    highscoreWindow.leaderboard.vocation = highscoreWindow.leaderboard:getChildById("vocation")
    highscoreWindow.leaderboard.level = highscoreWindow.leaderboard:getChildById("level")
    highscoreWindow.leaderboard.points = highscoreWindow.leaderboard:getChildById("points"):getChildById("text")
    highscoreWindow.filters = highscoreWindow:getChildById("filters")
    highscoreWindow.filters.knight = highscoreWindow.filters:getChildById("knight")
    highscoreWindow.filters.druid = highscoreWindow.filters:getChildById("druid")
    highscoreWindow.filters.paladin = highscoreWindow.filters:getChildById("paladin")
    highscoreWindow.filters.sorcerer = highscoreWindow.filters:getChildById("sorcerer")
    highscoreWindow.filters.none = highscoreWindow.filters:getChildById("none")
    highscoreWindow.filters.own = highscoreWindow.filters:getChildById("own")
    highscoreWindow.filters.page = highscoreWindow.filters:getChildById("page")
    highscoreWindow.filters.previous = highscoreWindow.filters:getChildById("previous")
    highscoreWindow.filters.next = highscoreWindow.filters:getChildById("next")
    highscoreWindow.main = highscoreWindow:getChildById("main")
    highscoreWindow.main.list = highscoreWindow.main:getChildById("list")
    highscoreWindow.main.pointsMark = highscoreWindow.main:getChildById("topmark"):getChildById("pointsMark")
    highscoreWindow.update = highscoreWindow:getChildById("update")
    highscoreWindow.redirect = highscoreWindow:getChildById("redirect")
    selectedMethod = HighscoreMethod_t.HIGHSCORE_METHOD_ENTRIES
    selectedSkill = HighscoreSkill_t.HIGHSCORE_SKILL_EXPERIENCE
    selectedPage = 1
    initialized = true

    ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.Highscore, parseHighscore)
end

function terminate()
    disconnect(g_game, {
        onGameEnd = onGameEnd
    })

    ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.Highscore)
    if highscoreWindow and highscoreWindow:isVisible() then
        close()
        highscoreWindow:destroy()
        highscoreWindow = nil
    end

    if highscoreButton then
        highscoreButton:destroy()
        highscoreButton = nil
    end
end

local function getVocationName(vocation)
    if vocation == 0 then return "None"
    elseif vocation == 1 then return "Sorcerer"
    elseif vocation == 2 then return "Druid"
    elseif vocation == 3 then return "Paladin"
    elseif vocation == 4 then return "Knight"
    elseif vocation == 5 then return "Master Sorcerer"
    elseif vocation == 6 then return "Elder Druid"
    elseif vocation == 7 then return "Royal Paladin"
    elseif vocation == 8 then return "Elite Knight"
    else return "None"
    end
end

local function formatNumber(integer)
    local numbers = tostring(integer)
    if #numbers <= 3 then return numbers end
    local j = 0
    local text = ""
    for i = #numbers, 1, -1 do
        j = j + 1
        text = numbers:sub(i, i) .. text
        if j == 3 and i ~= 1 then
            text = "." .. text
            j = 0
        end
    end
    return text
end

function onClickHighscoreElement(content)
    if not initialized then return end
    if not content:getParent() or not content:getParent():getParent() then return end

    local index = content:getParent():getChildIndex(content)
    if index <= 0 then return end

    local mask = content:getParent():getParent():getChildById("mask")
    mask:setMarginTop((index - 1) * 19)

    local entry = content.entry
    highscoreWindow.leaderboard.name:setText(entry.name)
    highscoreWindow.leaderboard.vocation:setText(getVocationName(entry.vocation))
    highscoreWindow.leaderboard.level:setText("Level: " .. entry.level)
    highscoreWindow.leaderboard.points:setText(formatNumber(entry.points))
    highscoreWindow.leaderboard.position:setText("#" .. entry.temporaryRank)

    -- Outfit
    highscoreWindow.leaderboard.creature:setOutfit(entry)
    highscoreWindow.leaderboard.creature:setDirection(Directions.South)

    -- Removido: setUISpeed e calculateExactSize
    highscoreWindow.leaderboard.creature:setMarginLeft(0)
    highscoreWindow.leaderboard.creature:setMarginTop(0)
end


function onFilterChange()
    if not initialized then return end
    if forceNoneVoc then
        local valid = false
        for _, toggle in ipairs(getSelectedVocations()) do
            if toggle then valid = true end
        end
        if not valid then
            highscoreWindow.filters.none:setChecked(true)
            return
        end
    end
    loadHighscore()
end

function onGroupFilterChange(widget)
    if ignoreFilterChange or not initialized then return end
    if widget:isChecked() then
        selectedMethod = HighscoreMethod_t.HIGHSCORE_METHOD_OWN_RANKS
    else
        selectedMethod = HighscoreMethod_t.HIGHSCORE_METHOD_ENTRIES
    end
    loadHighscore()
end

function onSkillChange()
    if not initialized then return end
    selectedSkill = highscoreWindow.leaderboard.skills:getCurrentOption().data
    if selectedSkill == HighscoreSkill_t.HIGHSCORE_SKILL_EXPERIENCE then
        highscoreWindow.main.pointsMark:setText("Points")
    else
        highscoreWindow.main.pointsMark:setText("Skill Level")
    end
    loadHighscore()
end

function onClickPreviousPage()
    if not initialized then return end
    selectedPage = selectedPage - 1
    loadHighscore()
end

function onClickNextPage()
    if not initialized then return end
    selectedPage = selectedPage + 1
    loadHighscore()
end

function onClickRedirect()
    ignoreFilterChange = true
    selectedMethod = HighscoreMethod_t.HIGHSCORE_METHOD_ENTRIES
    highscoreWindow.filters.own:setChecked(false)
    ignoreFilterChange = false
    local protocol = g_game.getProtocolGame()
    if not protocol then return end
    protocol:sendExtendedOpcode(ExtendsOpcodes.Highscore, json.encode({ action = ExtendsOpcodes.RedirectHighscore }))
end

local function parseUpdateTime(time)
    if time < 60 then return "last minute" end
    return tostring(math.floor(time / 60)) .. " minutes ago"
end

function parseHighscore(protocol, opcode, json_data)
    if not initialized then return end
    local action = json_data.action
    local data = json_data.data
    if action == ExtendsOpcodes.ReceiveHighscoreData then
        highscoreWindow.redirect:setEnabled(data.redirect)
        highscoreWindow.filters.page:setText(data.page .. " / " .. data.totalPages)
        highscoreWindow.filters.previous:setOn(data.page > 1)
        highscoreWindow.filters.next:setOn(data.page < data.totalPages)
        highscoreWindow.leaderboard.skills:setCurrentOptionByData(selectedSkill)
        highscoreWindow.update:setText("Last Update: " .. parseUpdateTime(os.time() - data.uptime))

        local first = true
        local white = true
        highscoreWindow.main.list:destroyChildren()

        for _, entry in ipairs(data.entries) do
            local content = g_ui.createWidget("HighscoreElement", highscoreWindow.main.list)
            content.rank = content:getChildById("rank")
            content.character = content:getChildById("character")
            content.vocation = content:getChildById("vocation")
            content.level = content:getChildById("level")
            content.points = content:getChildById("points")
            content.entry = entry
            content.white = white

            function content.onClick()
                onClickHighscoreElement(content)
            end

            function content.onHoverChange(widget, hovered)
                if hovered then
                    content:setBackgroundColor("#6B6B6B")
                elseif content.white then
                    content:setBackgroundColor("#484848")
                else
                    content:setBackgroundColor("#414141")
                end
            end

            content.rank:setText(entry.temporaryRank)
            content.character:setText(entry.name)
            content.vocation:setText(getVocationName(entry.vocation))
            content.level:setText(entry.level)
            content.points:setText(formatNumber(entry.points))

            if entry.own then
                content.rank:setColor("#76E879")
                content.character:setColor("#76E879")
                content.vocation:setColor("#76E879")
                content.level:setColor("#76E879")
                content.points:setColor("#76E879")
            end

            content:addAnchor(AnchorLeft, "parent", AnchorLeft)
            content:addAnchor(AnchorRight, "parent", AnchorRight)
            if first then
                first = false
                onClickHighscoreElement(content)
                content:addAnchor(AnchorTop, "parent", AnchorTop)
            else
                content:addAnchor(AnchorTop, "prev", AnchorBottom)
            end

            if white then
                white = false
                content:setBackgroundColor("#484848")
            else
                white = true
                content:setBackgroundColor("#414141")
            end
        end

        if not highscoreWindow:isVisible() then
            highscoreWindow:show()
            g_keyboard.bindKeyDown("Escape", close)
        end
    end
end

function loadHighscore()
    local protocol = g_game.getProtocolGame()
    if not protocol then return end
    local request = {
        action = ExtendsOpcodes.SendHighscoreRequest,
        data = {
            method = selectedMethod,
            skill = selectedSkill,
            vocations = getSelectedVocations(),
            page = selectedPage
        }
    }
    protocol:sendExtendedOpcode(ExtendsOpcodes.Highscore, json.encode(request))
end