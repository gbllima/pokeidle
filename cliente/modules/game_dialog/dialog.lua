Dialog = {}

local OPCODE_DIALOG = 62
local dialogWindow
local protocol = runinsandbox("protocol")

local function resize(height)
	if dialogWindow then
		local newHeight = dialogWindow:getPaddingTop() + dialogWindow:getPaddingBottom() + dialogWindow:getPaddingLeft() + dialogWindow:getPaddingRight() + height
		dialogWindow:resize(dialogWindow:getWidth(), newHeight)
	end
end

function addDialogOption(data)
	local keywords = data.keywords
	local pokemons = data.pokemons
	local items = data.items
	local height = 0

	dialogWindow.extra:setOn(pokemons or items)
	dialogWindow.extraScroll:setOn(pokemons or items)

	if keywords and #keywords > 0 then
		for i = 1, #keywords do
			local option = g_ui.createWidget("OptionDialog", dialogWindow.options)
			if i <= 3 then
				height = height + option:getHeight() + option:getMarginTop()
			end

			local keyword = keywords[i]
			if type(keyword) == "table" then
				option:setText(keyword.text or "")
				option.response = keyword.response or ""
				option.opcode = keyword.opcode
				option.payload = keyword.payload

				option.onClick = function()
					-- Envia via ExtendedOpcode, se existir
					if option.opcode then
						local protocol = g_game.getProtocolGame()
						if protocol then
							protocol:sendExtendedOpcode(tonumber(option.opcode), option.payload or "")
						end
						onDialogGameEnd()
						return
					end

					-- Envia como mensagem normal
					if option.response and option.response ~= "" then
						g_game.talk(option.response)
						onDialogGameEnd()
					end
				end
			else
				option:setText(keyword)
				option.response = keyword

				option.onClick = function()
					g_game.talk(option.response)
					onDialogGameEnd()
				end
			end
		end
		dialogWindow.options.selectedWidget = dialogWindow.options:getFirstChild()
		dialogWindow.optionsScroll:setVisible(#keywords > 3)
	end

	if pokemons and #pokemons > 0 then
		for i = 1, #pokemons, 2 do
			local pokemon = g_ui.createWidget("PokemonDialog", dialogWindow.extra)
			pokemon:setTooltip(pokemons[i])
			pokemon:setOutfit(pokemons[i + 1])
		end
	end

	if items and #items > 0 then
		for i = 1, #items, 3 do
			local item = g_ui.createWidget("ItemDialog", dialogWindow.extra)
			local tmpItem = Item.create(items[i])
			tmpItem:setTooltip(tr("%s (%sx).", items[i + 2], items[i + 1]))
			item:setItem(tmpItem)
			item:setItemCount(items[i + 1])
		end
	end

	local newHeight = 36 + height + dialogWindow.extra:getHeight() + dialogWindow.extra:getMarginTop() + dialogWindow.extraScroll:getHeight() + dialogWindow.extraScroll:getMarginTop() + dialogWindow.message:getTextSize().height
	resize(newHeight)
end


local function onOpen(params)
	onDialogGameEnd()
	dialogWindow = g_ui.createWidget("DialogWindow", rootWidget)

	local creature = g_map.getCreatureById(params.cid)
	if creature then
		dialogWindow.title:setText(creature:getName())
	else
		dialogWindow.title:setText("NPC")
	end

	dialogWindow.message:setMultiColorText(params.message)
	resize(dialogWindow.message:getTextSize().height + 5)
	addDialogOption(params.options or {})
end

local function onClose()
	onDialogGameEnd()
end

function init()
	protocol.initProtocol()
	connect(g_game, { onGameEnd = onDialogGameEnd })
	connect(Dialog, { onOpen = onOpen, onClose = onClose })

	ProtocolGame.registerExtendedOpcode(OPCODE_DIALOG, function(protocol, opcode, buffer)
		local success, data = pcall(function() return json.decode(buffer) end)
		if success and data then
			onOpen(data)
		else
			print("[Dialog] Falha ao decodificar JSON do opcode 62.")
		end
	end)
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, { onGameEnd = onDialogGameEnd })
	disconnect(Dialog, { onOpen = onOpen, onClose = onClose })
	ProtocolGame.unregisterExtendedOpcode(OPCODE_DIALOG)
	onDialogGameEnd()
end

function onDialogGameEnd()
	if dialogWindow then
		dialogWindow:destroy()
		dialogWindow = nil
	end
end
