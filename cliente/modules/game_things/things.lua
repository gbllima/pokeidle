filename = nil
loaded = false

function setFileName(name)
  filename = name
end

function isLoaded()
  return loaded
end

function load()
  local version = g_game.getClientVersion()
  local things = g_settings.getNode('things')

  local datPath, sprPath, otmlBasePath

  if things and things["data"] ~= nil and things["sprites"] ~= nil and things["tibia"] ~= nil then
    datPath = resolvepath('/things/' .. things["data"])
    sprPath = resolvepath('/things/' .. things["sprites"])
    otmlBasePath = resolvepath('/things/' .. things["tibia"])
  else
    if filename then
      datPath = resolvepath('/things/' .. filename)
      sprPath = resolvepath('/things/' .. filename)
      otmlBasePath = resolvepath('/things/' .. filename)
    else
      datPath = resolvepath('/things/' .. version .. '/Tibia')
      sprPath = resolvepath('/things/' .. version .. '/Tibia')
      otmlBasePath = resolvepath('/things/' .. version .. '/')
    end
  end

  local errorMessage = ''

  if not g_things.loadDat(datPath) then
    if not g_game.getFeature(GameSpritesU32) then
      g_game.enableFeature(GameSpritesU32)
      if not g_things.loadDat(datPath) then
        errorMessage = errorMessage .. tr("Unable to load dat file, please place a valid dat in '%s'", datPath) .. '\n'
      end
    else
      errorMessage = errorMessage .. tr("Unable to load dat file, please place a valid dat in '%s'", datPath) .. '\n'
    end
  end

  if not g_sprites.loadSpr(sprPath) then
    errorMessage = errorMessage .. tr("Unable to load spr file, please place a valid spr in '%s'", sprPath) .. '\n'
  end

  local otmlFiles = {
    outfits = "outfits.otml",
    items = "items.otml",
    effects = "effects.otml"
  }

  for _, file in pairs(otmlFiles) do
    local path = resolvepath(otmlBasePath .. file)
    if not g_resources.fileExists(path) then
      errorMessage = errorMessage .. tr("OTML file not found: %s", path) .. '\n'
    else
      if not g_things.loadOtml(path) then
        errorMessage = errorMessage .. tr("Unable to load otml file: %s", path) .. '\n'
      end
    end
  end

  loaded = (errorMessage:len() == 0)

  if errorMessage:len() > 0 then
    local messageBox = displayErrorBox(tr('Error'), errorMessage)
    addEvent(function() messageBox:raise() messageBox:focus() end)
  else
    -- if g_minimap and g_minimap.setHDMode then
    --   g_minimap.setHDMode(true)
    -- end
  end
end
