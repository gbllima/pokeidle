AnalyzerPanel = {}

local utils = runinsandbox("utils")

function AnalyzerPanel:new(contentsPanel)
	local obj = {
		hunt = HuntAnalyzer:new(),
		lootPanel = contentsPanel.analyzer.loot,
		supplyPanel = contentsPanel.analyzer.supply,
		killPanel = contentsPanel.analyzer.kill,
		huntPanel = contentsPanel.analyzer.hunt,

		-- caches para evitar flicker
		lastSessionTime = nil,
		lastHourValues = {}
	}
	local instance = setmetatable(obj, {
		__index = self
	})

	instance:setupPanel()

	return instance
end

function AnalyzerPanel:setupPanel()
	self:updateExperience()
	self:setupSupplyPanel()
	self:setupLootPanel()
	self:setupKillPanel()
	self:onSession()
end

function AnalyzerPanel:setupLootPanel()
	self:updateBalanceLoot()
	self.lootPanel.list:destroyChildren()

	for name, loot in pairs(self.hunt:getLoots()) do
		self:addLootPanel(loot.itemId, name, loot.price)
	end
end

function AnalyzerPanel:setupSupplyPanel()
	self:updateBalanceSupply()
	self.supplyPanel.list:destroyChildren()

	for name, supply in pairs(self.hunt:getSupplys()) do
		self:addSupplyPanel(supply.itemId, name, supply.price)
	end
end

function AnalyzerPanel:setupKillPanel()
	self:updateKills()
	self.killPanel.list:destroyChildren()

	for name, monster in pairs(self.hunt:getMonsters()) do
		self:addKillPanel(name, monster.outfit)
	end
end

function AnalyzerPanel:updateSession()
	local newValue = utils.formatTime(self.hunt:getSession())
	if self.lastSessionTime ~= newValue then
		self.huntPanel.session:setValue(newValue)
		self.lastSessionTime = newValue
	end
end

function AnalyzerPanel:updateHour()
	local hourData = self.hunt:getHourData()

	local labels = {
		self.huntPanel.hour,
		self.lootPanel.hour,
		self.supplyPanel.hour,
		self.killPanel.hour
	}

	for i, label in ipairs(labels) do
		local value
		if i == 2 or i == 3 then
			value = formatMoney(hourData[i].value)
		else
			value = comma_value(hourData[i].value)
		end

		if self.lastHourValues[i] ~= value then
			label:setValue(value)
			self.lastHourValues[i] = value
		end
	end
end

function AnalyzerPanel:updateBalance(lootBalance, supplyBalance)
	local balance = lootBalance - supplyBalance

	self.huntPanel.balance:setState(balance)
	self.huntPanel.balance:setValue(formatMoney(math.abs(balance)))
end

function AnalyzerPanel:updateBalanceLoot()
	local balance = self.hunt:getLootBalance()

	for i, label in pairs({
		self.huntPanel.loot,
		self.lootPanel.balance
	}) do
		label:setValue(formatMoney(balance))
	end

	self:updateBalance(balance, self.hunt:getSupplyBalance())
end

function AnalyzerPanel:updateBalanceSupply()
	local balance = self.hunt:getSupplyBalance()

	for i, label in pairs({
		self.huntPanel.supply,
		self.supplyPanel.balance
	}) do
		label:setValue(formatMoney(balance))
	end

	self:updateBalance(self.hunt:getLootBalance(), balance)
end

function AnalyzerPanel:updateKills()
	self.killPanel.kills:setValue(self.hunt:getTotalKills())
end

function AnalyzerPanel:updateExperience()
	self.huntPanel.xpGain:setValue(comma_value(self.hunt:getExperience()))
end

function AnalyzerPanel:addLootPanel(itemId, name, price)
	local loot = self.lootPanel.list[name]

	if not loot then
		loot = g_ui.createWidget("AnalyzerLootItem", self.lootPanel.list)
		loot:setId(name)
	end

	local count = self.hunt:getLootCount(name)

	loot:setItemId(itemId)
	loot:setValue(utils.formatNumber(count))
	loot:setTooltip(tr("%dx %s (Value: %s, Sum: %s)", count, name, formatMoney(price), formatMoney(count * price)))
end

