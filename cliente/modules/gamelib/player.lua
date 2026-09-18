-- chunkname: @/modules/gamelib/player.lua

PlayerStates = {
	Cursed = 2048,
	Dazzled = 1024,
	Freezing = 512,
	Drowning = 256,
	Swords = 128,
	Haste = 64,
	Paralyze = 32,
	ManaShield = 16,
	Drunk = 8,
	Energy = 4,
	Burn = 2,
	Poison = 1,
	None = 0,
	Hungry = 65536,
	Bleeding = 32768,
	Pz = 16384,
	PzBlock = 8192,
	PartyBuff = 4096
}
InventorySlotOther = 0
InventorySlotHead = 1
InventorySlotNeck = 2
InventorySlotBack = 3
InventorySlotBody = 4
InventorySlotRight = 5
InventorySlotLeft = 6
InventorySlotLeg = 7
InventorySlotFeet = 8
InventorySlotFinger = 9
InventorySlotAmmo = 10
InventorySlotPurse = 11
InventorySlotFirst = 1
InventorySlotLast = 10

function Player:isPartyLeader()
	local shield = self:getShield()

	return shield == ShieldWhiteYellow or shield == ShieldYellow or shield == ShieldYellowSharedExp or shield == ShieldYellowNoSharedExpBlink or shield == ShieldYellowNoSharedExp
end

local slotNames = {
    [InventorySlotHead]   = "Head",
    [InventorySlotNeck]   = "Neck",
    [InventorySlotBack]   = "Backpack",
    [InventorySlotBody]   = "Armor",
    [InventorySlotRight]  = "Right Hand",
    [InventorySlotLeft]   = "Left Hand",
    [InventorySlotLeg]    = "Legs",
    [InventorySlotFeet]   = "Feet",
    [InventorySlotFinger] = "Ring",
    [InventorySlotAmmo]   = "Ammo"
}

function Player:printInventory()
    for slot = InventorySlotFirst, InventorySlotLast do
        local slotName = slotNames[slot] or ("Slot " .. slot)
        local item = self:getInventoryItem(slot)

        if item then
            print(string.format("%s: ID=%d, Count=%d",
                slotName,
                item:getId(),
                item:getCount()
            ))
        else
            print(string.format("%s: vazio", slotName))
        end
    end
end

function Player:isPartyMember()
	local shield = self:getShield()

	return shield == ShieldWhiteYellow or shield == ShieldYellow or shield == ShieldYellowSharedExp or shield == ShieldYellowNoSharedExpBlink or shield == ShieldYellowNoSharedExp or shield == ShieldBlueSharedExp or shield == ShieldBlueNoSharedExpBlink or shield == ShieldBlueNoSharedExp or shield == ShieldBlue
end

function Player:isPartySharedExperienceActive()
	local shield = self:getShield()

	return shield == ShieldYellowSharedExp or shield == ShieldYellowNoSharedExpBlink or shield == ShieldYellowNoSharedExp or shield == ShieldBlueSharedExp or shield == ShieldBlueNoSharedExpBlink or shield == ShieldBlueNoSharedExp
end

function Player:isEnabledAutoLoot()
	return self.enableAutoLoot
end

function Player:hasVip(creatureName)
	for id, vip in pairs(g_game.getVips()) do
		if vip[1] == creatureName then
			return true
		end
	end

	return false
end

function Player:isMounted()
	local outfit = self:getOutfit()

	return outfit.mount ~= nil and outfit.mount > 0
end

function Player:toggleMount()
	if g_game.getFeature(GamePlayerMounts) then
		g_game.mount(not self:isMounted())
	end
end

function Player:mount()
	if g_game.getFeature(GamePlayerMounts) then
		g_game.mount(true)
	end
end

function Player:dismount()
	if g_game.getFeature(GamePlayerMounts) then
		g_game.mount(false)
	end
end

function Player:getItem(itemId, subType)
	return g_game.findPlayerItem(itemId, subType or -1)
end

function Player:getItems(itemId, subType)
	local subType = subType or -1
	local items = {}

	for i = InventorySlotFirst, InventorySlotLast do
		local item = self:getInventoryItem(i)

		if item and item:getId() == itemId and (subType == -1 or item:getSubType() == subType) then
			table.insert(items, item)
		end
	end

	for i, container in pairs(g_game.getContainers()) do
		for j, item in pairs(container:getItems()) do
			if item:getId() == itemId and (subType == -1 or item:getSubType() == subType) then
				item.container = container

				table.insert(items, item)
			end
		end
	end

	return items
end

function Player:getItemsCount(itemId)
	local items, count = self:getItems(itemId), 0

	for i = 1, #items do
		count = count + items[i]:getCount()
	end

	return count
end

function Player:hasState(state, states)
	states = states or self:getStates()

	for i = 1, 32 do
		local pow = math.pow(2, i - 1)

		if states < pow then
			break
		end

		local states = bit32.band(states, pow)

		if states == state then
			return true
		end
	end

	return false
end

function Player:setEnableAutoLoot(enable)
	self.enableAutoLoot = enable
end

function Player:setPokemon(creature)
	self.pokemon = creature
end

function Player:getPokemon()
	return self.pokemon
end


function Player:doUsePokeBag()
	g_game.open(self:getInventoryItem(InventorySlotBack))
end

function Player:doUsePokedex()
	modules.game_interface.startUseWith(self:getInventoryItem(InventorySlotLeg))
end

function Player:doUseFishing()
	modules.game_interface.startUseWith(self:getInventoryItem(InventorySlotNeck))
	g_game.open(self:getInventoryItem(InventorySlotNeck))
end

function Player:doUseOrder()
	modules.game_interface.startUseWith(self:getInventoryItem(InventorySlotFinger))
end

function Player:doUseAutoLoot()
	if self:isEnabledAutoLoot() then
		g_game.talkChannel(MessageModes.Yell, 0, "!autoloot off")
	else
		g_game.talkChannel(MessageModes.Yell, 0, "!autoloot on")
	end
end

function Player:doUseSelfOrder()
	g_game.useInventoryItemWith(OrderButton, self)
end
