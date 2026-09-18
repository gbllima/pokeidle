-- chunkname: @/modules/game_dex/dex.lua

PokeDex = {}
local currentPokemon = nil
local protocol = runinsandbox("protocol")
local uiDexWindow, uiPokemonDex, uiDexTabBar, uiTitleTabBar, uiContentPanel, uiDescriptionLabel, uiDescriptionScroll, uiPokemonList, uiMovesList, uiStatisticList, uiEffectivenessList, uiEvolutionsList, uiDropsList
local imageElementPath = "/images/game/pokedex/types/"
local imageIconsPath = "/images/game/moves/"
local imageClassPath = "/images/game/pokedex/class/"
local bindKeyPress = {
	Up = function()
		uiPokemonList:focusPreviousChild(KeyboardFocusReason)
	end,
	Down = function()
		uiPokemonList:focusNextChild(KeyboardFocusReason)
	end
}
local cacheData = {
	UnlockedPokemons = {},
	CaughtPokemons = {},
	LootPokemons = {}
}
local playerPokepedia
local POKEPEDIA_01 = 18253
local POKEPEDIA_02 = 18247

local function capitalize(str)
	return str:gsub("^%l", string.upper)
end

local function registerPokemon(pokemonName, catch)
	if not cacheData.UnlockedPokemons[pokemonName] and not cacheData.CaughtPokemons[pokemonName] then
		cacheData.UnlockedPokemons[pokemonName] = true
	end

	if catch and not cacheData.CaughtPokemons[pokemonName] then
		cacheData.CaughtPokemons[pokemonName] = catch
	end
end

local function onOpen(pokepedia)
	playerPokepedia = pokepedia

	uiDexTabBar:setOn(pokepedia and table.contains(pokepedia, POKEPEDIA_02))
	uiDexWindow:show()
	uiDexWindow:focus()

	protocol.sendRequestData()

	local focusChild = uiPokemonList:getFocusedChild()

	if focusChild then
		onSelectedPokemon(focusChild:getId())
	end
end

local function onView(pokemonName, title, catch, focus)
    registerPokemon(pokemonName, catch)

    if title and title:len() > 0 then
        registerPokemon(tr("%s %s", title, pokemonName), catch)
    end

    local uiPokemon = uiPokemonList[pokemonName]
    if uiPokemon then
        setupPokemonView(uiPokemon, pokemonName, true, catch)

        if not focus then
            uiDexWindow:show()
            uiDexWindow:focus()

            uiPokemon.title = title

            local itemToFocus = uiPokemonList:getChildById(pokemonName)
            if itemToFocus then
                uiPokemonList:focusChild(itemToFocus)
                onSelectedPokemon(pokemonName, title)
                currentPokemon = pokemonName
            end
        end
    end
end

local function onData(unlockedPokemons, caughtPokemons)
    cacheData.UnlockedPokemons = {}
    cacheData.CaughtPokemons = {}

    uiPokemonList:destroyChildren()

    for i, pokemon in ipairs(Pokedex_Pokemons) do
        if pokemon.Listed then
            local uiPokemon = g_ui.createWidget("PokedexPokemonRow", uiPokemonList)
            setupPokemonView(uiPokemon, pokemon.Name_Lower, false, false)
        end

        if unlockedPokemons[pokemon.Name_Lower] or caughtPokemons[pokemon.Name_Lower] then
            onView(pokemon.Name_Lower, nil, caughtPokemons[pokemon.Name_Lower] ~= nil, true)
        end
    end

    if currentPokemon then
        local uiPokemon = uiPokemonList[currentPokemon]
        if uiPokemon then
            uiPokemonList:focusChild(uiPokemon)
            onSelectedPokemon(currentPokemon)
        end
    else
        for _, pokemonName in ipairs(Pokedex_Pokemons) do
            if cacheData.UnlockedPokemons[pokemonName.Name_Lower] then
                local uiPokemon = uiPokemonList[pokemonName.Name_Lower]
                if uiPokemon then
                    uiPokemonList:focusChild(uiPokemon)
                    onSelectedPokemon(pokemonName.Name_Lower)
                    break
                end
            end
        end
    end
end

