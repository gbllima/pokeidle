-- chunkname: @/modules/game_tv/tv.lua

local isWatchingTV = false
local streamingWindow, watchingWindow, tvCamWindow, tvChannelsWindow, changeChannelPasswordWindow, changeChannelNameWindow, channelBannedListWindow
local channelList = {}
local lastTimeInteraction = 0
local ExtendedOpcodes = {
	Error = 114,
	WatchChannel = 113,
	ChannelList = 112
}
local protocolGame

function init()
	g_ui.importStyle("ui/tvstyles")

	streamingWindow = g_ui.loadUI("ui/channelcontrol_streaming", modules.game_interface.getRightPanel())

	streamingWindow:setup()
	streamingWindow:hide()

	watchingWindow = g_ui.loadUI("ui/channelcontrol_watching", modules.game_interface.getRightPanel())

	watchingWindow:setup()
	watchingWindow:hide()

	tvCamWindow = g_ui.loadUI("ui/tvcam", rootWidget)

	tvCamWindow:hide()

	tvChannelsWindow = g_ui.loadUI("ui/tvchannels", rootWidget)

	tvChannelsWindow:hide()

	changeChannelPasswordWindow = g_ui.loadUI("ui/changechannelpassword", rootWidget)

	changeChannelPasswordWindow:hide()

	changeChannelNameWindow = g_ui.loadUI("ui/changechannelname", rootWidget)

	changeChannelNameWindow:hide()

	channelBannedListWindow = g_ui.loadUI("ui/channelbannedlist", rootWidget)

	channelBannedListWindow:hide()
	ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.ChannelList, parseTVChannelList)
	ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.Error, parseTVError)
	connect(g_game, {
		onEditText = onGameEditText,
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end

function terminate()
	if streamingWindow then
		streamingWindow:destroy()
	end

	if watchingWindow then
		watchingWindow:destroy()
	end

	if tvCamWindow then
		tvCamWindow:destroy()
	end

	if tvChannelsWindow then
		tvChannelsWindow:destroy()
	end

	if changeChannelPasswordWindow then
		changeChannelPasswordWindow:destroy()
	end

	if changeChannelNameWindow then
		changeChannelNameWindow:destroy()
	end

	if channelBannedListWindow then
		channelBannedListWindow:destroy()
	end

	ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.ChannelList)
	ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.Error, parseTVError)
	disconnect(g_game, {
		onEditText = onGameEditText,
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end

function lockWalk()
	local localPlayer = g_game.getLocalPlayer()

	if localPlayer then
		localPlayer:stopAutoWalk()
		localPlayer:lockAutoWalk()
	end

	modules.game_walking.unbindKeys()
end

function unlockWalk()
	local localPlayer = g_game.getLocalPlayer()

	if localPlayer then
		localPlayer:unlockAutoWalk()
	end

	modules.game_walking.unbindKeys()
	modules.game_walking.bindKeys()
end

function bindControlsChannel(active)
	if active then
		g_keyboard.bindKeyDown("Left", function()
			sendActionChannel("!tvprev")
		end)
		g_keyboard.bindKeyDown("Right", function()
			sendActionChannel("!tvnext")
		end)
	else
		g_keyboard.unbindKeyDown("Left")
		g_keyboard.unbindKeyDown("Right")
	end
end

function onGameStart()
	unlockWalk()

	isWatchingTV = false
	protocolGame = g_game.getProtocolGame()
end

function onGameEnd()
	tvCamWindow:hide()
	watchingWindow:hide()
	tvChannelsWindow:hide()
	changeChannelPasswordWindow:hide()
	changeChannelNameWindow:hide()
	channelBannedListWindow:hide()
	unlockWalk()

	isWatchingTV = false
	protocolGame = nil
end

function parseTVChannelList(protocolgame, opcode, buffer)
	local parsedBuffer = json.decode(buffer)

	if not parsedBuffer or not tvChannelsWindow then
		return
	end

	tvChannelsWindow.channelsPanel:destroyChildren()

	channelList = {}

	for index, channel in pairs(parsedBuffer) do
		table.insert(channelList, channel)
	end

	tvChannelsSearchOnTextChange(tvChannelsWindow.searchTextEdit, tvChannelsWindow.searchTextEdit:getText(), "")
	tvChannelsWindow:show()
	lockWalk()
end

function parseTVError(protocolgame, opcode, buffer)
	displayErrorBox("Error", buffer)
end

function tvChannelsSearchOnTextChange(widget, text, oldText)
	if #channelList == 0 then
		return
	end

	tvChannelsWindow.channelsPanel:destroyChildren()

	for index, channel in pairs(channelList) do
		if channel.name:lower():find(text:lower()) then
			local widget = g_ui.createWidget("TVChannelListLabel", tvChannelsWindow.channelsPanel)

			widget.channelLabel:setText(channel.name:match("[^/]+%s"))
			widget.viewLabel:setText(channel.name:match("%((%d+)%)"))

			widget.channelId = channel.id
		end
	end
end

function tvChannelsWatchOnClick(widget)
	local selected = tvChannelsWindow.channelsPanel:getFocusedChild()

	unlockWalk()

	if not selected or not protocolGame then
		return
	end

	protocolGame:sendExtendedOpcode(ExtendedOpcodes.WatchChannel, selected.channelId)
	tvChannelsWindow:hide()
end

function isPlayerWatchingTV()
	return isWatchingTV
end

function onGameEditText(id, itemId, maxLength, text, writer, time)
	local TvsList = {
		11397,
		23057,
		23370,
		26699,
		26700,
		17202,
		17203,
		17204,
		17205,
		17206,
		17207,
		17208,
		17209,
		17210,
		17211,
		17212,
		17213,
		17214,
		17215,
		17216,
		17217,
		17218
	}

	if not table.contains(TvsList, itemId) then
		return
	end

	local textWindow = g_ui.displayUI("ui/onopemcamwindow", modules.game_interface.getRightPanel())
	local writeable = maxLength > #text and maxLength > 0
	local textEdit = textWindow:recursiveGetChildById("channelNameTextEdit")

	textEdit:setMaxLength(maxLength)
	textEdit:setText(text)
	textEdit:setEditable(writeable)
	textEdit:setCursorVisible(writeable)

	local okButton = textWindow:recursiveGetChildById("okButton")
	local cancelButton = textWindow:recursiveGetChildById("cancelButton")

	local function destroy()
		textWindow:destroy()
	end

	local function doneFunc()
		if writeable then
			g_game.editText(id, textEdit:getText())
		end

		destroy()
	end

	okButton.onClick = doneFunc
	cancelButton.onClick = destroy

	if not writeable then
		textWindow.onEnter = doneFunc
	end

	textWindow.onEscape = destroy
end

function sendActionChannel(action)
	local timeNow = os.time()

	if timeNow < lastTimeInteraction then
		modules.game_textmessage.displayFailureMessage(tr("Aguarde uns instante para realizar esta a\xE7\xE3o..."))
	else
		lastTimeInteraction = timeNow + 0.8

		g_game.talkChannel(MessageModes.None, 0, action)
	end
end

function setWatchingTv(mode)
	isWatchingTV = mode
end
