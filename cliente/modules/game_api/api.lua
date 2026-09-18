-- chunkname: @/modules/game_api/api.lua

Api = {}
Api.__index = Api
Accounts = {}
Accounts.__index = Accounts
Pix = {}
Pix.__index = Pix

function Api.new()
	local data = {}

	setmetatable(data, Api)

	return data
end

function Api:send(url, data, callback)
	if not data.bearer then
		data.bearer = G.sessionKey
	end

	return HTTP.postJSON(G.host .. url, data, callback)
end

function Api:get(url, callback)
    local headers = {}
    local bearer = G.sessionKey or API_KEY[G.host]

    if bearer then
        headers["Authorization"] = "Bearer " .. bearer
    else
    end

    return HTTP.getJSON(G.host .. url, callback, headers)
end

local api = Api.new()

function Accounts.new()
	local data = {}

	setmetatable(data, Accounts)

	return data
end

function Accounts:active(code, callback)
	local data = {
		key = code
	}

	return api:send(API.ACTIVATION.CODE, data, callback)
end

function Accounts:sendCodeEmail(callback)
	local data = {
		email = G.accountEmail,
		bearer = API_KEY[G.host]
	}

	for k,v in pairs(data) do
		print(k, v)
	end

	return api:send(API.ACTIVATION.SEND_EMAIL, data, callback)
end


function Accounts:changeEmail(email, callback)
	local data = {
		newEmail = email
	}

	return api:send(API.EMAIL.CHANGE, data, callback)
end

function Accounts:cancelChangeEmail(callback)
	local data = {}

	return api:send(API.EMAIL.CHANGE_CANCEL, data, callback)
end

function Accounts:create(email, password, callback)
	local data = {
		email = email,
		password = password,
		bearer = API_KEY[G.host]
	}


	return api:send(API.ACCOUNTS.CREATE, data, callback)
end

function Accounts:createCharacter(name, gender, callback)
    local data = {
        name = name,
        accountEmail = G.accountEmail,
        sex = gender,
        bearer = API_KEY[G.host]
    }
    return api:send(API.CHARACTERS.CREATE, data, callback)
end


function Accounts:getCharacters(callback)
    local data = {
        bearer = API_KEY[G.host],
        accountEmail = G.accountEmail
    }

    return api:send(API.CHARACTERS.GET .. "?fetchCharacters=1", data, callback)
end


function Accounts:deleteCharacter(name, callback)
	local data = {
		name = name,
		bearer = API_KEY[G.host]
	}

	return api:send(API.CHARACTERS.DELETE, data, callback)
end


function Accounts:cancelDeleteCharacter(name, callback)
	local data = {
		name = name,
		bearer = API_KEY[G.host]
	}

	return api:send(API.CHARACTERS.DELETE_CANCEL, data, callback)
end

function Pix:cancelPayment(payment_id, callback)
	local data = {
		payment_id = payment_id,
		cancel = true,
		bearer = G.sessionKey
	}
	return api:send(API.PIX.DONATE, data, callback or function() end)
end



function Accounts:changePassword(oldPassword, newPassword, repeatPassword, callback)
	local data = {
		oldPassword = oldPassword,
		newPassword = newPassword,
		newPasswordRepeated = repeatPassword
	}

	return api:send(API.PASSWORD.CHANGE, data, callback)
end

function Accounts:recoverCodeEmail(email, callback)
	local data = {
		email = email,
		bearer = API_KEY[G.host]
	}

	return api:send(API.PASSWORD.SEND_RECOVER_CODE, data, callback)
end

function Accounts:changeRecoverPassword(email, code, newPassword, repeatPassword, callback)
	local data = {
		email = email,
		recoverCode = code,
		newPassword = newPassword,
		newPasswordRepeated = repeatPassword,
		bearer = API_KEY[G.host]
	}

	return api:send(API.PASSWORD.RECOVER, data, callback)
end

function Pix.new()
	local data = {}

	setmetatable(data, Pix)

	return data
end

function Pix:donate(cpf, amount, callback)
	local data = {
		cpf = cpf,
		amount = amount,
		bearer = API_KEY[G.host]
	}

	for k, v in pairs(data) do
	end

	local wrappedCallback = function(response, err)
		if err then
			return
		end

		for k, v in pairs(response) do
		end

		if callback then
			callback(response, err)
		end
	end

	return api:send(API.PIX.DONATE, data, wrappedCallback)
end

function Pix:checkPayment(payment_id, callback)
	local data = {
		check_payment = true,
		payment_id = payment_id,
		bearer = G.sessionKey
	}

	return api:send(API.PIX.DONATE, data, callback)
end
