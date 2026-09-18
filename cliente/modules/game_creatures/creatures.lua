-- chunkname: @/modules/game_creatures/creatures.lua

local function onAppear(creature)
	if creature:isSummon() then
		local player = g_game.getLocalPlayer()

		if player then
			player:setPokemon(creature)
		end
	end
end

local function onDisappear(creature)
	if creature:isSummon() then
		local player = g_game.getLocalPlayer()

		if player then
			player:setPokemon(nil)
		end
	end
end

function init()
	connect(Creature, {
		onAppear = onAppear,
		onDisappear = onDisappear
	})
end

function terminate()
	disconnect(Creature, {
		onAppear = onAppear,
		onDisappear = onDisappear
	})
end