local function onUpdate(params, focus)
	onView(params.pokemonName, params.title, params.catch, focus)
end

local function onLoot(pokemonName, loots)
	cacheData.LootPokemons[pokemonName] = loots

	local pokemon = Pokedex_PokemonsByName[pokemonName]

	if pokemon then
		setupPokemonDrops(pokemon)
	end
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = offline
	})
	connect(PokeDex, {
		onData = onData,
		onView = onView,
		onOpen = onOpen,
		onUpdate = onUpdate,
		onLoot = onLoot
	})

	uiDexWindow = g_ui.displayUI("dex")
	uiPokemonDex = uiDexWindow.uiPokemonDex
	uiDexTabBar = uiDexWindow.uiDexTabBar
	uiContentPanel = uiDexWindow.uiContentPanel
	uiTitleTabBar = uiDexWindow.uiTitleTabBar

	uiDexTabBar:setContentWidget(uiContentPanel)

	local uiInfo = g_ui.loadUI("info")
	local uiMoves = g_ui.loadUI("moves")
	local uiStatistic = g_ui.loadUI("statistic")
	local uiEffectiveness = g_ui.loadUI("effect")
	local uiEvolutions = g_ui.loadUI("evolutions")
	local uiDrops = g_ui.loadUI("drops")

	uiDescriptionLabel = g_ui.createWidget("PokedexPokemonDescription", uiInfo.uiDescriptionPanel)
	uiDescriptionScroll = uiInfo.uiDescriptionScroll
	uiPokemonList = uiDexWindow.uiPokemonList
	uiMovesList = uiMoves.uiMovesList
	uiStatisticList = uiStatistic.uiStatisticList
	uiEffectivenessList = uiEffectiveness.uiEffectivenessList
	uiEvolutionsList = uiEvolutions.uiEvolutionsList
	uiDropsList = uiDrops.uiDropsList

	local uiTabInfo = uiDexTabBar:addTab("", uiInfo)

	uiTabInfo:setIconClip("102 0 34 28")
	uiTabInfo:setTooltip(tr("Information"))

	local uiTabMoves = uiDexTabBar:addTab("", uiMoves)

	uiTabMoves:setIconClip("34 0 34 28")
	uiTabMoves:setTooltip(tr("Moves"))

	local uiTabStatistic = uiDexTabBar:addTab("", uiStatistic)

	uiTabStatistic:setIconClip("68 0 34 28")
	uiTabStatistic:setTooltip(tr("Statistics"))

	local uiTabEffectiveness = uiDexTabBar:addTab("", uiEffectiveness)

	uiTabEffectiveness:setIconClip("0 0 34 28")
	uiTabEffectiveness:setTooltip(tr("Defensive Effectiveness"))

	local uiTabEvolutions = uiDexTabBar:addTab("", uiEvolutions)

	uiTabEvolutions:setIconClip("136 0 34 28")
	uiTabEvolutions:setTooltip(tr("Evolutions"))

	local uiTabDrops = uiDexTabBar:addTab("", uiDrops)

	uiTabDrops:setIconClip("170 0 34 28")
	uiTabDrops:setTooltip(tr("Drops"))
	connect(uiPokemonList, {
		onChildFocusChange = onChildFocusChange
	})

	for key, callback in pairs(bindKeyPress) do
		g_keyboard.bindKeyPress(key, callback, uiDexWindow)
	end
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})
	disconnect(uiPokemonList, {
		onChildFocusChange = onChildFocusChange
	})
	disconnect(PokeDex, {
		onData = onData,
		onView = onView,
		onOpen = onOpen,
		onUpdate = onUpdate,
		onLoot = onLoot
	})

	for key, callback in pairs(bindKeyPress) do
		g_keyboard.unbindKeyPress(key, callback, uiDexWindow)
	end

	cacheData = {
		UnlockedPokemons = {},
		CaughtPokemons = {},
		LootPokemons = {}
	}

	uiDexWindow:destroy()

	uiDexWindow = nil
end

function offline()
	uiDexTabBar:selectTab(uiDexTabBar.tabs[1])
	uiDexWindow:hide()
end

