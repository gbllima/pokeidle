-- chunkname: @/modules/game_minitask/minitask.lua

MiniTask = {}

local protocol = runinsandbox("protocol")
local window, confirm
local RANDOMIZE_PRICE = 1
local PRICE_CANCEL = 10000000
local MAX_DONES = 7
local PLAYER_DONES = 1
local CURRENT_NPC = ""
local TYPES = {
	DEFEATS = 1,
	ITEMS = 3,
	CATCH = 2
}
local TYPES_DESCRIPTION = {
	[TYPES.DEFEATS] = "Derrotar o Pok\xE9mon.",
	[TYPES.CATCH] = "Capturar o Pok\xE9mon.",
	[TYPES.ITEMS] = "Coleta de Itens."
}
local TYPES_IMAGES = {
	[TYPES.DEFEATS] = "/images/game/minitask/1",
	[TYPES.CATCH] = "/images/game/minitask/2",
	[TYPES.ITEMS] = "/images/game/minitask/3"
}

local function getImageMissionType(missionType)
	return TYPES_IMAGES[missionType]
end

local function getMissionDescription(missionType)
	return TYPES_DESCRIPTION[missionType]
end

local function hasPlayerItems(lisItem)
	for i, v in ipairs(lisItem) do
		if v.player < v.count then
			return false
		end
	end

	return true
end

local function setupPanelItems(lisItem, ui, panel)
	for i, v in ipairs(lisItem) do
		local itemUI = g_ui.createWidget(ui, panel)
		local item = Item.create(v.itemId)
		local extra = ""

		if v.player then
			itemUI.count:setOn(v.player >= v.count)

			extra = tr(" (%d/%d)", v.player, v.count)
		end

		item:setTooltip(tr("%s%s", v.name, extra))
		itemUI:setItem(item)
		itemUI.count:setText(v.count)
	end
end

local function onOpen(params)
	local isFinished = false

	if params.player then
		CURRENT_NPC = params.npcName
		PRICE_CANCEL = params.price
		MAX_DONES = params.maxDones
		PLAYER_DONES = params.dones

		window.panelRewards.list:destroyChildren()
		setupPanelItems(params.rewards, "TaskRewardItem", window.panelRewards.list)

		local missionNpc = params.player

		window.panelTask.type:setImageSource(getImageMissionType(missionNpc.type))
		window.panelTask.description:setText(tr("Tarefa: %s", getMissionDescription(missionNpc.type)))

		for i = TYPES.DEFEATS, TYPES.ITEMS do
			window.panelTypes[i]:setOn(missionNpc.type == i)
		end

		window.panelTask.outfit:setVisible(not params.items)
		window.panelTask.count:setVisible(not params.items)
		window.panelTask.list:destroyChildren()
		window.panelTask.scroll:hide()

		if params.items then
			window.panelTask.scroll:setVisible(#params.items > 6)
			setupPanelItems(params.items, "TaskItem", window.panelTask.list)
		elseif params.outfit then
			window.panelTask.count:clearText()
			window.panelTask.outfit:setOutfit(params.outfit)
			window.panelTask.count:setText(params.count .. "x")
		end

		if params.isDoing and missionNpc.count == -1 then
			isFinished = true
		end

		local isStarted = missionNpc.count > -1
		local isDone = missionNpc.count == 0 or params.items and hasPlayerItems(params.items)

		window.cancel:setVisible(isStarted)
		window.start:setVisible(not isStarted)
		window.finish:setVisible(isStarted and isDone)
		window.panelTypes.randomize:setEnabled(not isStarted)
	end

	window:setText(tr("Mini Task (%s)", params.npcName))
	window.panel:setVisible(isFinished)
	window:show()
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = hide
	})
	connect(MiniTask, {
		onOpen = onOpen
	})
	connect(LocalPlayer, {
		onPositionChange = onPositionChange
	})

	window = g_ui.displayUI("minitask")
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = hide
	})
	disconnect(MiniTask, {
		onOpen = onOpen
	})
	connect(LocalPlayer, {
		onPositionChange = onPositionChange
	})
	hide()
	window:destroy()

	window = nil
end

function hide()
	if confirm then
		confirm:destroy()

		confirm = nil
	end

	window:hide()

	CURRENT_NPC = ""
end

function onPositionChange()
	if window and window:isVisible() then
		hide()
	end
end

function onConfirmRandomize()
	local function onConfirm()
		protocol.sendGenerateMission(CURRENT_NPC)
	end

	confirm = displayConfirmBox(tr("Tem certeza?"), tr("Voc\xEA realmente deseja gastar {%s|%d P-Buck} para randomizar?", "#e2bb5b", RANDOMIZE_PRICE), onConfirm)
end

function onStart()
	if PLAYER_DONES >= MAX_DONES then
		return displayErrorBox(window:getText(), tr("Voc\xEA j\xE1 aceitou %d de %d mini-task, volte semana que vem!", PLAYER_DONES, MAX_DONES))
	end

	local function onConfirm()
		protocol.sendStart(CURRENT_NPC)
	end

	confirm = displayConfirmBox(tr("Tem certeza?"), "Voc\xEA realmente deseja aceitar est\xE1 mini-task?", onConfirm)
end

function onCancel()
	local function onConfirm()
		protocol.sendCancel(CURRENT_NPC)
	end

	confirm = displayConfirmBox(tr("Tem certeza?"), tr("Voc\xEA realmente deseja cancelar sua mini-task? Ser\xE1 cobrado um valor de {#eb4034|%s}.", formatMoney(PRICE_CANCEL)), onConfirm)
end

function onEnd()
	protocol.sendEnd(CURRENT_NPC)
end
