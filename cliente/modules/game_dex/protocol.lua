-- chunkname: @/modules/game_dex/protocol.lua

local PokemonPokedexOpcode = 80
local Actions = {
  Data   = 1,
  View   = 2,
  Open   = 3,
  Update = 4,
  Loot   = 5
}

local protocolGame

local function onGameStart()
  protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
  protocolGame = nil
end

local function sendAction(action, data)
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(PokemonPokedexOpcode, {
      action = action,
      data = data
    })
  end
end

local function parseData(params)
  signalcall(PokeDex.onData, params.UnlockedPokemons, params.CaughtPokemons)
end

local function parseView(params)
  signalcall(PokeDex.onView, params.pokemonName, params.title, params.catch)
end

local function parseOpen(params)
  signalcall(PokeDex.onOpen, params.Pokepedia)
end

local function parseUpdate(params)
  signalcall(PokeDex.onUpdate, params, true)
end

local function parseLoot(params)
  signalcall(PokeDex.onLoot, params.pokemonName, params.loots)
end

local ActionParser = {
  [Actions.Data]   = parseData,
  [Actions.View]   = parseView,
  [Actions.Open]   = parseOpen,
  [Actions.Update] = parseUpdate,
  [Actions.Loot]   = parseLoot
}

local function parseAction(protocol, opcode, jsonData)
  local parser = ActionParser[jsonData.action]
  if parser then
    parser(jsonData.data)
  end
end

function initProtocol()
  ProtocolGame.registerExtendedJSONOpcode(PokemonPokedexOpcode, parseAction)
  connect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })
  if g_game.isOnline() then
    onGameStart()
  end
end

function terminateProtocol()
  ProtocolGame.unregisterExtendedJSONOpcode(PokemonPokedexOpcode)
  disconnect(g_game, {
    onGameStart = onGameStart,
    onGameEnd = onGameEnd
  })
end

function sendOpen()
  sendAction(Actions.Open, {})
end

function sendViewPokemon(pokemonName, title)
  sendAction(Actions.View, { pokemonName = pokemonName, title = title })
end

function sendRequestData()
  sendAction(Actions.Data, {})
end

function sendUpdate(payload)
  sendAction(Actions.Update, payload)
end

function sendViewPokemonLoot(pokemonName)
  sendAction(Actions.Loot, pokemonName)
end
