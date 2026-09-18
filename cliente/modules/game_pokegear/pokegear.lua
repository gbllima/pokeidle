-- chunkname: @/modules/game_pokegear/pokegear.lua

PokeGear = {}

local window, message
local protocol = runinsandbox("protocol")
local currentId = 1

local function hide()
	currentId = 1

	window:hide()

	if message then
		message:destroy()

		message = nil
	end
end

local function onOpen(params)
	window.panel:destroyChildren()

	for i, v in ipairs(params.teams) do
		local panel = g_ui.createWidget("PokeGearTeam", window.panel)
		local locked = v.count == -1
		local isFinished = v.diary == params.maxDefeats
		local isDone = v.diary > params.maxDefeats

		panel:setId(i)
		panel.image:setImageSource(getPokemonPortrait(v.name))
		panel.image:setOn(locked)
		panel.name:setText(v.name)
		panel.locked:setVisible(locked)
		panel.count:setText(tr("%s: %d", tr("Defeats"), math.max(0, v.count)))
		panel.icon:setOn(isDone)
		panel.reward:setOn(isDone)
		panel.reward:setChecked(isFinished)
		panel.reward:setEnabled(not locked and isFinished)

		function panel.reward.onClick()
			if params.dailyDones >= params.maxDaily then
				message = displayErrorBox(window:getText(), "Voc\xEA excedeu o limite di\xE1rio, tente novamente amanh\xE3!")
			else
				protocol.sendClaim(v.npcName)

				currentId = i
			end
		end

		if not isDone and not isFinished then
			panel.reward:setText(tr("%d/%d", v.diary, params.maxDefeats))
		end
	end

	window.dailyPanel.count:setText(tr("Daily limit: %d/%d", params.dailyDones, params.maxDaily))
	window.panel:focusChild(window.panel[currentId])
	window:show()
	window:raise()
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	connect(PokeGear, {
		onOpen = onOpen
	})

	window = g_ui.displayUI("pokegear.otui")
end

function terminate()
	protocol.terminateProtocol()
	connect(g_game, {
		onGameEnd = onGameEnd
	})
	disconnect(PokeGear, {
		onOpen = onOpen
	})
	window:destroy()

	window = nil
end

function onGameEnd()
	hide()
end
