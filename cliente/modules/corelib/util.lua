-- chunkname: @/modules/corelib/util.lua

function print(...)
	local msg = ""
	local args = {
		...
	}
	local appendSpace = #args > 1

	for i, v in ipairs(args) do
		msg = msg .. tostring(v)

		if appendSpace and i < #args then
			msg = msg .. "    "
		end
	end

	g_logger.log(LogInfo, msg)
end

function pinfo(msg)
	g_logger.log(LogInfo, msg)
end

function perror(msg)
	g_logger.log(LogError, msg)
end

function pwarning(msg)
	g_logger.log(LogWarning, msg)
end

function pdebug(msg)
	g_logger.log(LogDebug, msg)
end

function fatal(msg)
	g_logger.log(LogFatal, msg)
end

function exit()
	g_app.exit()
end

function quit()
	g_app.exit()
end

function connect(object, signalOrTable, callbackOrPushFront, pushFront)
	local signalsAndSlots, _pushFront

	if type(signalOrTable) == "string" then
		signalsAndSlots = {
			[signalOrTable] = callbackOrPushFront
		}
		_pushFront = pushFront
	else
		signalsAndSlots = signalOrTable
		_pushFront = callbackOrPushFront
	end

	for signal, slot in pairs(signalsAndSlots) do
		if not object[signal] then
			local mt = getmetatable(object)

			if mt and type(object) == "userdata" then
				object[signal] = function(...)
					return signalcall(mt[signal], ...)
				end
			end
		end

		if not object[signal] then
			object[signal] = slot
		elseif type(object[signal]) == "function" then
			object[signal] = {
				object[signal]
			}
		end

		if type(slot) ~= "function" then
			perror(debug.traceback("unable to connect a non function value"))
		end

		if type(object[signal]) == "table" then
			if _pushFront then
				table.insert(object[signal], 1, slot)
			else
				table.insert(object[signal], #object[signal] + 1, slot)
			end
		end
	end
end

function disconnect(object, signalOrTable, callback)
	local signalsAndSlots

	if type(signalOrTable) == "string" then
		if callback == nil then
			object[signalOrTable] = nil

			return
		end

		signalsAndSlots = {
			[signalOrTable] = callback
		}
	elseif type(signalOrTable) == "table" then
		signalsAndSlots = signalOrTable
	else
		perror(debug.traceback("unable to disconnect"))
	end

	for signal, slot in pairs(signalsAndSlots) do
		if not object[signal] then
			-- block empty
		elseif type(object[signal]) == "function" then
			if object[signal] == slot then
				object[signal] = nil
			end
		elseif type(object[signal]) == "table" then
			for k, func in pairs(object[signal]) do
				if func == slot then
					table.remove(object[signal], k)

					if #object[signal] == 1 then
						object[signal] = object[signal][1]
					end

					break
				end
			end
		end
	end
end

function newclass(name)
	if not name then
		perror(debug.traceback("new class has no name."))
	end

	local class = {}

	function class.internalCreate()
		local instance = {}

		for k, v in pairs(class) do
			instance[k] = v
		end

		return instance
	end

	class.create = class.internalCreate
	class.__class = name

	function class.getClassName()
		return name
	end

	return class
end

function extends(base, name)
	if not name then
		perror(debug.traceback("extended class has no name."))
	end

	local derived = {}

	function derived.internalCreate()
		local instance = base.create()

		for k, v in pairs(derived) do
			instance[k] = v
		end

		return instance
	end

	derived.create = derived.internalCreate
	derived.__class = name

	function derived.getClassName()
		return name
	end

	return derived
end

function runinsandbox(func, ...)
	if type(func) == "string" then
		func, err = loadfile(resolvepath(func, 2))

		if not func then
			error(err)
		end
	end

	local env = {}
	local oldenv = getfenv(0)

	setmetatable(env, {
		__index = oldenv
	})
	setfenv(0, env)
	func(...)
	setfenv(0, oldenv)

	return env
end

function loadasmodule(name, file)
	file = file or resolvepath(name, 2)

	if package.loaded[name] then
		return package.loaded[name]
	end

	local env = runinsandbox(file)

	package.loaded[name] = env

	return env
end

local function module_loader(modname)
	local module = g_modules.getModule(modname)

	if not module then
		return "\n\tno module '" .. modname .. "'"
	end

	return function()
		if not module:load() then
			error("unable to load required module " .. modname)
		end

		return module:getSandbox()
	end
end

table.insert(package.loaders, 1, module_loader)

function import(table)
	assert(type(table) == "table")

	local env = getfenv(2)

	for k, v in pairs(table) do
		env[k] = v
	end
end

function export(what, key)
	if key ~= nil then
		_G[key] = what
	else
		for k, v in pairs(what) do
			_G[k] = v
		end
	end
end

function unexport(key)
	if type(key) == "table" then
		for _k, v in pairs(key) do
			_G[v] = nil
		end
	else
		_G[key] = nil
	end
end

function getfsrcpath(depth)
	depth = depth or 2

	local info = debug.getinfo(1 + depth, "Sn")
	local path

	if info.short_src then
		path = info.short_src:match("(.*)/.*")
	end

	if not path then
		path = "/"
	elseif path:sub(0, 1) ~= "/" then
		path = "/" .. path
	end

	return path
end

function resolvepath(filePath, depth)
	if not filePath then
		return nil
	end

	depth = depth or 1

	if filePath then
		if filePath:sub(0, 1) ~= "/" then
			local basepath = getfsrcpath(depth + 1)

			if basepath:sub(#basepath) ~= "/" then
				basepath = basepath .. "/"
			end

			return basepath .. filePath
		else
			return filePath
		end
	else
		local basepath = getfsrcpath(depth + 1)

		if basepath:sub(#basepath) ~= "/" then
			basepath = basepath .. "/"
		end

		return basepath
	end
end

function toboolean(v)
	if type(v) == "string" then
		v = v:trim():lower()

		if v == "1" or v == "true" then
			return true
		end
	elseif type(v) == "number" then
		if v == 1 then
			return true
		end
	elseif type(v) == "boolean" then
		return v
	end

	return false
end

function fromboolean(boolean)
	if boolean then
		return "true"
	else
		return "false"
	end
end

function booleantonumber(boolean)
	if boolean then
		return 1
	else
		return 0
	end
end

function numbertoboolean(number)
	if number ~= 0 then
		return true
	else
		return false
	end
end

function protectedcall(func, ...)
	local status, ret = pcall(func, ...)

	if status then
		return ret
	end

	perror(ret)

	return false
end

function signalcall(param, ...)
	if type(param) == "function" then
		local status, ret = pcall(param, ...)

		if status then
			return ret
		else
			perror(ret)
		end
	elseif type(param) == "table" then
		for k, v in pairs(param) do
			local status, ret = pcall(v, ...)

			if status then
				if ret then
					return true
				end
			else
				perror(ret)
			end
		end
	elseif param ~= nil then
		error("attempt to call a non function value")
	end

	return false
end

function tr(s, ...)
	return string.format(s, ...)
end

function getOppositeAnchor(anchor)
	if anchor == AnchorLeft then
		return AnchorRight
	elseif anchor == AnchorRight then
		return AnchorLeft
	elseif anchor == AnchorTop then
		return AnchorBottom
	elseif anchor == AnchorBottom then
		return AnchorTop
	elseif anchor == AnchorVerticalCenter then
		return AnchorHorizontalCenter
	elseif anchor == AnchorHorizontalCenter then
		return AnchorVerticalCenter
	end

	return anchor
end

function makesingleton(obj)
	local singleton = {}

	if obj.getClassName then
		for key, value in pairs(_G[obj:getClassName()]) do
			if type(value) == "function" then
				singleton[key] = function(...)
					return value(obj, ...)
				end
			end
		end
	end

	return singleton
end

function comma_value(amount)
	local formatted = amount

	repeat
		formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
	until k == 0

	return formatted
end

function getHighlightedText(text, color)
	local tmpData = {}
	local parts = text:split("{")
	local partIndex = 1

	if not text:starts("{") then
		table.insert(tmpData, parts[1])
		table.insert(tmpData, color)

		partIndex = 2
	end

	for i = partIndex, #parts do
		local subParts = parts[i]:split("}")
		local inner = subParts[1]

		if inner then
			local value = inner:split("|")

			table.insert(tmpData, value[2] or "")
			table.insert(tmpData, value[1] or color)
		end

		local after = subParts[2]

		if after and after ~= "" then
			table.insert(tmpData, after)
			table.insert(tmpData, color)
		end
	end

	return tmpData
end

function switch(indice)
	return function(codetable)
		local case = codetable[indice] or codetable.default

		if case then
			if type(case) == "function" then
				return case(indice)
			else
				error("action " .. tostring(indice) .. " not a function")
			end
		end
	end
end

function formatAmount(amount)
	if amount < 10000 then
		return amount
	end

	local str

	if amount >= 1000000 then
		str = string.format("%.1fkk", amount / 1000000)
	elseif amount >= 1000 then
		str = string.format("%.1fk", amount / 1000)
	end

	return str:gsub("%.0", "")
end

function formatMoney(money)
	if money < 1 then
		return 0
	end

	local moneyMap = {
		{
			worth = 1e+17,
			name = "BB"
		},
		{
			worth = 100000000000000,
			name = "B"
		},
		{
			worth = 100000000000,
			name = "KKK"
		},
		{
			worth = 100000000,
			name = "KK"
		},
		{
			worth = 100000,
			name = "K"
		},
		{
			worth = 100,
			name = "D"
		},
		{
			worth = 1,
			name = "C"
		}
	}
	local formatMoney = {}
	local value = 0

	for k, v in pairs(moneyMap) do
		value = math.floor(money / v.worth)
		money = money - value * v.worth

		while value > 0 do
			formatMoney[#formatMoney + 1] = math.min(999, value) .. v.name
			value = value - math.min(999, value)
		end
	end

	return table.concat(formatMoney, " ")
end

function formatTime(seconds)
	local hour = math.floor(seconds / 3600)
	local minute = math.floor((seconds - hour * 3600) / 60)
	local second = math.floor(seconds % 60)

	return string.format("%0.2d:%0.2d:%0.2d", hour, minute, second)
end

function formatCooldown(cooldown)
	local result = {}
	local units = {
		{
			86400,
			"d"
		},
		{
			3600,
			"h"
		},
		{
			60,
			"m"
		},
		{
			1,
			"s"
		}
	}

	for i, v in ipairs(units) do
		local value, symbol = v[1], v[2]
		local amount = math.floor(cooldown / value)

		cooldown = cooldown % value

		if amount > 0 then
			table.insert(result, amount .. symbol)
		end
	end

	local formatted = table.concat(result, " ")

	return formatted ~= "" and formatted or "0s"
end

function isTestServ()
	return G.server ~= "Union"
end

function breakDescription(description, wordsPerLine)
	local tmpLines = {}
	local currentLine = ""
	local count = 0

	for word in description:gmatch("%S+") do
		currentLine = currentLine .. word .. " "
		count = count + 1

		if wordsPerLine <= count then
			table.insert(tmpLines, currentLine)

			currentLine = ""
			count = 0
		end
	end

	if currentLine ~= "" then
		table.insert(tmpLines, currentLine)
	end

	return table.concat(tmpLines, "\n")
end
