-- chunkname: @/modules/game_pokeprey/pokeprey.lua

preyWindow = nil

local preyTracker, messageWindow, chooseWindow, bonusGroup, preyButton
local preyPrice = 3000
local imageBuffPath = "/images/game/prey/"
local trackerHeight = {
	78,
	116,
	157,
	200
}
local ExtendsOpcodes = {
	PokePrey = 87
}
local PREY_ACTION = {
	CANCEL = 8,
	START = 7,
	MESSAGE = 6,
	CHANGE_BONUS = 5,
	CHOOSE_SELECT = 4,
	RANDOM_POKEMON = 3,
	CHOOSE_OPEN = 2,
	OPEN = 1,
	TRACKER_REMOVE = 11,
	TRACKER = 10,
	FINISH = 9,
	UPDATE = 12
}
local PREY_TICKET_ITEMID = 23174
local PREY_BUFF_TYPE = {
	EXP = 1,
	NONE = 0,
	CATCH = 3,
	LOOT = 2
}
local PREY_BUFF = {
	[PREY_BUFF_TYPE.NONE] = {
		tooltip = "Não há bônus ativo",
		image = "prey_none"
	},
	[PREY_BUFF_TYPE.EXP] = {
		tooltip = "+40% de experiência",
		image = "prey_exp"
	},
	[PREY_BUFF_TYPE.LOOT] = {
		tooltip = "+20% de loot",
		image = "prey_loot"
	},
	[PREY_BUFF_TYPE.CATCH] = {
		tooltip = "+1.3x de catch",
		image = "prey_catch"
	}
}

function parseSlot(pokemon)
	local slotPanel = preyWindow.list[pokemon.index]

	if not slotPanel then
		slotPanel = g_ui.createWidget("PreySlot", preyWindow.list)

		slotPanel:setId(pokemon.index)
	end

	local preyBuff = PREY_BUFF[pokemon.buffer] or PREY_BUFF[PREY_BUFF_TYPE.NONE]
	local isUnlocked = not pokemon.locked
	local image = isUnlocked and getPokemonImage(pokemon.name) or imageBuffPath .. "locked"
	local defeats = pokemon.doing and tr("Derrote: %d/%d", pokemon.amount, pokemon.count) or tr("Derrote: %d", pokemon.count)

	slotPanel.pokemon = pokemon

	slotPanel:setText(tr("Espa\xE7o %d", pokemon.index))
	slotPanel.image:setOn(isUnlocked)
	slotPanel.defeats:setText(defeats)
	slotPanel.name:setText(pokemon.name)
	slotPanel.image:setImageSource(image)
	slotPanel.buffer:setVisible(pokemon.doing and isUnlocked)
	slotPanel.buffer:setImageSource(imageBuffPath .. preyBuff.image)

	for i, widget in pairs({
		slotPanel.name,
		slotPanel.skull,
		slotPanel.defeats
	}) do
		widget:setVisible(isUnlocked)
	end

	onChildFocusChange(preyWindow.list, preyWindow.list:getFocusedChild())
	preyWindow:show()
	preyWindow:focus()
end

function updateSlot(pokemon)
	local slotPanel = preyWindow.list[pokemon.index]

	if not slotPanel then
		return
	end

	local preyBuff = PREY_BUFF[pokemon.buffer] or PREY_BUFF[PREY_BUFF_TYPE.NONE]
	local isUnlocked = not pokemon.locked
	local image = isUnlocked and getPokemonImage(pokemon.name) or imageBuffPath .. "locked"
	local defeats = pokemon.doing and tr("Derrote: %d/%d", pokemon.amount, pokemon.count) or tr("Derrote: %d", pokemon.count)

	slotPanel.pokemon = pokemon

	slotPanel:setText(tr("Espa\xE7o %d", pokemon.index))
	slotPanel.image:setOn(isUnlocked)
	slotPanel.defeats:setText(defeats)
	slotPanel.name:setText(pokemon.name)
	slotPanel.image:setImageSource(image)
	slotPanel.buffer:setVisible(pokemon.doing and isUnlocked)
	slotPanel.buffer:setImageSource(imageBuffPath .. preyBuff.image)

	for i, widget in pairs({
		slotPanel.name,
		slotPanel.skull,
		slotPanel.defeats
	}) do
		widget:setVisible(isUnlocked)
	end

	onChildFocusChange(preyWindow.list, preyWindow.list:getFocusedChild())
end

function parseMessage(message)
	modules.game_scout.onScoutMessage({
		title = preyWindow:getText(),
		msg = message
	})
end

function parseTracker(pokemon)
	local tracker = preyTracker.contentsPanel[pokemon.name]

	if not tracker then
		tracker = g_ui.createWidget("TrackerCreature", preyTracker.contentsPanel)

		tracker:setId(pokemon.name)
	end

	tracker.name:setText(pokemon.name)
	tracker.creature:setOutfit(pokemon.outfit)
	tracker.progress:setValue(pokemon.amount, 0, pokemon.count)
	tracker.defeats:setText(tr("(%s/%s)", pokemon.amount, pokemon.count))
	preyTracker:setHeight(trackerHeight[preyTracker.contentsPanel:getChildCount()])
