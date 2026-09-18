-- chunkname: @/modules/game_inventory/inventory.lua

local inventoryWindow

InventoryHotkeyList = {}

function registerInventoryHotkey(hotkeyName, keyCombo, callback)
	local function bindCallback()
		if g_game.isOnline() and (g_keyboard.isChatEnabled() or g_keyboard.hasTextEditChange() or modules.game_minigame.isPlaying()) then
			return
		end

		callback()
	end

	InventoryHotkeyList[hotkeyName] = {
		keyCombo = keyCombo,
		callback = bindCallback
	}

	g_keyboard.bindHotkeyPress(keyCombo, bindCallback, modules.game_interface.getRootPanel(), "Action Bar")
end

function unregisterInventoryHotkey(hotkeyName)
	local hotkey = InventoryHotkeyList[hotkeyName]

	if hotkey then
		g_keyboard.unbindHotkeyPress(hotkey.keyCombo, hotkey.callback, modules.game_interface.getRootPanel())
	end
end

function updateInventoryHotkey(hotkeyName, keyCombo)
	local hotkey = InventoryHotkeyList[hotkeyName]

	if hotkey then
		unregisterInventoryHotkey(hotkeyName)
		registerInventoryHotkey(hotkeyName, keyCombo, hotkey.callback)
	end
end

function getInventoryHotkeys()
	return InventoryHotkeyList
end

registerInventoryHotkey("pokedex", "Shift+D", function()
	g_game.getLocalPlayer():doUsePokedex()
end)
registerInventoryHotkey("fishing", "Shift+F", function()
	g_game.getLocalPlayer():doUseFishing()
end)
registerInventoryHotkey("pokebag", "Shift+I", function()
	g_game.getLocalPlayer():doUsePokeBag()
end)
registerInventoryHotkey("autoloot", "Shift+E", function()
	g_game.getLocalPlayer():doUseAutoLoot()
end)
registerInventoryHotkey("order", "Shift+R", function()
	g_game.getLocalPlayer():doUseOrder()
end)

function init()
	connect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})

	inventoryWindow = g_ui.loadUI("inventory", modules.game_interface.getRightPanel())

	inventoryWindow:setup()
end

function terminate()
	disconnect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})

	for hotkeyName, v in pairs(InventoryHotkeyList) do
		unregisterInventoryHotkey(hotkeyName)
	end

	inventoryWindow:destroy()

	inventoryWindow = nil
end

function online()
	local inventoryHotkeys = g_settings.getNode("inventoryHotkeys") or {}

	for hotkeyName, keyCombo in pairs(inventoryHotkeys) do
		local callback = InventoryHotkeyList[hotkeyName] and InventoryHotkeyList[hotkeyName].callback or function()
			return
		end

		unregisterInventoryHotkey(hotkeyName)
		registerInventoryHotkey(hotkeyName, keyCombo, callback)
	end
end

function offline()
	local inventoryHotkeys = {}

	for hotkeyName, v in pairs(InventoryHotkeyList) do
		inventoryHotkeys[hotkeyName] = v.keyCombo

		unregisterInventoryHotkey(hotkeyName)
	end

	g_settings.setNode("inventoryHotkeys", inventoryHotkeys)
end

function getInventoryWindow()
	return inventoryWindow
end
