-- chunkname: @/modules/client/client.lua

local musicFilename = "/sounds/startup"
local musicChannel

function setMusic(filename)
	musicFilename = filename

	if not g_game.isOnline() and musicChannel ~= nil then
		musicChannel:stop()
		musicChannel:enqueue(musicFilename, 3)
	end
end

function startup()
	-- Função de som comentada temporariamente
	--[[
	if g_sounds then
		-- Verifica se é mobile/Android e força configurações
		if g_app.isMobile() then
			g_sounds.setAudioEnabled(true)
			
			-- Aguarda um pouco e tenta novamente
			addEvent(function()
				local musicCh = g_sounds.getChannel(SoundChannels.Music)
				if musicCh then
					musicCh:setEnabled(true)
					musicCh:setGain(1.0)
					
					-- Tenta diferentes métodos para Android
					musicCh:enqueue(musicFilename, 0) -- Sem fade
					g_sounds.play(musicFilename)
				end
			end, 500)
		else
			musicChannel = g_sounds.getChannel(SoundChannels.Music)
			musicChannel:setEnabled(true)
			musicChannel:enqueue(musicFilename, 3)
		end
	end
	--]]

	G.UUID = g_settings.getString("report-uuid")

	if not G.UUID or #G.UUID ~= 36 then
		G.UUID = g_crypt.genUUID()

		g_settings.set("report-uuid", G.UUID)
	end

	connect(g_game, {
		onGameStart = function()
			if musicChannel ~= nil then
				musicChannel:stop(3)
			end
		end
	})
	connect(g_game, {
		onGameEnd = function()
			-- Sistema de som comentado temporariamente
			--[[
			if g_sounds then
				g_sounds.stopAll()
				-- Toca a música de startup novamente quando sai do jogo
				if musicChannel then
					musicChannel:enqueue(musicFilename, 3)
				end
			end
			--]]
		end
	})
end

function init()
	connect(g_app, {
		onRun = startup,
		onExit = exit
	})
	connect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})

	if g_sounds then
		-- Sistema de áudio comentado temporariamente
		--[[
		-- Para mobile, força configurações de áudio
		if g_app.isMobile() then
			g_sounds.setAudioEnabled(true)
			
			-- Tenta um arquivo de som mais simples para teste
			local testSound = "/sounds/alarm" -- Som mais simples
			g_sounds.preload(testSound)
			
			local musicCh = g_sounds.getChannel(SoundChannels.Music)
			if musicCh then
				musicCh:setEnabled(true)
				musicCh:setGain(1.0)
			end
			
			-- Testa com som simples primeiro
			addEvent(function()
				g_sounds.play(testSound)
			end, 1000)
		end
		
		g_sounds.preload(musicFilename)
		--]]
	end

	if g_resources.getLayout() == "mobile" then
		g_window.setMinimumSize({
			height = 360,
			width = 640
		})
	else
		g_window.setMinimumSize({
			height = 640,
			width = 800
		})
	end

	local size = {
		height = 600,
		width = 1024
	}

	size = g_settings.getSize("window-size", size)

	g_window.resize(size)

	local displaySize = g_window.getDisplaySize()
	local defaultPos = {
		x = (displaySize.width - size.width) / 2,
		y = (displaySize.height - size.height) / 2
	}
	local pos = g_settings.getPoint("window-pos", defaultPos)

	pos.x = math.max(pos.x, 0)
	pos.y = math.max(pos.y, 0)

	g_window.move(pos)

	local maximized = g_settings.getBoolean("window-maximized", false)

	if maximized then
		g_window.maximize()
	end

	g_window.setTitle(g_app.getName())
	g_window.setIcon("/images/clienticon")

	if not g_crypt.setMachineUUID(g_settings.get("uuid")) then
		g_settings.set("uuid", g_crypt.getMachineUUID())
		g_settings.save()
	end
end

function terminate()
	disconnect(g_app, {
		onRun = startup,
		onExit = exit
	})
	disconnect(g_game, {
		onGameStart = onGameStart,
		onGameEnd = onGameEnd
	})
	g_settings.set("window-size", g_window.getUnmaximizedSize())
	g_settings.set("window-pos", g_window.getUnmaximizedPos())
	g_settings.set("window-maximized", g_window.isMaximized())
	
	-- ESSENCIAL: salva tudo no disco
	g_settings.save()
end


function exit()
	g_logger.info("Exiting application..")
end

function onGameStart()
	local player = g_game.getLocalPlayer()

	if not player then
		return
	end

	g_window.setTitle(g_app.getName() .. " - " .. player:getName())
end

function onGameEnd()
	g_window.setTitle(g_app.getName())
end
