-- chunkname: @/modules/game_pokeinfo/pokeinfo.lua

Icons = {}
Icons[128] = {
	on = false,
	color = "#e3444499",
	id = "condition_logout_block",
	path = "/images/game/pokeinfo/logout_block"
}
Icons[16384] = {
	on = false,
	color = "#4499e399",
	id = "condition_protection_zone",
	path = "/images/game/pokeinfo/protection_zone"
}
pokemonWindow = nil
pokeHealthBar = nil
autoWalkButton = nil

function init()
	connect(LocalPlayer, {
		onStatesChange = onStatesChange,
		onInventoryChange = onInventoryChange
	})
	connect(g_game, {
		onGameStart = refresh,
		onGameEnd = offline,
		onTextMessage = onPokeHealthChange
	})

	pokemonWindow = g_ui.loadUI("pokeinfo", modules.game_interface.getRightPanel())

	pokemonWindow:setContentMinimumHeight(75)
	pokemonWindow:setContentMaximumHeight(75)

	pokeHealthBar = pokemonWindow:recursiveGetChildById("pokeHealthBar")
	autoWalkButton = pokemonWindow:recursiveGetChildById("autoWalkButton")

	refresh()
	pokemonWindow:setup()
end

function terminate()
	disconnect(LocalPlayer, {
		onStatesChange = onStatesChange,
		onInventoryChange = onInventoryChange
	})
	disconnect(g_game, {
		onGameStart = refresh,
		onGameEnd = offline,
		onTextMessage = onPokeHealthChange
	})
	removeEvent(autoWalkButton.event)
	pokemonWindow:destroy()

	pokemonWindow = nil
end

function refresh()
	if not g_game.isOnline() then
		return
	end

	local player = g_game.getLocalPlayer()

	onStatesChange(player, player:getStates(), 0)

	for i = InventorySlotFirst, InventorySlotLast do
		if g_game.isOnline() then
			onInventoryChange(player, i, player:getInventoryItem(i))
		else
			onInventoryChange(player, i, nil)
		end
	end

	pokemonWindow:show()
end

function onClickWithMouse(self, mousePosition, mouseButton)
	if mouseButton == MouseLeftButton or mouseButton == MouseMidButton then
		local clickedWidget = modules.game_interface.getRootPanel():recursiveGetChildByPos(mousePosition, false)

		if clickedWidget then
			local protocol = g_game.getProtocolGame()

			if clickedWidget:getClassName() == "UIGameMap" then
				local tile = clickedWidget:getTile(mousePosition)
				local pos = tile:getPosition()

				if tile then
					local thing = tile:getTopMoveThing()

					if thing:isCreature() then
						if protocol then
							protocol:sendExtendedOpcode(53, thing:getId())
						end

						if thing:isLocalPlayer() then
							modules.game_pokedex.show(0)
						elseif thing:isMonster() then
							if string.find(getPokemonNameByOutfit(tile:getTopCreature():getOutfit().type), "Shiny") then
								modules.game_pokedex.show(getPokemonIdByName(string.lower(string.explode(getPokemonNameByOutfit(tile:getTopCreature():getOutfit().type), "Shiny ")[2])), true)
							else
								modules.game_pokedex.show(getPokemonIdByName(string.lower(getPokemonNameByOutfit(tile:getTopCreature():getOutfit().type))), false)
							end
						end
					end
				end
			elseif clickedWidget:getClassName() == "UICreatureButton" then
				local creature = clickedWidget:getCreature()

				protocol:sendExtendedOpcode(53, creature:getId())
			end
		end
	end

	g_mouse.popCursor("target")
	self:ungrabMouse()
	self:destroy()

	return true
end

function toggle()
	pokemonWindow:setVisible(not pokemonWindow:isVisible())
end

function toggleIcon(bitChanged)
	local iconInfo = Icons[bitChanged]
	local portrait = pokemonWindow.contentsPanel.portrait

	if not iconInfo then
		portrait:setBorderWidth(0)

		return
	end

	if not iconInfo.on then
		portrait:setBorderWidth(3)
		portrait:setBorderColor(iconInfo.color)

		iconInfo.on = true
	else
		portrait:setBorderWidth(0)

		iconInfo.on = false
	end
end

function loadIcon(bitChanged)
	local icon = g_ui.createWidget("ConditionWidget", content)

	icon:setId(Icons[bitChanged].id)
	icon:setImageSource(Icons[bitChanged].path)

	return icon
end

function offline()
	autoWalkButton:setOn(false)
	pokemonWindow:recursiveGetChildById("conditionPanel"):destroyChildren()
end

function onMiniWindowClose()
	return
end

function onPokeHealthChange(mode, text)
	if not g_game.isOnline() then
		return
	end

	if mode == MessageModes.Failure and string.find(text, "#ph#,") then
		local t = text:explode(",")
		local hp, maxHp = tonumber(t[2]), tonumber(t[3])

		pokeHealthBar:setText(hp .. " / " .. maxHp)
		pokeHealthBar:setValue(hp, 0, maxHp)
		modules.game_textmessage.displayFailureMessage("")
	end
end

function onStatesChange(localPlayer, now, old)
	if now == old then
		return
	end

	local bitsChanged = bit32.bxor(now, old)

	for i = 1, 32 do
		local pow = math.pow(2, i - 1)

		if bitsChanged < pow then
			break
		end

		local bitChanged = bit32.band(bitsChanged, pow)

		if bitChanged ~= 0 then
			toggleIcon(bitChanged)
		end
	end
end

function onInventoryChange(player, slot, item, oldItem)
	if slot > InventorySlotPurse then
		return
	end

	local itemWidget = pokemonWindow:recursiveGetChildById("slot" .. slot)

	if item then
		itemWidget:setItem(item)

		local pokemonName = item:getPokemon()

		if pokemonName:len() > 0 then
			pokemonWindow.contentsPanel.portrait:show()
			pokemonWindow.contentsPanel.portrait:setImageSource(getPokemonPortrait(pokemonName))
		end
	else
		if slot == InventorySlotFeet then
			pokemonWindow.contentsPanel.portrait:setImageSource(getPokemonPortrait("none"))
		end

		itemWidget:setItem(nil)
	end
end

function onWalking()
	autoWalkButton:setOn(not autoWalkButton:isOn())
	onAutoWalk()
end

function onAutoWalk()
	if autoWalkButton:isOn() and not modules.game_tv.isPlayerWatchingTV() then
		local player = g_game.getLocalPlayer()

		if player then
			removeEvent(autoWalkButton.event)
			modules.game_walking.walk(player:getDirection(), 100)

			autoWalkButton.event = scheduleEvent(onAutoWalk, 100)
		else
			autoWalkButton:setOn(false)
			removeEvent(autoWalkButton.event)
		end
	else
		autoWalkButton:setOn(false)
		removeEvent(autoWalkButton.event)
	end
end
