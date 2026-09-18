-- chunkname: @/modules/corelib/ui/uiwidget.lua

function UIWidget:setMargin(...)
	local params = {
		...
	}

	if #params == 1 then
		self:setMarginTop(params[1])
		self:setMarginRight(params[1])
		self:setMarginBottom(params[1])
		self:setMarginLeft(params[1])
	elseif #params == 2 then
		self:setMarginTop(params[1])
		self:setMarginRight(params[2])
		self:setMarginBottom(params[1])
		self:setMarginLeft(params[2])
	elseif #params == 4 then
		self:setMarginTop(params[1])
		self:setMarginRight(params[2])
		self:setMarginBottom(params[3])
		self:setMarginLeft(params[4])
	end
end

function UIWidget:setMultiColorText(text, defaultColor)
	local highlightData = getHighlightedText(text, defaultColor or "white")

	if #highlightData > 2 then
		self:setColoredText(highlightData)
	else
		self:setText(text)
	end
end

function UIWidget:addChildReverse(child)
	local index = self:getChildIndex(child)

	if index == 1 or index <= self.numColumn then
		child:addAnchor(AnchorTop, "parent", AnchorTop)
	elseif index % (self.numColumn + 1) == 0 then
		child:addAnchor(AnchorTop, "prev", AnchorBottom)
	else
		child:addAnchor(AnchorTop, "prev", AnchorTop)
	end

	if index == 1 or index % (self.numColumn + 1) == 0 then
		child:addAnchor(AnchorRight, "parent", AnchorRight)
	else
		child:addAnchor(AnchorRight, "prev", AnchorLeft)
	end
end