end

function parseTrackerRemove(pokemon)
	local tracker = preyTracker.contentsPanel[pokemon]

	if tracker then
		tracker:destroy()
	end

	preyTracker:setHeight(trackerHeight[preyTracker.contentsPanel:getChildCount()])
end

function parseChoose(pokemonList)
	onCloseChooseWindow()

	chooseWindow = g_ui.createWidget("PreyChooseWindow", preyWindow)

	table.sort(pokemonList, function(a, b)
		return a.name < b.name
	end)

	for i, v in pairs(pokemonList) do
		local widget = g_ui.createWidget("PreyChooseCreature", chooseWindow.list)

		widget.image:setImageSource(getPokemonPortrait(v.name))
		widget:setTooltip(v.name)
	end

	if bonusGroup then
		bonusGroup:destroy()
	end

	bonusGroup = UIRadioGroup.create()

	for i, widget in pairs(chooseWindow.panel:getChildren()) do
		bonusGroup:addWidget(widget)
	end

	bonusGroup:selectWidget(chooseWindow.panel:getFirstChild())
end

function sendPreyAction(action, data)
	local protocolGame = g_game.getProtocolGame()

	if protocolGame then
		protocolGame:sendExtendedJSONOpcode(ExtendsOpcodes.PokePrey, {
			action = action,
			data = data or {}
		})
	end
end

function requestOpen()
	preyButton:setOn(true)
	sendPreyAction(PREY_ACTION.OPEN)
end

function requestRandomPokemon(pokemonName)
	local player = g_game.getLocalPlayer()
	local message = tr("Do you really want to randomize this slot by %s?", formatMoney(preyPrice * player:getLevel()))

	showMessage(tr("Random Pokemon"), message, function()
		sendPreyAction(PREY_ACTION.RANDOM_POKEMON, {
			pokemonName = pokemonName
		})
	end)
end

function requestCancel(pokemonName)
	local player = g_game.getLocalPlayer()
	local message = tr("Do you want to cancel the {%s|%s} prey by %s?", "#e2bb5b", pokemonName, formatMoney(preyPrice * player:getLevel()))

	showMessage(tr("Cancel"), message, function()
		sendPreyAction(PREY_ACTION.CANCEL, {
			pokemonName = pokemonName
		})
	end)
end

function requestStart(pokemonName)
	sendPreyAction(PREY_ACTION.START, {
		pokemonName = pokemonName
	})
end

function requestChooseOpen()
	sendPreyAction(PREY_ACTION.CHOOSE_OPEN)
end

function requestFinish(pokemonName)
	if preyWindow.selected.restart:isChecked() then
		if g_game.getLocalPlayer():getItemCount(PREY_TICKET_ITEMID) > 0 then
			sendPreyAction(PREY_ACTION.FINISH, {
				pokemonName = pokemonName,
				restart = preyWindow.selected.restart:isChecked()
			})
		else
			parseMessage("Você precisa de um Prey Ticket para renovar este pokémon!")
		end
	else
		sendPreyAction(PREY_ACTION.FINISH, {
			pokemonName = pokemonName
		})
	end
end

function requestChoosePokemon(oldPokemonName, newPokemonName)
	local message = tr("Você realmente deseja gastar 1 prey ticket fazer a prey do {%s|%s}?", "#e2bb5b", newPokemonName)
	local data = {
		pokemonName = oldPokemonName,
		newPokemonName = newPokemonName,
		buffType = tonumber(bonusGroup:getSelectedWidget():getId())
	}

	showMessage(tr("Choose"), message, function()
		sendPreyAction(PREY_ACTION.CHOOSE_SELECT, data)
		onCloseChooseWindow()
	end)
end

function requestChangeBonus(pokemonName)
	local player = g_game.getLocalPlayer()
	local message = tr("Você deseja trocar o bônus da prey {%s|%s} por %s?", "#e2bb5b", pokemonName, formatMoney(preyPrice * player:getLevel()))

	showMessage(tr("Change"), message, function()
		sendPreyAction(PREY_ACTION.CHANGE_BONUS, {
			pokemonName = pokemonName
		})
	end)
end

local parseOpcodesMap = {
	[PREY_ACTION.OPEN] = parseSlot,
	[PREY_ACTION.UPDATE] = updateSlot,
	[PREY_ACTION.MESSAGE] = parseMessage,
	[PREY_ACTION.CHOOSE_OPEN] = parseChoose,
	[PREY_ACTION.TRACKER] = parseTracker,
	[PREY_ACTION.TRACKER_REMOVE] = parseTrackerRemove
}

function init()
	connect(g_game, {
		onGameEnd = onPreyGameEnd
	})

	preyButton = modules.client_topmenu.addRightGameButton("preyButton", tr("Poke Prey"), "/images/topbuttons/pokeprey", toggle, false, 1)

	ProtocolGame.registerExtendedJSONOpcode(ExtendsOpcodes.PokePrey, parsePokePrey)

	preyWindow = g_ui.displayUI("pokeprey")
	preyTracker = g_ui.createWidget("PreyTracker", modules.game_interface.getRightPanel())

	preyTracker:setContentMaximumHeight(170)
	preyTracker:setup()
	connect(preyWindow.list, {
		onChildFocusChange = onChildFocusChange
	})
