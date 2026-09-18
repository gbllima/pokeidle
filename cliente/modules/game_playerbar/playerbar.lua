-- chunkname: @/modules/game_playerbar/playerbar.lua

playerBarWindow = nil
healthTooltip = "Your character health is %d out of %d."
manaTooltip = "Your character mana is %d out of %d."
experienceTooltip = "You have %d%% to advance to level %d."
imageClipPokeball = {
	[0] = 0,
	14,
	28,
	42,
	56,
	70,
	84
}

local imageBarPath = "/images/game/playerbar/"
local imageBar = {
	"bar_valor",
	"bar_mystic",
	[-1] = "default",
	[3] = "bar_instinct"
}
local profileBar = {
	[0] = {
		image = "girl_player_bar",
		size = {
			height = 141,
			width = 94
		}
	},
	{
		image = "boy_player_bar",
		size = {
			height = 112,
			width = 107
		}
	}
}

function init()
	connect(g_game, {
		onGameEnd = offline,
		onGameStart = refresh
	})
	connect(LocalPlayer, {
		onHealthChange = onHealthChange,
		onLevelChange = onLevelChange,
		onFreeCapacityChange = onFreeCapacityChange,
		onExtraSkillChange = onExtraSkillChange
	})

	playerBarWindow = g_ui.displayUI("playerbar.otui")

	refresh()
end

function terminate()
	disconnect(g_game, {
		onGameEnd = offline,
		onGameStart = refresh
	})
	disconnect(LocalPlayer, {
		onHealthChange = onHealthChange,
		onLevelChange = onLevelChange,
		onFreeCapacityChange = onFreeCapacityChange
	})
	playerBarWindow:destroy()

	playerBarWindow = nil
end

function toggle()
	playerBarWindow:setVisible(not playerBarWindow:isVisible())
end

function refresh()
	if not g_game.isOnline() then
		return
	end

	local settings = g_settings.getNode("playerBar")
	local visible = true

	if settings then
		playerBarWindow:setPosition(topoint(settings.position))
	end

	playerBarWindow:setVisible(visible)

	local player = g_game.getLocalPlayer()

	onFreeCapacityChange(player, player:getFreeCapacity())
	onHealthChange(player, player:getHealth(), player:getMaxHealth())
	onLevelChange(player, player:getLevel(), player:getLevelPercent())
end

function offline()
	local settings = {
		position = pointtostring(playerBarWindow:getPosition()),
		visible = playerBarWindow:isVisible()
	}

	g_settings.setNode("playerBar", settings)
	playerBarWindow:hide()
end

function onMiniWindowClose()
	return
end

function onHealthChange(localPlayer, health, maxHealth)
	if maxHealth < health then
		maxHealth = health
	end

	playerBarWindow.healthBar:setValue(health, 0, maxHealth)
	playerBarWindow.healthBar:setTooltip(tr(healthTooltip, health, maxHealth))
	playerBarWindow.healthBar:setText(math.floor(health / maxHealth * 100) .. "%")
end

function onLevelChange(localPlayer, value, percent)
	playerBarWindow.lvlLabel:setText(tr("Nv. %d", value))
	playerBarWindow.expBar:setPercent(percent)
	playerBarWindow.expBar:setText(percent .. "%")
	playerBarWindow.expBar:setTooltip(tr(experienceTooltip, percent, value + 1))
end

function onFreeCapacityChange(player, freeCapacity)
	local pokeball = 6 - (freeCapacity ~= -1 and freeCapacity or 6)

	playerBarWindow.pokeballs:setImageClip("0 " .. (imageClipPokeball[pokeball] or 0) .. " 82 12")
end

function onExtraSkillChange(player, id, value)
	if id == Skill.Clan then
		playerBarWindow:setImageSource(imageBarPath .. (imageBar[value] or "default"))
	elseif id == Skill.Profile then
		local profile = profileBar[value]

		if profile then
			playerBarWindow.profile:setImageSource(imageBarPath .. profile.image)
		end
	end
end