function onSendViewPokemonLoot(pokemonName)
	if not cacheData.LootPokemons[pokemonName] and uiDexTabBar:isOn() then
		protocol.sendViewPokemonLoot(pokemonName)
	end
end

function onChildFocusChange(widget, focusChild)
	if focusChild then
		onSelectedPokemon(focusChild:getId(), focusChild.title)
	end
end

function onSearchPokemon(searchValue)
	for i, uiPokemon in pairs(uiPokemonList:getChildren()) do
		local searchCondition = searchValue == "" or searchValue ~= "" and string.find(uiPokemon:getId(), searchValue) ~= nil

		uiPokemon:setVisible(searchCondition)
	end
end

function onSearchPokemonOnMinimap()
	if g_game.getLocalPlayer():isPremium() then
		offline()
		modules.game_minimap.onSearchPokemon(uiPokemonDex.pokemonName)
	else
		displayInfoBox(tr("Pokedex"), "\xC9 necess\xE1rio ser um membro VIP!")
	end
end

function onDexTabChange(mainTab, tab)
	if tab.tooltip then
		uiTitleTabBar:setText(tr(tab.tooltip))

		if tab.tooltip == tr("Drops") then
			local focusChild = uiPokemonList:getFocusedChild()

			if focusChild and focusChild.view then
				onSendViewPokemonLoot(focusChild:getId())
			end
		end
	end
end

function onSelectedPokemon(pokemonName, title)
	if title and title:len() > 0 then
		pokemonName = tr("%s %s", title, pokemonName)
	end

	local pokemon = Pokedex_PokemonsByName[pokemonName]

	if not pokemon then
		return
	end

	local isUnlocked = cacheData.UnlockedPokemons[pokemonName] or not pokemon.Listed
	local isCatched = cacheData.CaughtPokemons[pokemonName]
	local uiPokemonImage = uiPokemonDex.image
	local uiPokemonNumber = uiPokemonDex.number
	local uiPokemonTypes = uiPokemonDex.elements
	local uiBackgroundBall = uiPokemonDex.backgroundBall
	local uiNameLabel = uiPokemonDex.name
	local uiShiny = uiPokemonDex.shiny
	local uiPokemonClass = uiPokemonDex.class

	uiPokemonNumber:setText("#" .. pokemon.FormatedId)
	uiBackgroundBall:setOn(isCatched)
	uiShiny:setVisible(not pokemon.Listed)
	uiPokemonImage:setOn(isUnlocked)
	uiPokemonImage:setEnabled(isUnlocked)
	uiPokemonImage:setImageSource(getPokemonImage(pokemon.Name))

	uiPokemonDex.pokemonName = pokemon.Name

	function uiPokemonImage.onClick()
		if pokemon.NextSpecie then
			onSelectedPokemon(pokemon.NextSpecie:lower())
		end
	end

	for i, widget in pairs({
		uiDexTabBar,
		uiPokemonTypes,
		uiTitleTabBar,
		uiContentPanel,
		uiPokemonClass
	}) do
		widget:setVisible(isUnlocked)
	end

	if isUnlocked then
		uiNameLabel:setText(pokemon.Name)
		setupPokemonMoves(pokemon)
		setupPokemonDrops(pokemon)
		setupPokemonStatistics(pokemon)
		setupPokemonEvolutions(pokemon)
		setupPokemonDescription(pokemon)
		setupPokemonEffectiveness(pokemon)
		setupElements(pokemon, uiPokemonTypes)
		setupPokemonClass(pokemon, uiPokemonClass)
	else
		uiNameLabel:setText("???")
	end
end

function setupPokemonView(uiPokemon, pokemonName, view, catch)
	local pokemon = Pokedex_PokemonsByName[pokemonName]

	if pokemon then
		local name = ("#%s %s"):format(pokemon.FormatedId, view and pokemon.Name or "???")

		uiPokemon:setId(pokemonName)
		uiPokemon:setText(name)
		uiPokemon:setOn(catch)

		uiPokemon.view = view
	end
end

