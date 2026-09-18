-- chunkname: @/modules/corelib/cooldown.lua

Cooldown = {}

local ProgressCallback = {
	finish = 2,
	update = 1
}

function Cooldown:updateCooldown(widget, timeStart, timeEnd)
	local timer = g_clock.seconds()

	if timer <= timeEnd then
		local percent = (widget.progressRect and timer - timeStart or timeEnd - timer) / (timeEnd - timeStart) * 100
		local timeStr = string.format("%.0f", timeEnd - timer)

		if widget.showText then
			widget:setText(timeStr)
		end

		if self.update then
			self.update(widget, percent)
		end

		widget:setPercent(percent)
		removeEvent(widget.event)

		widget.event = scheduleEvent(function()
			if widget.callback then
				widget.callback[ProgressCallback.update]()
			end
		end, 100)
	else
		widget.callback[ProgressCallback.finish]()
	end
end

function Cooldown:turnOffCooldown(widget)
	removeEvent(widget.event)

	if self.finish then
		self.finish(widget)
	end

	widget:setPercent(widget.progressRect and 100 or 0)
	widget:clearText()

	widget = nil
end

function Cooldown:start(widget, updateCallback, finishCallback)
	widget:setPercent(widget.progressRect and 100 or 0)

	widget.callback = {}
	widget.callback[ProgressCallback.update] = updateCallback
	widget.callback[ProgressCallback.finish] = finishCallback

	updateCallback()
end

function Cooldown:init(widget, cooldown)
	local newCooldown = {}
	local timeStart = g_clock.seconds()
	local timeEnd = g_clock.seconds() + cooldown

	local function updateFunc()
		newCooldown:updateCooldown(widget, timeStart, timeEnd)
	end

	local function finishFunc()
		newCooldown:turnOffCooldown(widget)
	end

	setmetatable(newCooldown, {
		__index = Cooldown
	})
	newCooldown:start(widget, updateFunc, finishFunc)

	return newCooldown
end
