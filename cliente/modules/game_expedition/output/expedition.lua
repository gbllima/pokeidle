-- chunkname: @/modules/game_expedition/expedition.lua

Expeditions = {}

local protocol = runinsandbox("protocol")
local window, confirm
local list = {}
local favorites = {}
local ImagePath = "/images/game/expeditions/"

function removeSpecialCharacters(str)
	return str:lower():gsub("[^%w%s]", "")
end

function getImage(name)
	return ImagePath .. (g_resources.fileExists(ImagePath .. removeSpecialCharacters(name) .. ".png") and removeSpecialCharacters(name) or "none")
end

local function sortList()
	local sortedList = {}

	for i, v in ipairs(list) do
		table.insert(sortedList, favorites[removeSpecialCharacters(v.name)] and 1 or i, v)
	end

	return sortedList
end

local function hide()
	if window:isVisible() then
		window:hide()
	end

	if confirm then
		confirm:destroy()

		confirm = nil
	end
end

local function onList()
	window.listPanel:destroyChildren()

	for i, v in ipairs(sortList()) do
		local travel = g_ui.createWidget("ExpeditionTravel", window.listPanel)

		travel:setId(v.name)
		travel:setImageSource(getImage(v.name))
		travel.favorite:setOn(favorites[removeSpecialCharacters(v.name)])

		function travel.start.onClick()
			showConfirm(window:getText(), tr("Voc\xEA deseja viajar para {#e2bb5b|%s}?", v.name), function()
				protocol.sendTravel(v.id)
				hide()

				confirm = nil
			end)
		end
	end
end

local function onOpen(params)
	if params.price then
		window.buyPanel:show()
		window.listPanel:hide()

		function window.buyPanel.buyButton.onClick()
			protocol.sendBuy()
		end

		window.buyPanel.priceLabel:setText(tr("$ %s", formatMoney(params.price)))
		window.buyPanel.descriptionLabel:setText(tr("Para liberar as expedi\xE7\xF5es \xE9 necess\xE1rio\nestar n\xEDvel %d+ e possuir um DAILY PASS", params.level))
	else
		window.buyPanel:hide()
		window.listPanel:show()

		list = params

		onList()
	end

	window:show()
	window:raise()
end

local function onLeave(id, name)
	showConfirm(name, tr("Voc\xEA realmente deseja sair?"), function()
		protocol.sendLeave(id)

		confirm = nil
	end)
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	connect(Expeditions, {
		onOpen = onOpen,
		onLeave = onLeave
	})
	connect(LocalPlayer, {
		onPositionChange = hide
	})

	window = g_ui.displayUI("expedition.otui")
	favorites = g_settings.getNode("favoritesExpedition") or {}
end

function terminate()
	protocol.terminateProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	disconnect(Expeditions, {
		onOpen = onOpen,
		onLeave = onLeave
	})
	disconnect(LocalPlayer, {
		onPositionChange = hide
	})
	g_settings.setNode("favoritesExpedition", favorites)
	window:destroy()

	window = nil
end

function onGameEnd()
	hide()
end

function showConfirm(title, description, callback)
	if not confirm then
		confirm = displayConfirmBox(title, description, callback, function()
			confirm = nil
		end)
	end
end

function toggleFavorite(button)
	local name = removeSpecialCharacters(button:getParent():getId())

	favorites[name] = not favorites[name]

	onList()
end
