-- chunkname: @/modules/game_analytics/analyzer.lua

HuntAnalyzer = {}

function HuntAnalyzer:new()
	local analyzer = {
		xpGain = 0,
		session = os.time(),
		lastUpdate = os.time(),
		loots = {},
		supplys = {},
		monsters = {},
		hours = {
			{
				value = 0,
				historic = {}
			},
			{
				value = 0,
				historic = {}
			},
			{
				value = 0,
				historic = {}
			},
			{
				value = 0,
				historic = {}
			}
		}
	}

	return setmetatable(analyzer, {
		__index = self
	})
end

function HuntAnalyzer:getStartedSession()
	return self.session
end

function HuntAnalyzer:getSession()
	return os.time() - self.session
end

function HuntAnalyzer:getBalance()
	return self:getLootBalance() - self:getSupplyBalance()
end

function HuntAnalyzer:getLoots()
	return self.loots
end

function HuntAnalyzer:getSupplys()
	return self.supplys
end

function HuntAnalyzer:getMonsters()
	return self.monsters
end

function HuntAnalyzer:getExperience()
	return self.xpGain
end

function HuntAnalyzer:getHourData()
	local currentTime = os.time()

	if currentTime - self.lastUpdate >= 30 then
		for i, currentValue in ipairs({
			self:getExperience(),
			self:getLootBalance(),
			self:getSupplyBalance(),
			self:getTotalKills()
		}) do
			if #self.hours[i].historic > 0 then
				self.hours[i].value = math.floor((currentValue - self.hours[i].historic[1][1]) / (currentTime - self.hours[i].historic[1][2]) * 3600)
			end

			table.insert(self.hours[i].historic, {
				currentValue,
				currentTime
			})

			if #self.hours[i].historic > 30 then
				table.remove(self.hours[i].historic, 1)
			end
		end

		self.lastUpdate = currentTime
	end

	return self.hours
end

function HuntAnalyzer:getLootCount(name)
	local loot = self.loots[name]

	if loot then
		return loot.count
	end

	return 0
end

function HuntAnalyzer:getSupplyCount(name)
	local supply = self.supplys[name]

	if supply then
		return supply.count
	end

	return 0
end

function HuntAnalyzer:getMonsterCount(name)
	local monster = self.monsters[name]

	if monster then
		return monster.count
	end

	return 0
end

function HuntAnalyzer:getLootBalance()
	local balance = 0

	for name, item in pairs(self.loots) do
		balance = balance + item.count * item.price
	end

	return balance
end

function HuntAnalyzer:getSupplyBalance()
	local balance = 0

	for name, item in pairs(self.supplys) do
		balance = balance + item.count * item.price
	end

	return balance
end

function HuntAnalyzer:getTotalKills()
	local count = 0

	for name, monster in pairs(self.monsters) do
		count = count + monster.count
	end

	return count
end

function HuntAnalyzer:doAddUpdateLoot(item, name, price)
	local data = self.loots[name]

	if not data then
		data = {
			count = 0,
			itemId = item:getId(),
			price = price
		}
		self.loots[name] = data
	end

	data.count = data.count + item:getCount()
end

function HuntAnalyzer:doAddUpdateSupply(item, name, price)
	local data = self.supplys[name]

	if not data then
		data = {
			count = 0,
			itemId = item:getId(),
			price = price
		}
		self.supplys[name] = data
	end

	data.count = data.count + item:getCount()
end

function HuntAnalyzer:doAddUpdateMonster(name, outfit)
	local data = self.monsters[name]

	if not data then
		data = {
			count = 0,
			outfit = outfit
		}
		self.monsters[name] = data
	end

	data.count = data.count + 1
end

function HuntAnalyzer:doAddUpdateExperience(player, experience, oldExperience)
	if oldExperience > 0 then
		self.xpGain = self.xpGain + (experience - oldExperience)
	end
end

function HuntAnalyzer:doRemoveEventId()
	removeEvent(self.eventId)
end

function HuntAnalyzer:doClear()
	self:doRemoveEventId()

	self.session = os.time()
	self.lastUpdate = os.time()
	self.xpGain = 0
	self.loots = {}
	self.supplys = {}
	self.monsters = {}
	self.eventId = nil
	self.hours = {
		{
			value = 0,
			historic = {}
		},
		{
			value = 0,
			historic = {}
		},
		{
			value = 0,
			historic = {}
		},
		{
			value = 0,
			historic = {}
		}
	}
end
