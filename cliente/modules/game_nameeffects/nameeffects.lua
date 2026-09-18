local nameEffectsWindow, nameEffectsPanel, nameEffectsRadioGroup

local ExtendedOpcodes = {
	SetPlayerNameEffect = 57,
	ParsePlayerNameEffects = 56,
	RequestPlayerNameEffects = 56
}

function init()

	nameEffectsWindow = g_ui.displayUI("nameeffects")
	nameEffectsWindow:hide()

	nameEffectsPanel = nameEffectsWindow.nameEffectsPanel

	ProtocolGame.registerExtendedOpcode(ExtendedOpcodes.ParsePlayerNameEffects, parsePlayerNameEffects)

	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	connect(Creature, {
		onNameEffectChange = onNameEffectChange
	})
end

function terminate()
	if nameEffectsWindow then
		nameEffectsWindow:destroy()
	end

	ProtocolGame.unregisterExtendedOpcode(ExtendedOpcodes.ParsePlayerNameEffects)

	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	disconnect(Creature, {
		onNameEffectChange = onNameEffectChange
	})
end

function onGameEnd()
	nameEffectsWindow:hide()
end

function onNameEffectChange(creature, nameEffect)
	local config = NameEffectsConfig[nameEffect]
	if config then
	  creature:setNameEffectTexture(config.Texture)
	else
	  creature:setNameEffectTexture("")
	end
  end
  

function requestNameEffects()
	local proto = g_game.getProtocolGame()
	if not proto then
		return
	end

	proto:sendExtendedOpcode(ExtendedOpcodes.RequestPlayerNameEffects, "")
end

function setSelectedNameEffect()
	local selected = nameEffectsRadioGroup and nameEffectsRadioGroup:getSelectedWidget()
	if not selected then
	  return
	end
  
	local proto = g_game.getProtocolGame()
	if not proto then
	  return
	end
  
	proto:sendExtendedOpcode(ExtendedOpcodes.SetPlayerNameEffect, selected.ID)
	nameEffectsWindow:hide()
  end
  

function parsePlayerNameEffects(protocol, msg, buffer)

	local status, nameEffects = pcall(function()
		return json.decode(buffer)
	end)

	if not status or not nameEffects then
		return
	end

	if nameEffectsRadioGroup then
		nameEffectsRadioGroup:destroy()
	end

	nameEffectsRadioGroup = UIRadioGroup.create()
	nameEffectsPanel:destroyChildren()

	local withoutWidget = g_ui.createWidget("NameEffectWidget", nameEffectsPanel)
	withoutWidget.nameEffectLabel:setText("Without Name Effect")
	withoutWidget.ID = 0

	nameEffectsRadioGroup:addWidget(withoutWidget)
	nameEffectsRadioGroup:selectWidget(withoutWidget)

	for _, nameEffectId in pairs(nameEffects.NameEffects) do
		local info = NameEffectsConfig[nameEffectId]
		if info then
			local nameEffectWidget = g_ui.createWidget("NameEffectWidget", nameEffectsPanel)
			nameEffectWidget.nameEffectLabel:setText(info.Name)
			nameEffectWidget.nameEffectWidget:setImageSource(info.Texture)
			nameEffectWidget.ID = nameEffectId

			nameEffectsRadioGroup:addWidget(nameEffectWidget)

			if nameEffects.Enabled == nameEffectId then
				nameEffectsRadioGroup:selectWidget(nameEffectWidget)
			end
		end
	end

	nameEffectsWindow:show()
end
