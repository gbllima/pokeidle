-- chunkname: @/modules/game_accounts/accounts.lua

local accountPanel, activePanel, emailPanel, charPanel, waitPanel, deletePanel, cancelDeletePanel, changePasswordPanel, recoverPanel, termsPanel, accounts

local function onHTTPResult(data, err)
	hideWaitPanel()

	if not data then
		return "", false
	end

	if type(data.status) == "boolean" and data.status == false then
		return data.message or "Erro inesperado.", false
	end

	if type(data.status) == "number" and table.contains({401, 403, 409}, data.status) then
		return "Ocorreu um erro inesperado.\nPor favor, abra um ticket para entrar em contato com a equipe.", false
	end

	if data.errors then
		for i, errors in pairs(data.errors) do
			return table.concat(errors, ",\n"), false
		end
		return "", false
	end

	if data.message then
		return data.message, true
	end

	return "", false
end


local function onHTTPActive(data, err)
  local message, status = onHTTPResult(data, err)

  if not status and message:len() > 0 then
    displayInfoBox(tr("Warning"), message)
  end

  if status and message:len() > 0 then
    local display = displayInfoBox(tr("Verification account"), message)

    function display.onOk()
      hideActivePanel()
      modules.game_accounts.getCharacters()
    end
  end
end

