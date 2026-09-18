-- chunkname: @/modules/corelib/ui/uiprogressbar.lua

UIProgressBar = extends(UIWidget, "UIProgressBar")

function UIProgressBar.create()
	local progressbar = UIProgressBar.internalCreate()

	progressbar:setFocusable(false)
	progressbar:setOn(true)

	progressbar.min = 0
	progressbar.max = 100
	progressbar.value = 0
	progressbar.bgBorderLeft = 0
	progressbar.bgBorderRight = 0
	progressbar.bgBorderTop = 0
	progressbar.bgBorderBottom = 0
	progressbar.width = 0
	progressbar.height = 0
	progressbar.direction = "left-to-right"
	progressbar.useImage = false

	return progressbar
end

function UIProgressBar:setMinimum(minimum)
	self.minimum = minimum

	if minimum > self.value then
		self:setValue(minimum)
	end
end

function UIProgressBar:setMaximum(maximum)
	self.maximum = maximum

	if maximum < self.value then
		self:setValue(maximum)
	end
end

function UIProgressBar:setValue(value, minimum, maximum)
	if minimum then
		self:setMinimum(minimum)
	end

	if maximum then
		self:setMaximum(maximum)
	end

	self.value = math.max(math.min(value, self.maximum), self.minimum)

	self:updateBackground()
end

function UIProgressBar:setPercent(percent)
	self:setValue(percent, 0, 100)
end

function UIProgressBar:getPercent()
	return self.value
end

function UIProgressBar:getPercentPixels()
	return (self.maximum - self.minimum) / self:getWidth()
end

function UIProgressBar:getProgress()
	if self.minimum == self.maximum then
		return 1
	end

	return (self.value - self.minimum) / (self.maximum - self.minimum)
end

function UIProgressBar:updateBackground()
	if self:isOn() then
		if self.useImage then
			local rect = {
				y = 0,
				x = 0,
				width = self.width,
				height = self.height
			}
			local rectDirection = {
				["left-to-right"] = function()
					rect.width = math.max(self.bgBorderLeft, math.floor(self.width * self:getProgress()))
				end,
				["right-to-left"] = function()
					rect.width = math.max(self.bgBorderLeft, math.floor(self.width * self:getProgress()))
					rect.x = self.width - rect.width
				end,
				["top-to-bottom"] = function()
					rect.height = math.max(self.bgBorderTop, math.floor(self.height * self:getProgress()))
				end,
				["bottom-to-top"] = function()
					rect.height = math.max(self.bgBorderTop, math.floor(self.height * self:getProgress()))
					rect.y = self.height - rect.height
				end
			}
			local direction = rectDirection[self.direction]

			if direction then
				direction()
			end

			self:setImageClip(rect)
			self:setImageRect(rect)
		else
			local width = math.round(math.max(self:getProgress() * (self:getWidth() - self.bgBorderLeft - self.bgBorderRight), 1))
			local height = self:getHeight() - self.bgBorderTop - self.bgBorderBottom
			local rect = {
				x = self.bgBorderLeft,
				y = self.bgBorderTop,
				width = width,
				height = height
			}

			self:setBackgroundRect(rect)
		end
	end
end

function UIProgressBar:onSetup()
	self:updateBackground()

	if self.useImage then
		self.width = self:getWidth()
		self.height = self:getHeight()
	end
end

function UIProgressBar:onStyleApply(name, node)
	for name, value in pairs(node) do
		if name == "background-border-left" then
			self.bgBorderLeft = tonumber(value)
		elseif name == "background-border-right" then
			self.bgBorderRight = tonumber(value)
		elseif name == "background-border-top" then
			self.bgBorderTop = tonumber(value)
		elseif name == "background-border-bottom" then
			self.bgBorderBottom = tonumber(value)
		elseif name == "background-border" then
			self.bgBorderLeft = tonumber(value)
			self.bgBorderRight = tonumber(value)
			self.bgBorderTop = tonumber(value)
			self.bgBorderBottom = tonumber(value)
		elseif name == "use-image" then
			self.useImage = toboolean(value)
		elseif name == "direction" then
			self.direction = tostring(value)
		elseif name == "use-image-width" then
			self.width = tonumber(value)
		elseif name == "use-image-height" then
			self.height = tonumber(value)
		elseif name == "use-image-size" then
			local split = value:split(" ")

			self.width = tonumber(split[1])
			self.height = tonumber(split[2])
		end
	end
end

function UIProgressBar:onGeometryChange(oldRect, newRect)
	if not self:isOn() then
		self:setHeight(0)
	end

	self:updateBackground()
end