function setupPokemonDrops(pokemon)
	if not uiDexTabBar:isOn() then
		return
	end

	if uiDexTabBar:getCurrentTab().tooltip == tr("Drops") then
		onSendViewPokemonLoot(pokemon.Name_Lower)
	end

	uiDropsList:destroyChildren()

	local loots = cacheData.LootPokemons[pokemon.Name_Lower]

	if not loots then
		return
	end

	for i, v in ipairs(loots) do
		local drop = g_ui.createWidget("PokedexDrops", uiDropsList)

		drop.item:setItemId(v.id)
		drop.name:setText(capitalize(v.name))
		drop.count:setText(tr("%d - %d", 1, v.count))

		if type(v.chance) == "string" then
			drop.chance:setOn(true)
			drop.chance:setText(tr(v.chance))
		else
			drop.chance:setText(tr("%s%%", v.chance))
		end
	end
end

function setupPokemonMoves(pokemon)
	uiMovesList:destroyChildren()

	for i, move in ipairs(pokemon.Moves) do
		setupMoves(move)
	end

	for i, passive in ipairs(pokemon.Passives) do
		passive.isPassive = true

		setupMoves(passive)
	end
end

function setupPokemonStatistics(pokemon)
	uiStatisticList:destroyChildren()

	if pokemon.Stats.vitality and pokemon.Stats.offense and pokemon.Stats.defense and pokemon.Stats.specialAttack and pokemon.Stats.agility then
		setupStatistic("Vitality", pokemon.Stats.vitality, 0, 2.7)
		setupStatistic("Offense", pokemon.Stats.offense, 0, 3)
		setupStatistic("Defense", pokemon.Stats.defense, 0, 3.1)
		setupStatistic("Special Attack", pokemon.Stats.specialAttack, 0, 4)
		setupStatistic("Agility", pokemon.Stats.agility, 0, 250)
	end
end

