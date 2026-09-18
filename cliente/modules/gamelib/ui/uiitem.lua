-- chunkname: @/modules/gamelib/ui/uiitem.lua

function UIItem:onDragEnter(mousePos)
	if self:isVirtual() then
		return false
	end

	local item = self:getItem()

	if not item then
		return false
	end

	UIDraggingItem:display(item)
	self:setOn(true)

	self.currentDragThing = item

	g_mouse.pushCursor("target")
	modules.game_market.onDraggingItem(self.currentDragThing, mousePos, "enter")
	modules.game_pokemonseller.onDragEnter(self.currentDragThing, mousePos)

	return true
end

function UIItem:onDragLeave(droppedWidget, mousePos)
	if self:isVirtual() then
		return false
	end

	g_mouse.popCursor("target")
	self:setOn(false)
	self:setChecked(false)
	modules.game_market.onDraggingItem(self.currentDragThing, mousePos, "leave")
	modules.game_pokemonseller.onDragLeave(self.currentDragThing, droppedWidget, mousePos)

	self.currentDragThing = nil
	self.hoveredWho = nil

	return true
end

function UIItem:onDrop(widget, mousePos, forced)
	if not self:canAcceptDrop(widget, mousePos) and not forced then
		return false
	end

	local item = widget.currentDragThing

	if not item or not item:isItem() then
		return false
	end

	if self.selectable then
		if item:isPickupable() then
			self:setItem(Item.create(item:getId(), item:getCountOrSubType()))

			return true
		end

		return false
	end

	if self.draggingItem then
		UIDraggingItem:hide()

		return false
	end

	if self.isUnlocked ~= nil and not self.isUnlocked then
		self:setChecked(false)

		return false
	end

	local toPos = self.position
	local itemPos = item:getPosition()

	if itemPos.x == toPos.x and itemPos.y == toPos.y and itemPos.z == toPos.z then
		return false
	end

	if item:getCount() > 1 then
		modules.game_interface.moveStackableItem("Move Itens", item, toPos)
	else
		g_game.move(item, toPos, 1)
	end

	self:setOn(false)
	self:setChecked(false)

	return true
end

function UIItem:onDestroy()
	if self == g_ui.getDraggingWidget() and self.hoveredWho then
		self:setOn(false)
		self:setChecked(false)
	end

	if self.hoveredWho then
		self.hoveredWho = nil
	end
end

function UIItem:onHoverChange(hovered)
	UIWidget.onHoverChange(self, hovered)

	if self:isVirtual() or not self:isDraggable() then
		return
	end

	local draggingWidget = g_ui.getDraggingWidget()

	if draggingWidget and self ~= draggingWidget then
		local gotMap = draggingWidget:getClassName() == "UIGameMap"
		local gotItem = draggingWidget:getClassName() == "UIItem" and not draggingWidget:isVirtual()

		if hovered and (gotItem or gotMap) then
			if self.isUnlocked ~= nil and not self.isUnlocked then
				self:setChecked(true)
			else
				self:setOn(true)
			end

			draggingWidget.hoveredWho = self
		else
			if self.isUnlocked ~= nil and not self.isUnlocked then
				self:setChecked(false)
			else
				self:setOn(false)
			end

			draggingWidget.hoveredWho = nil
		end
	end
end

function UIItem:onMouseRelease(mousePosition, mouseButton)
	if self.cancelNextRelease then
		self.cancelNextRelease = false

		return true
	end

	if self:isVirtual() then
		return false
	end

	local item = self:getItem()

	if not item or not self:containsPoint(mousePosition) then
		return false
	end

	signalcall(UIItem.onMouseItemRelease, mousePosition, mouseButton, item)

	if modules.client_options.getOption("classicControl") and not g_app.isMobile() and (g_mouse.isPressed(MouseLeftButton) and mouseButton == MouseRightButton or g_mouse.isPressed(MouseRightButton) and mouseButton == MouseLeftButton) then
		g_game.look(item)

		self.cancelNextRelease = true

		return true
	elseif modules.game_interface.processMouseAction(mousePosition, mouseButton, nil, item, item, nil, nil) then
		return true
	end

	return false
end

function UIItem:canAcceptDrop(widget, mousePos)
	if not self.selectable and not self.draggingItem and (self:isVirtual() or not self:isDraggable()) then
		return false
	end

	if not widget or not widget.currentDragThing then
		return false
	end

	local children = rootWidget:recursiveGetChildrenByPos(mousePos)

	for i = 1, #children do
		local child = children[i]

		if child == self then
			return true
		elseif not child:isPhantom() then
			return false
		end
	end

	error("Widget " .. self:getId() .. " not in drop list.")

	return false
end

function UIItem:onClick(mousePos)
	if not self.selectable or not self.editable then
		return
	end
end

function UIItem:onItemChange()
	local tooltip

	if self:getItem() and self:getItem():getTooltip():len() > 0 then
		tooltip = self:getItem():getTooltip()
	end

	self:setTooltip(tooltip)
end

function UIItem:onStyleApply(styleName, styleNode)
	for name, value in pairs(styleNode) do
		if name == "show-count" then
			self:setShowCount(value)
		end
	end
end
