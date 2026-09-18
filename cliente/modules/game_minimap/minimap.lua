-- chunkname: @/modules/game_minimap/minimap.lua

minimapWidget = nil
minimapButton = nil
minimapWindow = nil
otmm = true
preloaded = false
oldZoom = nil
oldPos = nil
oldFloor = nil
panelControls = nil
confirmTeleport = nil

local searchPokemon = {
	name = "",
	list = {}
}
local controlsMinimapWidget = {
	floorUp = function()
		minimapWidget:onFloorUp(1)
	end,
	floorDown = function()
		minimapWidget:onFloorDown(1)
	end,
	zoomIn = function()
		minimapWidget:zoomIn()
	end,
	zoomOut = function()
		minimapWidget:zoomOut()
	end,
	reset = function()
		minimapWidget:reset()
	end,
	close = function()
		toggleFullMap()
	end
}
local MAP_COMPOSITIONS = {
	{
		teleport = true,
		text = "Viridian",
		position = {
			y = 631,
			x = 632,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Pewter",
		position = {
			y = 421,
			x = 631,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Cerulean",
		position = {
			y = 390,
			x = 994,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Saffron",
		position = {
			y = 553,
			x = 1026,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Celadon",
		position = {
			y = 543,
			x = 879,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Lavender",
		position = {
			y = 552,
			x = 1182,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Vermilion",
		position = {
			y = 699,
			x = 1036,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Fuchsia",
		position = {
			y = 863,
			x = 1094,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Cinnabar",
		position = {
			y = 841,
			x = 644,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Wild Area South",
		position = {
			y = 1475,
			x = 1930,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Wild Area North",
		position = {
			y = 1093,
			x = 1918,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Wild Area East",
		position = {
			y = 1315,
			x = 2275,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Azalea",
		position = {
			y = 1623,
			x = 646,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Goldenrod",
		position = {
			y = 1514,
			x = 576,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Ecruteak",
		position = {
			y = 1369,
			x = 660,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Olivine",
		position = {
			y = 1429,
			x = 494,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Cianwood",
		position = {
			y = 1596,
			x = 367,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Violet",
		position = {
			y = 1480,
			x = 740,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Butwal",
		position = {
			y = 1470,
			x = 951,
			z = 7
		}
	},
	{
		teleport = true,
		text = "The Under",
		position = {
			y = 480,
			x = 1806,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Phenac",
		position = {
			y = 207,
			x = 1983,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Agate",
		position = {
			y = 431,
			x = 1989,
			z = 7
		}
	},
	{
		teleport = true,
		text = "Pyrite Town",
		position = {
			y = 173,
			x = 2466,
			z = 7
		}
	},
	{
		text = "Charicific Valley",
		position = {
			y = 129,
			x = 506,
			z = 7
		}
	},
	{
		text = "Fairy Island",
		position = {
			y = 289,
			x = 427,
			z = 7
		}
	},
	{
		text = "Green Island",
		position = {
			y = 241,
			x = 757,
			z = 7
		}
	},
	{
		text = "Wildwind Island",
		position = {
			y = 128,
			x = 918,
			z = 7
		}
	},
	{
		text = "Hurricane Island",
		position = {
			y = 211,
			x = 1072,
			z = 7
		}
	},
	{
		text = "Shell Island",
		position = {
			y = 271,
			x = 1244,
			z = 7
		}
	},
	{
		text = "Mt. Moon",
		position = {
			y = 402,
			x = 760,
			z = 7
		}
	},
	{
		text = "Cerulean Swamp",
		position = {
			y = 441,
			x = 849,
			z = 7
		}
	},
	{
		text = "Cubone's Lair",
		position = {
			y = 370,
			x = 1099,
			z = 7
		}
	},
	{
		text = "Rock Tunel",
		position = {
			y = 460,
			x = 1192,
			z = 7
		}
	},
	{
		text = "Power Plant",
		position = {
			y = 435,
			x = 1269,
			z = 7
		}
	},
	{
		text = "Dark Light Island",
		position = {
			y = 410,
			x = 1605,
			z = 7
		}
	},
	{
		text = "Desert Island",
		position = {
			y = 622,
			x = 1545,
			z = 7
		}
	},
	{
		text = "Coliseum",
		position = {
			y = 633,
			x = 512,
			z = 7
		}
	},
	{
		text = "Jungle Island",
		position = {
			y = 717,
			x = 817,
			z = 7
		}
	},
	{
		text = "Tropical Island",
		position = {
			y = 548,
			x = 777,
			z = 7
		}
	},
	{
		text = "Diving Spot",
		position = {
			y = 696,
			x = 1223,
			z = 7
		}
	},
	{
		text = "Safari Kanto",
		position = {
			y = 841,
			x = 974,
			z = 7
		}
	},
	{
		text = "Ranch",
		position = {
			y = 788,
			x = 1087,
			z = 7
		}
	},
	{
		text = "Lost Island",
		position = {
			y = 932,
			x = 1521,
			z = 7
		}
	},
	{
		text = "Seafoam Island",
		position = {
			y = 1067,
			x = 966,
			z = 7
		}
	},
	{
		text = "Safari Johto",
		position = {
			y = 1553,
			x = 292,
			z = 7
		}
	},
	{
		text = "Moro Island",
		position = {
			y = 1641,
			x = 971,
			z = 7
		}
	},
	{
		text = "Kinnow Island",
		position = {
			y = 1937,
			x = 865,
			z = 7
		}
	},
	{
		text = "Enigmatic Island",
		position = {
			y = 2422,
			x = 731,
			z = 7
		}
	},
	{
		text = "Magma Island",
		position = {
			y = 2353,
			x = 396,
			z = 7
		}
	},
	{
		text = "Murcott Island",
		position = {
			y = 2376,
			x = 1026,
			z = 7
		}
	},
	{
		text = "Seafoam Island",
		position = {
			y = 1067,
			x = 966,
			z = 7
		}
	},
	{
		text = "Fairchild Island",
		position = {
			y = 1940,
			x = 542,
			z = 7
		}
	},
	{
		text = "Rock Island Mountain",
		position = {
			y = 171,
			x = 1274,
			z = 7
		}
	},
	{
		text = "Police HQ",
		position = {
			y = 717,
			x = 490,
			z = 7
		}
	},
	{
		text = "Diving Spot",
		position = {
			y = 457,
			x = 519,
			z = 7
		}
	},
	{
		text = "Diving Spot",
		position = {
			y = 1494,
			x = 991,
			z = 7
		}
	},
	{
		text = "Diving Spot",
		position = {
			y = 935,
			x = 1859,
			z = 7
		}
	},
	{
		text = "Hearted Island",
		position = {
			y = 1736,
			x = 748,
			z = 7
		}
	}
}
local COMPOSITIONS_POS_GUIDES = {}
local GUIDES = {
	Stones = {
		{
			description = "First Leaf Stone",
			color = "#4cff4c",
			position = {
				y = 435,
				x = 1088,
				z = 7
			},
			type = MAPMARK_FLAG
		},
		{
			description = "First Fire Stone",
			color = "#ff4000",
			position = {
				y = 519,
				x = 1160,
				z = 7
			},
			type = MAPMARK_FLAG
		},
		{
			description = "First Water Stone",
			color = "#389bff",
			position = {
				y = 518,
				x = 903,
				z = 7
			},
			type = MAPMARK_FLAG
		}
	},
	Eevee = {
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/umbreon",
			color = "white",
			position = {
				y = 1998,
				x = 611,
				z = 7
			}
		},
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/espeon",
			color = "white",
			position = {
				y = 2368,
				x = 736,
				z = 7
			}
		},
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/vaporeon",
			color = "white",
			position = {
				y = 2010,
				x = 830,
				z = 7
			}
		},
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/jolteon",
			color = "white",
			position = {
				y = 376,
				x = 1358,
				z = 7
			}
		},
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/flareon",
			color = "white",
			position = {
				y = 2405,
				x = 390,
				z = 7
			}
		},
		{
			description = "Scout Dungeon: Eeveelution",
			type = "/images/game/icons/shiny sylveon",
			color = "white",
			position = {
				y = 256,
				x = 441,
				z = 7
			}
		}
	}
}

function init()
	minimapWindow = g_ui.loadUI("minimap", modules.game_interface.getRightPanel())

	minimapWindow:setContentMinimumHeight(64)

	if not minimapWindow.forceOpen then
		minimapButton = modules.client_topmenu.addRightButton("minimapButton", tr("Minimap") .. " (Ctrl+M)", "/images/topbuttons/icon_map", toggle, false, 7)

		minimapButton:setOn(true)
	end

	minimapWidget = minimapWindow:recursiveGetChildById("minimap")
	panelControls = minimapWidget:getChildById("panelControls")

	local gameRootPanel = modules.game_interface.getRootPanel()

	g_keyboard.bindKeyPress("Alt+Left", function()
		minimapWidget:move(1, 0)
	end, gameRootPanel)
	g_keyboard.bindKeyPress("Alt+Right", function()
		minimapWidget:move(-1, 0)
	end, gameRootPanel)
	g_keyboard.bindKeyPress("Alt+Up", function()
		minimapWidget:move(0, 1)
	end, gameRootPanel)
	g_keyboard.bindKeyPress("Alt+Down", function()
		minimapWidget:move(0, -1)
	end, gameRootPanel)
	g_keyboard.bindKeyDown("Ctrl+M", toggle)
	g_keyboard.bindKeyDown("Ctrl+Tab", toggleFullMap)
	minimapWindow:setup()
	connect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})
	connect(LocalPlayer, {
		onPositionChange = updateCameraPosition
	})
	connect(Creature, {
		onPositionChange = updatePokemonViewPosition
	})
	connect(g_minimap, {
		onFloorChange = onFloorChange
	})

	if g_game.isOnline() then
		online()
	end
end

function terminate()
	if g_game.isOnline() then
		saveMap()
	end

	disconnect(g_game, {
		onGameStart = online,
		onGameEnd = offline
	})
	disconnect(LocalPlayer, {
		onPositionChange = updateCameraPosition
	})
	disconnect(Creature, {
		onPositionChange = updatePokemonViewPosition
	})
	disconnect(g_minimap, {
		onFloorChange = onFloorChange
	})

	local gameRootPanel = modules.game_interface.getRootPanel()

	g_keyboard.unbindKeyPress("Alt+Left", gameRootPanel)
	g_keyboard.unbindKeyPress("Alt+Right", gameRootPanel)
	g_keyboard.unbindKeyPress("Alt+Up", gameRootPanel)
	g_keyboard.unbindKeyPress("Alt+Down", gameRootPanel)
	g_keyboard.unbindKeyDown("Ctrl+M")
	g_keyboard.unbindKeyDown("Ctrl+Tab")
	minimapWindow:destroy()

	if confirmTeleport then
		confirmTeleport:destroy()

		confirmTeleport = nil
	end

	if minimapButton then
		minimapButton:destroy()
	end
end

function toggle()
	if not minimapButton then
		return
	end

	if minimapButton:isOn() then
		minimapWindow:close()
		minimapButton:setOn(false)
	else
		minimapWindow:open()
		minimapButton:setOn(true)
	end
end

function onMiniWindowClose()
	if minimapButton then
		minimapButton:setOn(false)
	end
end

function preload()
	loadMap(false)

	preloaded = true
end

function online()
	loadMap(not preloaded)
	updateCameraPosition()
end

function offline()
	saveMap()

	if confirmTeleport then
		confirmTeleport:destroy()

		confirmTeleport = nil
	end
end

function loadComposition()
	g_minimap.loadImage("/images/game/premap", {
		y = 0,
		x = 2,
		z = 7
	}, 0.5)

	for _, composition in pairs(MAP_COMPOSITIONS) do
		local flag = g_ui.createWidget("CityLabel")

		flag:hide()

		flag.pos = composition.position

		flag.city:setText(composition.text)
		flag.city:resizeToText()
		flag:setWidth(flag.city:getWidth() + 22)
		flag.icon:setVisible(composition.teleport)

		function flag.icon.onClick()
			local function onConfirm()
				g_game.talk(tr("!h %s", composition.text))
			end

			confirmTeleport = displayConfirmBox(tr("Teleport"), tr("Voc\xEA realmente deseja teleportar para {%s|%s}?", "#e2bb5b", composition.text), onConfirm)
		end

		minimapWidget:insertChild(1, flag)
		minimapWidget:centerInPosition(flag, flag.pos)
		minimapWidget:addAlternativeWidget(flag, flag.pos, -1)
	end
end

function loadGuides()
	for k, city in pairs(GUIDES) do
		for _, mark in pairs(city) do
			minimapWidget:addFlag(mark.position, mark.type, tr(mark.description), true, tocolor(mark.color))
			table.insert(COMPOSITIONS_POS_GUIDES, mark.position)
		end
	end
end

function toggleGuides()
	for _, pos in pairs(COMPOSITIONS_POS_GUIDES) do
		minimapWidget:getFlag(pos):setVisible(minimapWidget.fullView)
	end
end

function destroySearchPokemon()
	for i, pin in pairs(searchPokemon.list) do
		pin:destroy()
	end

	searchPokemon = {
		name = "",
		list = {}
	}
end

function onSearchPokemon(name, posZ)
	if searchPokemon.name ~= name then
		destroySearchPokemon()
	end

	if not SPAWNS[name] then
		return
	end

	if not minimapWidget.fullView then
		toggleFullMap()
	end

	local posFloor = posZ or minimapWidget:getCameraPosition().z

	searchPokemon.name = name

	for i, pos in pairs(SPAWNS[name]) do
		local pin = minimapWidget[name .. i]

		if not pin then
			pin = g_ui.createWidget("PokemonLocation", minimapWidget)

			pin:setId(name .. i)

			searchPokemon.list[i] = pin
		end

		pin:setOn(posFloor == pos.z)
		pin:updateOnState(pos, posFloor)
		minimapWidget:centerInPosition(pin, {
			x = pos.x,
			y = pos.y,
			z = posFloor
		})
	end
end

function loadMap(clean)
	local clientVersion = g_game.getClientVersion()

	if clean then
		g_minimap.clean()
	end

	if otmm then
		local minimapFile = "/minimap.otmm"

		if g_resources.fileExists("/data" .. minimapFile) then
			g_minimap.loadOtmm("/data" .. minimapFile)
		elseif g_resources.fileExists(minimapFile) then
			g_minimap.loadOtmm(minimapFile)
		end
	else
		local minimapFile = "/minimap_" .. clientVersion .. ".otcm"

		if g_resources.fileExists("/data" .. minimapFile) then
			g_map.loadOtcm("/data" .. minimapFile)
		elseif g_resources.fileExists(minimapFile) then
			g_map.loadOtcm(minimapFile)
		end
	end

	loadGuides()
	toggleGuides()
	loadComposition()
	minimapWidget:load()
end

function saveMap()
	local clientVersion = g_game.getClientVersion()

	if otmm then
		local minimapFile = "/minimap.otmm"

		g_minimap.saveOtmm(minimapFile)
	else
		local minimapFile = "/minimap_" .. clientVersion .. ".otcm"

		g_map.saveOtcm(minimapFile)
	end

	minimapWidget:save()
end

function updateCameraPosition()
	local player = g_game.getLocalPlayer()

	if not player or g_game.isPokemonView() then
		return
	end

	local pos = player:getPosition()

	if not pos then
		return
	end

	if not minimapWidget:isDragging() then
		if not minimapWidget.fullView then
			oldPos = pos

			minimapWidget:setCameraPosition(player:getPosition())
		end

		minimapWidget:setCrossPosition(player:getPosition())
	end
end

function updatePokemonViewPosition(creature)
	if g_game.isPokemonView() and creature:isSummon() and not minimapWidget:isDragging() then
		local pos = creature:getPosition()

		if pos then
			if not minimapWidget.fullView then
				oldPos = pos

				minimapWidget:setCameraPosition(pos)
			end

			minimapWidget:setCrossPosition(pos)
		end
	end
end

function toggleFullMap()
	if not minimapWidget.fullView then
		minimapWidget.fullView = true

		minimapWindow:hide()
		minimapWidget:setParent(modules.game_interface.getRootPanel())
		minimapWidget:fill("parent")
		minimapWidget:setAlternativeWidgetsVisible(true)
		panelControls:setVisible(true)
		minimapWidget:setMargin(90, 210, 140, 210)
	else
		minimapWidget.fullView = false

		minimapWidget:setParent(minimapWindow:getChildById("contentsPanel"))
		minimapWidget:fill("parent")
		minimapWindow:show()
		minimapWidget:setAlternativeWidgetsVisible(false)
		panelControls:setVisible(false)
		minimapWidget:setMargin(0)
		destroySearchPokemon()
	end

	local zoom = oldZoom or 0
	local pos = oldPos or minimapWidget:getCameraPosition()

	oldZoom = minimapWidget:getZoom()
	oldPos = minimapWidget:getCameraPosition()
	pos.z = oldFloor or pos.z

	minimapWidget:setZoom(zoom)
	minimapWidget:setCameraPosition(pos)
	toggleGuides()
end

function setupControlPanels(buttonId)
	local executeControl = controlsMinimapWidget[buttonId]

	if executeControl then
		executeControl()
	end
end

function onFloorChange(posZ)
	oldFloor = posZ

	onSearchPokemon(searchPokemon.name, posZ)
end