function AnalyzerPanel:addSupplyPanel(itemId, name, price)
	local supply = self.supplyPanel.list[name]

	if not supply then
		supply = g_ui.createWidget("AnalyzerLootItem", self.supplyPanel.list)
		supply:setId(name)
	end

	local count = self.hunt:getSupplyCount(name)

	supply:setItemId(itemId)
	supply:setValue(utils.formatNumber(count))
	supply:setTooltip(tr("%dx %s (Value: %s, Sum: %s)", count, name, formatMoney(price), formatMoney(count * price)))
end

function AnalyzerPanel:addKillPanel(name, outfit)
	local monster = self.killPanel.list[name]

	if not monster then
		monster = g_ui.createWidget("AnalyzerKill", self.killPanel.list)
		monster:setId(name)
	end

	local count = self.hunt:getMonsterCount(name)

	monster:setTooltip(name)
	monster:setOutfit(outfit)
	monster:setValue(utils.formatNumber(count))
	monster:setTooltip(tr("%dx %s", count, name))
end

function AnalyzerPanel:doClear()
	self.hunt:doClear()
	self.lastSessionTime = nil
	self.lastHourValues = {}
	self:setupPanel()
end

function AnalyzerPanel:onUpdateLoot(item, name, price)
	self.hunt:doAddUpdateLoot(item, name, price)
	self:addLootPanel(item:getId(), name, price)
	self:updateBalanceLoot()
end

function AnalyzerPanel:onUpdateSupply(item, name, price)
	self.hunt:doAddUpdateSupply(item, name, price)
	self:addSupplyPanel(item:getId(), name, price)
	self:updateBalanceSupply()
end

function AnalyzerPanel:onUpdateKill(name, outfit)
	self.hunt:doAddUpdateMonster(name, outfit)
	self:addKillPanel(name, outfit)
	self:updateKills()
end

function AnalyzerPanel:onUpdateExperience(player, experience, oldExperience)
	self.hunt:doAddUpdateExperience(player, experience, oldExperience)
	self:updateExperience()
end

function AnalyzerPanel:onSession()
	self:updateHour()
	self:updateSession()
	self.hunt:doRemoveEventId()

	self.hunt.eventId = scheduleEvent(function()
		self:onSession()
	end, 1000)
end

function AnalyzerPanel:doStopSession()
	self.hunt:doRemoveEventId()
end

function AnalyzerPanel:doClipboard()
	local clipboard = {
		("Session data: From %s to %s"):format(os.date("%Y-%m-%d, %H:%M:%S", self.hunt:getStartedSession()), os.date("%Y-%m-%d, %H:%M:%S")),
		("Session: %s"):format(formatTime(self.hunt:getSession())),
		("XP Gain: %s"):format(self.hunt:getExperience()),
		("Loot: %s"):format(formatMoney(self.hunt:getLootBalance())),
		("Supplies: %s"):format(formatMoney(self.hunt:getSupplyBalance())),
		("Balance: %s"):format(formatMoney(math.abs(self.hunt:getBalance())))
	}
	local hours, hourData = {}, self.hunt:getHourData()

	for i, name in pairs({
		"XP/h",
		"Loot/h",
		"Supplies/h",
		"Defeats/h"
	}) do
		hours[#hours + 1] = ("%s: %s"):format(name, (i == 2 or i == 3) and formatMoney(hourData[i].value) or comma_value(hourData[i].value))
	end

	local killedPokemons = {
		"Defeats Pokemon:"
	}

	for name, monster in pairs(self.hunt:getMonsters()) do
		killedPokemons[#killedPokemons + 1] = ("  %dx %s"):format(monster.count, name)
	end

	local lootedItems = {
		"Looted Items:"
	}

	for name, loot in pairs(self.hunt:getLoots()) do
		lootedItems[#lootedItems + 1] = ("  %dx %s"):format(loot.count, name)
	end

	local supplysItems = {
		"Supplys Used:"
	}

	for name, supply in pairs(self.hunt:getSupplys()) do
		supplysItems[#supplysItems + 1] = ("  %dx %s"):format(supply.count, name)
	end

	clipboard[#clipboard + 1] = table.concat(hours, "\n")
	clipboard[#clipboard + 1] = table.concat(killedPokemons, "\n")
	clipboard[#clipboard + 1] = table.concat(lootedItems, "\n")
	clipboard[#clipboard + 1] = table.concat(supplysItems, "\n")

	g_window.setClipboardText(table.concat(clipboard, "\n"))
end