function setupPokemonEvolutions(pokemon)
	uiEvolutionsList:destroyChildren()

	for i, v in ipairs(pokemon.Evolutions) do
		local info = Pokedex_PokemonsByName[v.name:lower()]

		if info then
			local uiEvolution = g_ui.createWidget("PokedexEvolution", uiEvolutionsList)
			local isUnlocked = cacheData.UnlockedPokemons[info.Name_Lower]

			setupPokemonView(uiEvolution.name, info.Name_Lower, isUnlocked, false)
			uiEvolution.level:setText(tr("Need Level: %d", v.requiredLevel))
			uiEvolution.image:setImageSource(getPokemonImage(info.Name))
			uiEvolution.image:setOn(isUnlocked)
			uiEvolution.envolve:setVisible(#v.requiredItems > 0)

			for _, stone in pairs(v.requiredItems) do
				local stoneInfo = Pokedex_Stones[stone.id]
				local uiStone = g_ui.createWidget("PokedexStone", uiEvolution.uiStonesList)
				local tmpItem = Item.create(stoneInfo.ItemId, stone.count)

				tmpItem:setTooltip(tr("%s (%sx).", stoneInfo.Name, stone.count))
				uiStone:setItem(tmpItem)
			end

			uiEvolution.uiStonesList:setWidth(#v.requiredItems * 34)

			function uiEvolution.onClick()
				uiPokemonList:focusChild(uiPokemonList[info.Name_Lower])
			end
		end
	end
end

function setupPokemonDescription(pokemon)
	local level = pokemon.Level
	local abilities = #pokemon.Abilities > 0 and table.concat(pokemon.Abilities, ", ") or "None"
	local price = pokemon.Price > 0 and formatMoney(pokemon.Price * 100) or "Unsellable"

	uiDescriptionLabel:setMultiColorText(pokemon.Description:format(level, abilities, price))
	uiDescriptionScroll:setVisible(uiDescriptionLabel:getTextSize().height > uiDescriptionLabel.limitText)
end

function setupPokemonEffectiveness(pokemon)
	uiEffectivenessList:destroyChildren()

	for i = 1, #Pokedex_Effectiveness do
		local effectives = getEffectiveness(pokemon.Types[1], pokemon.Types[2] or pokemon.Types[1], Pokedex_Effectiveness[i][2])

		if #effectives > 0 then
			setupEffectiveness(Pokedex_Effectiveness[i][1], effectives)
		end
	end
end

function setupMoves(move)
	local uiMove = g_ui.createWidget("PokedexMoves", uiMovesList)
	local info = Pokedex_Moves[move.name:lower()]

	if not info then
		return
	end

	local icon = imageIconsPath .. info.Icon:lower() .. "_on"
	local description = info.Description or info.Description or ""

	if g_resources.fileExists(icon .. ".png") then
		uiMove.icon:setImageSource(icon)
	end

	uiMove.name:setText(move.name)
	uiMove:setTooltip(breakDescription(description, 15))

	if move.level then
		uiMove.level:setText(("Level: %s"):format(move.level))
	end

	if move.cooldown and move.cooldown > 0 then
		uiMove.cooldown:setText(("Cooldown: %ss"):format(move.cooldown))
	end

	if move.isPassive then
		uiMove.cooldown:setText("Passive")
	end

	if info.Types then
		setupElements(info, uiMove.elements)
	end
end

function setupElements(pokemon, ui)
	ui:destroyChildren()

	for i, element in ipairs(pokemon.Types) do
		setupElement(string.format("Element%sIcon-24px", capitalize(element)), element, ui)
	end
end

function setupElement(otui, element, parent)
	local uiElement = g_ui.createWidget(otui, parent)
	local info = Pokedex_Types[element:lower()]

	if info then
		uiElement:setTooltip(info.Text)
	end
end

function setupStatistic(name, value, minValue, maxValue)
	local uiStatistic = g_ui.createWidget("PokedexStatistic", uiStatisticList)

	uiStatistic.name:setText(name)
	uiStatistic.progress:setValue(value, minValue, maxValue)
end

function setupEffectiveness(effectiveName, effectives)
	local uiEffectivenessPanel = g_ui.createWidget("PokedexEffectivenessPanel", uiEffectivenessList)

	for i, elementName in pairs(effectives) do
		setupElement(string.format("Element%sIcon-32px", capitalize(elementName)), elementName, uiEffectivenessPanel.elements)
	end

	uiEffectivenessPanel.name:setText(tr(effectiveName))
	uiEffectivenessPanel:setHeight((uiEffectivenessPanel.elements:getChildCount() > 8 and 64 or 32) + uiEffectivenessPanel.name:getHeight() + uiEffectivenessPanel.name:getMarginTop() + uiEffectivenessPanel.elements:getMarginTop() + 6)
end

function setupPokemonClass(pokemon, ui)
	ui:destroyChildren()

	for i, class in ipairs(pokemon.Classes) do
		local uiClass = g_ui.createWidget("PokedexClass", ui)
		local description = Pokedex_Class_Description[class:lower()] or ""

		uiClass:setTooltip(description)
		uiClass:setImageSource(imageClassPath .. class)
	end
end

function getEffectiveness(typeOne, typeTwo, effectivenessMultiplier)
	local result = {}

	for i, v in pairs(Pokedex_TypesEffectiveness) do
		local multiplier = 1

		if Pokedex_TypesEffectiveness[i].super and table.contains(Pokedex_TypesEffectiveness[i].super, typeOne) then
			multiplier = typeTwo and multiplier * 2 or multiplier * 4
		end

		if Pokedex_TypesEffectiveness[i].super and typeTwo and table.contains(Pokedex_TypesEffectiveness[i].super, typeTwo) then
			multiplier = multiplier * 2
		end

		if Pokedex_TypesEffectiveness[i].weak and table.contains(Pokedex_TypesEffectiveness[i].weak, typeOne) then
			multiplier = typeTwo and multiplier / 2 or multiplier / 4
		end

		if Pokedex_TypesEffectiveness[i].weak and typeTwo and table.contains(Pokedex_TypesEffectiveness[i].weak, typeTwo) then
			multiplier = multiplier / 2
		end

		if Pokedex_TypesEffectiveness[i].non and table.contains(Pokedex_TypesEffectiveness[i].non, typeOne) then
			multiplier = 0
		end

		if Pokedex_TypesEffectiveness[i].non and typeTwo and table.contains(Pokedex_TypesEffectiveness[i].non, typeTwo) then
			multiplier = 0
		end

		if multiplier == effectivenessMultiplier then
			result[#result + 1] = i
		end
	end

	return result
end