end

function terminate()
	disconnect(g_game, {
		onGameEnd = onPreyGameEnd
	})
	disconnect(preyWindow.list, {
		onChildFocusChange = onChildFocusChange
	})
	ProtocolGame.unregisterExtendedJSONOpcode(ExtendsOpcodes.PokePrey)
	onPreyGameEnd()
	preyButton:destroy()

	preyButton = nil

	preyWindow:destroy()
	preyTracker:destroy()
end

function onPreyGameEnd()
	removeEvent(preyWindow.event)
	preyButton:setOn(false)
	preyWindow:hide()
	preyTracker.contentsPanel:destroyChildren()
	preyTracker:hide()

	if messageWindow then
		messageWindow:destroy()

		messageWindow = nil
	end

	onCloseChooseWindow()
end

function parsePokePrey(protocol, opcode, json_data)
	local action = json_data.action
	local data = json_data.data
	local executeAction = parseOpcodesMap[action]

	if executeAction then
		executeAction(data)
	end
end

function toggleTracker()
	preyTracker:setVisible(not preyTracker:isVisible())
end

function showMessage(title, message, callback)
	if messageWindow then
		messageWindow:destroy()
	end

	local function cancelCallback()
		messageWindow:destroy()

		messageWindow = nil
	end

	local function confirmCallback()
		callback()
		cancelCallback()
	end

	messageWindow = displayGeneralBox(title, message, {
		{
			color = "Blue",
			text = tr("Yes"),
			callback = confirmCallback
		},
		{
			color = "Red",
			text = tr("No"),
			callback = cancelCallback
		},
		anchor = AnchorHorizontalCenter
	}, confirmCallback, cancelCallback)

	messageWindow:show()
	messageWindow:raise()
	messageWindow:focus()

	return messageWindow
end

function searchChoosePokemon(searchValue)
	for i, child in pairs(chooseWindow.list:getChildren()) do
		local searchCondition = searchValue == "" or searchValue ~= "" and string.find(child:getTooltip():lower(), searchValue:lower()) ~= nil

		child:setVisible(searchCondition)
	end
end

function onChildFocusChange(widget, focusChild)
	if focusChild and focusChild.pokemon then
		local pokemon = focusChild.pokemon
		local selectedPanel = preyWindow.selected
		local preyBuff = PREY_BUFF[pokemon.buffer] or PREY_BUFF[PREY_BUFF_TYPE.NONE]
		local isDoing = pokemon.doing
		local isUnlocked = not pokemon.locked
		local isFinished = pokemon.amount >= pokemon.count
		local isStarted = pokemon.amount == 0
		local isStarting = pokemon.amount > 0
		local image = isUnlocked and getPokemonImage(pokemon.name) or imageBuffPath .. "locked"
		local title = not isUnlocked and "Espaço " .. pokemon.index or isDoing and "Em andamento" or isFinished and "Finalizado" or "Derrote"

		selectedPanel:setText(title)
		selectedPanel.image:setOn(isUnlocked)
		selectedPanel.cancel:setOn(isStarting)
		selectedPanel.finish:setVisible(isFinished)
		selectedPanel.ticket:setVisible(isFinished)
		selectedPanel.restart:setVisible(isFinished)
		selectedPanel.buy:setVisible(not isUnlocked)
		selectedPanel.description:setOn(pokemon.index == 2)
		selectedPanel.description:setVisible(not isUnlocked)
		selectedPanel.random:setVisible(isUnlocked and not isDoing)
		selectedPanel.search:setVisible(isUnlocked and not isDoing)
		selectedPanel.start:setVisible(isUnlocked and not isDoing and not isFinished)
		selectedPanel.cancel:setVisible(isUnlocked and isDoing and not isFinished)
		selectedPanel.switch:setVisible(isUnlocked and isStarted and not isStarting)

		for i, widget in pairs({
			selectedPanel.panel,
			selectedPanel.name
		}) do
			widget:setVisible(isUnlocked)
		end

		selectedPanel.name:setText(pokemon.name)
		selectedPanel.image:setImageSource(image)
		selectedPanel.panel.bonus:setText(preyBuff.tooltip)
	end
end

function onCloseChooseWindow()
	if chooseWindow then
		chooseWindow:destroy()

		chooseWindow = nil
	end
end

function onChooseSelectPokemon()
	if not chooseWindow then
		return
	end

	local focusChild = chooseWindow.list:getFocusedChild()
	local newPokemonName = focusChild:getTooltip()
	local oldPokemonName = preyWindow.selected.name:getText()

	requestChoosePokemon(oldPokemonName, newPokemonName)
end

function toggle()
	if preyButton:isOn() then
		onPreyGameEnd()
	else
		requestOpen()
	end
end
