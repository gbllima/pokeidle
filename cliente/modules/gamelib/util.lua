-- chunkname: @/modules/gamelib/util.lua

function postostring(pos)
	return pos.x .. " " .. pos.y .. " " .. pos.z
end

function dirtostring(dir)
	for k, v in pairs(Directions) do
		if v == dir then
			return k
		end
	end
end

function getHealthColor(health)
	return health < 9 and "#AB2F2FFA" or health < 31 and "#DF6E56" or health < 61 and "#D7CB60EB" or "#23B266"
end

function isShinyName(pokemonName)
	return string.find(pokemonName, "shiny") ~= nil
end

function getPokemonName(pokemonName)
	return isShinyName(pokemonName) and pokemonName:match("shiny (.*)") or pokemonName
end

function getPokemonImage(pokemonName)
	local name = pokemonName and pokemonName:lower() or "none"

	return IMAGE_PATHS.POKEMON .. (g_resources.fileExists(IMAGE_PATHS.POKEMON .. name .. ".png") and name or getPokemonName(name):lower())
end

function getPokemonPortrait(pokemonName)
	local name = pokemonName and pokemonName:lower() or "none"

	if g_resources.fileExists(IMAGE_PATHS.PORTRAIT .. name .. ".png") then
		return IMAGE_PATHS.PORTRAIT .. name
	end

	return getPokemonImage(pokemonName)
end