local function onHTTPCodeActive(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		displayInfoBox(tr("Warning"), message)
	end

	if status and message:len() > 0 then
		displayInfoBox(tr("Verification account"), message)
	end
end

local function onHTTPChangeEmail(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		local display = displayInfoBox(tr("Warning"), message)

		display.onOk = hideEmailPanel
	end

	if status and message:len() > 0 then
		local display = displayInfoBox(tr("Change e-mail"), message)

		display.onOk = hideEmailPanel

		if message:find("canceled") then
			G.characterAccount.daysToEmailChange = nil
		else
			G.characterAccount.daysToEmailChange = 15
		end

		modules.client_options.enableAccountPanel()
	end
end

local function onHTTPCreate(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		local display = displayInfoBox(tr("Warning"), message)

		function display.onOk()
			accountPanel.window:show()
		end
	end

	if status and message:len() > 0 then
		local display = displayInfoBox(tr("Create account"), message)

		display.onOk = hideCreatePanel
	end
end

local function onHTTPCharacter(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		local display = displayInfoBox(tr("Warning"), message)

		function display.onOk()
			charPanel:show()
		end
	end

	if status and message:len() > 0 then
		local display = displayInfoBox(tr("Create character"), message)

		function display.onOk()
			hideCharPanel()
			getCharacters()
		end
	end
end

local function onHTTPDeleteCharacter(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		displayInfoBox(tr("Warning"), message)
	end

	if status and message:len() > 0 then
		displayInfoBox(tr("Delete character"), message)
		getCharacters()
	end
end

local function onHTTPCancelDeleteCharacter(data, err)

	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		displayInfoBox(tr("Warning"), message)
	end

	if status and message:len() > 0 then
		displayInfoBox(tr("Cancel delete character"), message)
		getCharacters()
	end
end


local function onHTTPChangePassword(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		local display = displayInfoBox(tr("Warning"), message)

		display.onOk = hidePasswordChangePanel
	end

	if status and message:len() > 0 then
		local display = displayInfoBox(tr("Change password"), message)

		display.onOk = hidePasswordChangePanel
	end
end

local function onHTTPRecoverAccount(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		local display = displayInfoBox(tr("Warning"), message)

		display.onOk = hideRecoverPanel
	end

	if status and message:len() > 0 then
		local display = displayInfoBox(tr("Recover account"), message)

		display.onOk = hideRecoverPanel
	end
end

local function onHTTPRecoverCodeAccount(data, err)
	local message, status = onHTTPResult(data, err)

	if not status and message:len() > 0 then
		displayInfoBox(tr("Warning"), message)
	end

	if status and message:len() > 0 then
		displayInfoBox(tr("Recover account"), message)
	end
end

local function onHTTPCharacters(data, err)

  if not data then
    return
  end

  for k, v in pairs(data) do
  end

  local characters = data.characters or data.body

  if not characters then
    return
  end

  local account = data.account or {
    status = 0,
    subStatus = 0,
    premDays = 0
  }

  G.characterAccount = account

  if account and account.emailActive ~= nil and not account.emailActive then
    return
  end

  modules.client_entergame.CharacterList.create(characters, account)
  modules.client_entergame.CharacterList.show()
end


function getCharacters()
	accounts:getCharacters(onHTTPCharacters)
end

function sendActive(key)
	accounts:active(key, onHTTPActive)
end

function sendCodeEmail()
	accounts:sendCodeEmail(onHTTPCodeActive)
end

function sendChangeEmail(email)
	accounts:changeEmail(email, onHTTPChangeEmail)
end

function sendCancelChangeEmail()
	accounts:cancelChangeEmail(onHTTPChangeEmail)
end

function sendCreate(email, password)
	accounts:create(email, password, onHTTPCreate)
end

function sendCreateCharacter(name, gender)
    accounts:createCharacter(name, gender, onHTTPCharacter)
end


function sendDeleteCharacter(name)
	accounts:deleteCharacter(name, onHTTPDeleteCharacter)
end

function sendCancelDeleteCharacter(name)
	accounts:cancelDeleteCharacter(name, onHTTPCancelDeleteCharacter)
end

function sendChangePassword(oldPassword, newPassword, repeatPassword)
	accounts:changePassword(oldPassword, newPassword, repeatPassword, onHTTPChangePassword)
end

function sendRecoverAccount(email, code, newPassword, repeatPassword)
	accounts:changeRecoverPassword(email, code, newPassword, repeatPassword, onHTTPRecoverAccount)
end

function sendRecoverCodeEmail(email)
	accounts:recoverCodeEmail(email, onHTTPRecoverCodeAccount)
end

local function hide(widget)
	if widget then
		widget:destroy()

		widget = nil
	end
end

local function show(ui, widget)
	hide(widget)

	return g_ui.createWidget(ui, rootWidget)
end

function init()
	g_ui.importStyle("ui/terms.otui")
	g_ui.importStyle("ui/changeEmail.otui")
	g_ui.importStyle("ui/activeAccount.otui")
	g_ui.importStyle("ui/createAccount.otui")
	g_ui.importStyle("ui/createCharacter.otui")
	g_ui.importStyle("ui/deleteCharacter.otui")
	g_ui.importStyle("ui/changePassword.otui")
	g_ui.importStyle("ui/recoverAccount.otui")

	accounts = modules.game_api.Accounts.new()
end

function terminate()
	for i, widget in pairs({
		activePanel,
		emailPanel,
		accountPanel,
		waitPanel,
		charPanel,
		deletePanel,
		cancelDeletePanel,
		changePasswordPanel,
		recoverPanel,
		termsPanel
	}) do
		hide(widget)
	end
end

function showActivePanel()
	activePanel = show("AccountValidationPanel", activePanel)

	local childrens = activePanel.window.panel:getChildren()
	local panel = activePanel.window.panel
	local sendButton = activePanel.window.sendButton

	function activePanel.pasteCode()
		local code = g_window.getClipboardText()

		for i, input in ipairs(childrens) do
			scheduleEvent(function()
				input:setText(string.sub(code, i, i))
			end, i * #code)
		end
	end

	g_keyboard.bindKeyDown("Ctrl+V", activePanel.pasteCode, activePanel)

	for i, input in ipairs(childrens) do
		if i > 1 then
			input:disable()
		end

		function input:onTextChange(text)
			local prevInput = panel:getChildBefore(self)
			local nextInput = panel:getChildAfter(self)
			local textLength = text:trim():len()

			if textLength > 1 then
				self:clearText()

				return
			end

			if nextInput and nextInput:isDisabled() and textLength > 0 then
				nextInput:enable()
				scheduleEvent(function()
					nextInput:focus()
					nextInput:setCursorPos(-1)
				end, 30)
			end

			local enableSendButton = i == #childrens and self:isEnabled() and textLength > 0

			sendButton:setEnabled(enableSendButton)
		end

		function input:onKeyUp(keyCode)
			if keyCode ~= KeyBackspace then
				return
			end

			for j, input2 in ipairs(childrens) do
				local prevInput = panel:getChildBefore(self)

				if j >= i and prevInput then
					input2:disable()
					input2:clearText()
					scheduleEvent(function()
						prevInput:focus()
						prevInput:setCursorPos(-1)
					end, 30)
				end
			end
		end
	end

	panel:focusChild(childrens[1])
end

function showEmailPanel()
	emailPanel = show("AccountChangeEmailPanel", emailPanel)
end

function showAccountPanel()
	accountPanel = show("AccountCreatePanel", accountPanel)

	modules.client_entergame.EnterGame.hide()
end

function showWaitPanel()
	waitPanel = show("WaitPanel", waitPanel)
end

function showCharPanel()
	charPanel = show("CreateCharacterWindow", charPanel)

	hide(genderGroup)

	genderGroup = UIRadioGroup.create()

	for i, panel in pairs(charPanel.genderPanel:getChildren()) do
		genderGroup:addWidget(panel)
	end

	-- charPanel.worlds:clear()

	-- for i, world in pairs(G.worlds) do
	-- 	charPanel.worlds:addOption(world.name, world.id, nil, world.new and "/images/game/icons/newserv")
	-- end

	modules.client_entergame.CharacterList.hide()
	genderGroup:selectWidget(genderGroup:getFirstWidget())
end

function showDeletePanel(name)
	deletePanel = show("DeleteCharacterWindow", deletePanel)

	function deletePanel.confirmButton.onClick()
		hideDeletePanel()
		sendDeleteCharacter(name)
	end
end

function showCancelDeletePanel(name, dayToDelete)
	cancelDeletePanel = show("CancelCharacterDeletionWindow", cancelDeletePanel)

	cancelDeletePanel.dayLabel:setText(tr("Remain %d days for your character to be deleted", dayToDelete))

	function cancelDeletePanel.confirmButton.onClick()
		hideCancelDeletePanel()
		sendCancelDeleteCharacter(name)
	end
end

function showPasswordPanel()
	changePasswordPanel = show("ChangePasswordPanel", changePasswordPanel)
end

function showRecoverPanel()
	recoverPanel = show("RecoverAccountPanel", recoverPanel)
end

function showTermsPanel()
	termsPanel = show("TermRules", termsPanel)

	for i, value in pairs(TERMSANDRULES) do
		if value.title then
			local title = g_ui.createWidget("LabelTitleTermRules", termsPanel.list)

			title:setText(value.title)
		end

		if value.text then
			local text = g_ui.createWidget("LabelBodyTermRules", termsPanel.list)

			text:setText(value.text)
		end
	end
end

function hideActivePanel()
	hide(activePanel)
	g_keyboard.bindKeyDown("Ctrl+V", activePanel.pasteCode, activePanel)
end

function hideEmailPanel()
	hideWaitPanel()
	hide(emailPanel)
end

function hideCreatePanel()
	hideWaitPanel()
	hideTermsPanel()
	hide(accountPanel)
	modules.client_entergame.EnterGame.show()
end

function hideWaitPanel()
	hide(waitPanel)
end

function hideCharPanel()
	hide(charPanel)
	modules.client_entergame.CharacterList.show()
end

function hideDeletePanel()
	hide(deletePanel)
end

function hideCancelDeletePanel()
	hide(cancelDeletePanel)
end

function hidePasswordChangePanel()
	hideWaitPanel()
	hide(changePasswordPanel)
end

function hideRecoverPanel()
	hide(recoverPanel)
end

function hideTermsPanel()
	hide(termsPanel)
end

function onChangeEmail()
	if onInputEmail(emailPanel.window.emailInput) then
		local function onConfirm()
			showWaitPanel()
			sendChangeEmail(emailPanel.window.emailInput:getText())
		end

		local function onCancel()
			emailPanel.window:show()
		end

		emailPanel.window:hide()
		displayConfirmBox(tr("Change e-mail"), tr("Voc\xEA realmente deseja solicitar a altera\xE7\xE3o de e-mail?"), onConfirm, onCancel)
	end
end

function onCancelChangeEmail()
	if not G.characterAccount.daysToEmailChange then
		return displayInfoBox(tr("Cancel change e-mail"), tr("Voc\xEA n\xE3o pode pedir o cancelamento da\ntroca de e-mail, pois nenhuma altera\xE7\xE3o foi solicitada."))
	end

	displayConfirmBox(tr("Cancel change e-mail"), tr("Voc\xEA realmente deseja cancelar a troca de e-mail?"), sendCancelChangeEmail)
end

function onActive()
	local code = ""

	for i, input in ipairs(activePanel.window.panel:getChildren()) do
		code = code .. input:getText()
	end

	if code:len() > 0 then
		sendActive(code)
	end
end

function onCodeEmail()
	local display = displayInfoBox(tr("C\xF3digo reenviado"), tr("Um c\xF3digo foi enviado para o seu e-mail. O c\xF3digo \xE9\nv\xE1lido por apenas 5 minutos."))

	local function onResendCode()
		local params = {
			onStart = function(cooldown)
				activePanel.window.timerLabel:disable()

				return true
			end,
			onExecute = function(cooldown)
				if activePanel.window then
					activePanel.window.timerLabel:setText(tr("Enviar c\xF3digo novamente em %s", formatTime(cooldown)))
				end

				return true
			end,
			onEnd = function(cooldown)
				activePanel.window.timerLabel:enable()
				activePanel.window.timerLabel:setText(tr("Reenviar c\xF3digo"))

				return true
			end
		}

		g_effects.onCooldown(activePanel, 120, params)
	end

	local function onOk()
		onResendCode()
		sendCodeEmail()
		activePanel.window:show()
	end

	display.onOk = onOk

	activePanel.window:hide()
end

function onCreate()
	if not accountPanel.window.acceptTerm:isChecked() then
		return displayInfoBox(tr("Warning"), tr("Primeiro Voc\xEA precisa aceitar o termos e regras."))
	end

	local canCreate = onInputEmail(accountPanel.window.emailInput) and onInputPassword(accountPanel.window.passwordInput) and onInputConfirmEmail(accountPanel.window.emailInput, accountPanel.window.confirmEmailInput) and onInputConfirmPassword(accountPanel.window.passwordInput, accountPanel.window.confirmPasswordInput)

	if canCreate then
		showWaitPanel()
		accountPanel.window:hide()
		sendCreate(accountPanel.window.emailInput:getText(), accountPanel.window.passwordInput:getText())
	end
end

function onCreateCharacter()
  if onInputName(charPanel.nameInput) then
    showWaitPanel()
    charPanel:hide()
    sendCreateCharacter(
      charPanel.nameInput:getText(),
      genderGroup:getSelectedWidget():getId()
    )
  end
end


function onChangePassword()
	local canChange = onInputPassword(changePasswordPanel.window.passwordInput) and onInputConfirmPassword(changePasswordPanel.window.passwordInput, changePasswordPanel.window.confirmPasswordInput)

	if canChange then
		local function onConfirm()
			showWaitPanel()
			sendChangePassword(changePasswordPanel.window.oldPasswordInput:getText(), changePasswordPanel.window.passwordInput:getText(), changePasswordPanel.window.confirmPasswordInput:getText())
		end

		local function onCancel()
			changePasswordPanel.window:show()
		end

		changePasswordPanel.window:hide()
		displayConfirmBox(tr("Change password"), tr("Voc\xEA realmente deseja alterar o password?"), onConfirm, onCancel)
	end
end

function onSendRecoverCodeEmail()
	if not onInputEmail(recoverPanel.windowEmail.emailInput) then
		return
	end

	local display = displayInfoBox(tr("C\xF3digo reenviado"), tr("Um c\xF3digo foi enviado para o seu e-mail. O c\xF3digo \xE9\nv\xE1lido por apenas 5 minutos."))

	local function onOk()
		recoverPanel.window:show()
		sendRecoverCodeEmail(recoverPanel.windowEmail.emailInput:getText())
		recoverPanel.window.emailInput:setText(recoverPanel.windowEmail.emailInput:getText())
	end

	display.onOk = onOk

	recoverPanel.windowEmail:hide()
end

function onRecoverCodeEmail()
	if not onInputEmail(recoverPanel.window.emailInput) then
		return
	end

	local display = displayInfoBox(tr("C\xF3digo reenviado"), tr("Um c\xF3digo foi enviado para o seu e-mail. O c\xF3digo \xE9\nv\xE1lido por apenas 5 minutos."))

	local function onResendCode()
		local params = {
			onStart = function(cooldown)
				recoverPanel.window.timerLabel:disable()

				return true
			end,
			onExecute = function(cooldown)
				if recoverPanel and recoverPanel.window then
					recoverPanel.window.timerLabel:setText(tr("Enviar c\xF3digo novamente em %s", formatTime(cooldown)))
				end

				return true
			end,
			onEnd = function(cooldown)
				if recoverPanel and recoverPanel.window then
					recoverPanel.window.timerLabel:enable()
					recoverPanel.window.timerLabel:setText(tr("Enviar c\xF3digo por e-mail"))
				end

				return true
			end
		}

		g_effects.onCooldown(recoverPanel, 60, params)
	end

	local function onOk()
		onResendCode()
		recoverPanel.window:show()
		sendRecoverCodeEmail(recoverPanel.window.emailInput:getText())
	end

	display.onOk = onOk

	recoverPanel.window:hide()
end

function onConfirmRecoverAccount()
	local canRecover = onInputEmail(recoverPanel.window.emailInput) and onInputRequired(recoverPanel.window.codeInput) and onInputPassword(recoverPanel.window.passwordInput) and onInputConfirmPassword(recoverPanel.window.passwordInput, recoverPanel.window.confirmPasswordInput)

	if canRecover then
		sendRecoverAccount(recoverPanel.window.emailInput:getText(), recoverPanel.window.codeInput:getText(), recoverPanel.window.passwordInput:getText(), recoverPanel.window.confirmPasswordInput:getText())
	end
end
