-- chunkname: @/modules/game_bank/bank.lua

PokeBank = {}

local window
local actionsWindow = {}
local protocol = runinsandbox("protocol")
local balance = {
	bank = 0,
	inventory = 0
}

local function onInventoryBalance(count)
	local hasAmount = count > 0
	local fmtAmount = hasAmount and formatMoney(count) or 0

	balance.inventory = count

	window.inventory.balance:setText(fmtAmount)
	window.inventory.action1:setEnabled(hasAmount)
	window.inventory.action2:setEnabled(hasAmount)

	window.inventory.action1.onClick = showDeposit
	window.inventory.action2.onClick = protocol.sendDepositAll
end

local function onBankBalance(count)
	local hasAmount = count > 0
	local fmtAmount = hasAmount and formatMoney(count) or 0
	local inventory = modules.game_inventory.getInventoryWindow().balance
	local fmtInventory = hasAmount and fmtAmount or tr("Pokebank")

	balance.bank = count

	inventory:setOn(hasAmount)
	inventory:setText(fmtInventory)
	window.bank.balance:setText(fmtAmount)
	window.bank.action1:setEnabled(hasAmount)
	window.bank.action2:setEnabled(hasAmount)

	window.bank.action1.onClick = showWithdraw
	window.bank.action2.onClick = protocol.sendWithdrawAll
end

local function onBalance(player, balance)
	if player then
		onInventoryBalance(player)
	end

	if balance then
		onBankBalance(balance)
	end
end

local function onMessage(message)
	window.message:setText(message)
	removeEvent(window.message.event)

	window.message.event = scheduleEvent(function()
		window.message:clearText()
	end, 2800)
end

function init()
	protocol.initProtocol()
	connect(g_game, {
		onGameEnd = onOffline
	})
	connect(PokeBank, {
		onBalance = onBalance,
		onMessage = onMessage
	})

	window = g_ui.displayUI("bank")
end

function terminate()
	protocol.terminateProtocol()
	disconnect(g_game, {
		onGameEnd = onOffline
	})
	disconnect(PokeBank, {
		onBalance = onBalance,
		onMessage = onMessage
	})
	onOffline()
	window:destroy()

	window = nil
end

function onOffline()
	window:hide()

	for title, widget in pairs(actionsWindow) do
		hideActionWindow(title)
	end
end

function hideActionWindow(title)
	if actionsWindow[title] then
		actionsWindow[title]:destroy()

		actionsWindow[title] = nil
	end
end

function showActionWindow(title, amount, callback)
	if actionsWindow[title] then
		return
	end

	local actionWindow = g_ui.createWidget(title .. "BankWindow", rootWidget)

	actionWindow:onVisibilityChange(true)

	local balanceLabel = actionWindow.balanceLabel
	local amountEdit = actionWindow.amountEdit
	local cancelButton = actionWindow.cancelButton
	local confirmButton = actionWindow.confirmButton

	balanceLabel:setText(tr("You balance: %s", formatMoney(amount)))
	actionWindow:setText(tr(title))

	function amountEdit:onTextChange(text)
		local number = tonumber(text) or 0

		if number > 999999999 then
			self:setText(999999999)

			return
		end

		local hasAmount = number > 0

		self.value = number * 100

		confirmButton:setEnabled(hasAmount and amount >= self.value)
		self:setHelperText("white", hasAmount and formatMoney(self.value) or 0)
	end

	function cancelButton:onClick()
		hideActionWindow(title)
	end

	function confirmButton:onClick()
		callback(amountEdit.value)
		cancelButton.onClick()
	end

	actionsWindow[title] = actionWindow
end

function showDeposit()
	showActionWindow("Deposit", balance.inventory, protocol.sendDeposit)
end

function showWithdraw()
	showActionWindow("Withdraw", balance.bank, protocol.sendWithdraw)
end

function showBank()
	window:show()
	window:raise()
end
