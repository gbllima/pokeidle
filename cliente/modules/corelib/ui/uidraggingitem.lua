-- chunkname: @/modules/corelib/ui/uidraggingitem.lua

UIDraggingItem = {}

local uiItem

function UIDraggingItem:display(item)
	if not uiItem then
		uiItem = g_ui.createWidget("UIDraggingItem", rootWidget)
	end

	uiItem:setItem(item)
	uiItem:raise()
	uiItem:show()
	connect(rootWidget, {
		onMouseMove = onMouseMove
	})
end

function UIDraggingItem:hide()
	uiItem:hide()
	disconnect(rootWidget, {
		onMouseMove = onMouseMove
	})
end

function onMouseMove(self, mousePos, mouseMoved)
	uiItem:setPosition(mousePos)
end
