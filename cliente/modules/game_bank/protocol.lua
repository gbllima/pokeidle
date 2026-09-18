-- chunkname: @/modules/game_bank/protocol.lua

local PokemonPokeBankOpcode = 98
local Actions = {
	DepositAll = 5,
	Message = 2,
	Deposit = 4,
	Withdraw = 3,
	Balance = 1,
	WithdrawAll = 6
}
local protocolGame
local lastTimeInteraction = 0

local function onGameStart()
	protocolGame = g_game.getProtocolGame()
end

local function onGameEnd()
	protocolGame = nil
end

local function sendAction(action, data)
	local timeNow = os.time()

	if timeNow < lastTimeInteraction then
		signalcall(PokeBank.onMessage, "Aguarde uns instante para realizar esta a\xE7\xE3o...")
	else
		lastTimeInteraction = timeNow + 2.3

		protocolGame:sendExtendedJSONOpcode(PokemonPokeBankOpcode, {
			action = action,
			data = {
				count = data
			}
		})
	end
end

function sendWithdraw(count)
	sendAction(Actions.Withdraw, count)
end

function sendDeposit(count)
	sendAction(Actions.Deposit, count)
end

function sendWithdrawAll()
	sendAction(Actions.WithdrawAll, 1)
end

function sendDepositAll()
	sendAction(Actions.DepositAll, 1)
end

local function parseBalance(params)
	signalcall(PokeBank.onBalance, params.player, params.balance)
end

local function parseMessage(message)
	signalcall(PokeBank.onMessage, message)
end

local ActionParser = {
	[Actions.Balance] = parseBalance,
	[Actions.Message] = parseMessage
}

local function parseAction(protocol, opcode, jsonData)
	local parser = ActionParser[jsonData.action]

	if parser then
		parser(jsonData.data)
	end
end

function initProtocol()
	ProtocolGame.registerExtendedJSONOpcode(PokemonPokeBankOpcode, parseAction)
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_game.isOnline() then
		onGameStart()
	end
end

function terminateProtocol()
	ProtocolGame.unregisterExtendedJSONOpcode(PokemonPokeBankOpcode)
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
end
