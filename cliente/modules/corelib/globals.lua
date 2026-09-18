-- chunkname: @/modules/corelib/globals.lua

rootWidget = g_ui.getRootWidget()
modules = package.loaded
G = G or {}

function scheduleEvent(callback, delay)
	local desc = "lua"
	local info = debug.getinfo(2, "Sl")

	if info then
		desc = info.short_src .. ":" .. info.currentline
	end

	local event = g_dispatcher.scheduleEvent(desc, callback, delay)

	event._callback = callback

	return event
end

function addEvent(callback, front)
	local desc = "lua"
	local info = debug.getinfo(2, "Sl")

	if info then
		desc = info.short_src .. ":" .. info.currentline
	end

	local event = g_dispatcher.addEvent(desc, callback, front)

	event._callback = callback

	return event
end

function cycleEvent(callback, interval)
	local desc = "lua"
	local info = debug.getinfo(2, "Sl")

	if info then
		desc = info.short_src .. ":" .. info.currentline
	end

	local event = g_dispatcher.cycleEvent(desc, callback, interval)

	event._callback = callback

	return event
end

function periodicalEvent(eventFunc, conditionFunc, delay, autoRepeatDelay)
	delay = delay or 30
	autoRepeatDelay = autoRepeatDelay or delay

	local func

	function func()
		if conditionFunc and not conditionFunc() then
			func = nil

			return
		end

		eventFunc()
		scheduleEvent(func, delay)
	end

	scheduleEvent(function()
		func()
	end, autoRepeatDelay)
end

function removeEvent(event)
	if event then
		event:cancel()

		event._callback = nil
	end
end

local function TOSTRING(o)
	return "\"" .. tostring(o) .. "\""
end

local function recurse(o, indent)
	if indent == nil then
		indent = ""
	end

	local indent2 = indent .. "  "

	if type(o) == "table" then
		local s = indent .. "{" .. "\n"
		local first = true

		for k, v in pairs(o) do
			if first == false then
				s = s .. ", \n"
			end

			if type(k) ~= "number" then
				k = TOSTRING(k)
			end

			s = s .. indent2 .. "[" .. k .. "] = " .. recurse(v, indent2)
			first = false
		end

		return s .. "\n" .. indent .. "}"
	else
		return TOSTRING(o)
	end
end

function var_dump(...)
	local args = {
		...
	}

	if #args > 1 then
		var_dump(args)
	else
		return recurse(args[1])
	end
end

function dump(...)
	print(var_dump(...))
end
