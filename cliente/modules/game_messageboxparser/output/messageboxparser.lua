-- chunkname: @/modules/game_messageboxparser/messageboxparser.lua

MessageBoxOpcode = 104

local Actions = {
	ItemCancelBox = 6,
	ItemErrorBox = 5,
	ItemInfoBox = 4,
	CancelBox = 3,
	ErrorBox = 2,
	InfoBox = 1
}

function validateMessageProperties(data)
	if not data.title then
		error("[MessageBoxParser] \"title\" property is missing from data!")
	elseif not data.message then
		error("[MessageBoxParser] \"message\" property is missing from data!")
	end

	return true
end

function validateItemMessageProperties(data)
	if not validateMessageProperties(data) then
		return
	elseif not data.itemClientId then
		error("[MessageBoxParser] \"itemClientId\" property is missing from data!")
	end

	return true
end

function parseInfoBox(data)
	print(4)
	displayInfoBox(data.title, data.message)
end

function parseErrorBox(data)
	displayErrorBox(data.title, data.message)
end

function parseCancelBox(data)
	displayCancelBox(data.title, data.message)
end

function parseItemInfoBox(data)
	if not validateItemMessageProperties(data) then
		return
	end

	displayItemInfoBox(data.title, data.message, Item.create(data.itemClientId))
end

function parseItemErrorBox(data)
	if not validateItemMessageProperties(data) then
		return
	end

	displayItemErrorBox(data.title, data.message, Item.create(data.itemClientId))
end

function parseItemCancelBox(data)
	if not validateItemMessageProperties(data) then
		return
	end

	displayItemCancelBox(data.title, data.message, Item.create(data.itemClientId))
end

local ActionParser = {
	[Actions.InfoBox] = parseInfoBox,
	[Actions.ErrorBox] = parseErrorBox,
	[Actions.CancelBox] = parseCancelBox,
	[Actions.ItemInfoBox] = parseItemInfoBox,
	[Actions.ItemErrorBox] = parseItemErrorBox,
	[Actions.ItemCancelBox] = parseItemCancelBox
}

function parseMessageBox(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		if not validateMessageProperties(jsonData.data) then
			return
		end

		parser(jsonData.data)
	end
end

function init()
	ProtocolGame.registerExtendedJSONOpcode(MessageBoxOpcode, parseMessageBox)
end

function terminate()
	ProtocolGame.unregisterExtendedJSONOpcode(MessageBoxOpcode)
end
