function init()
end

function terminate()
end

function sendRequest(type)
	g_game.getProtocolGame():sendExtendedOpcode(1, type)
end

function tryPost(postData)
	local url = "http://148.230.76.214:5000/post-endpoint"
	local function callback(data, err)
	    if err then
	        print("Error: ", err)
	    else
			print(data)
	    end
	end
	HTTP.postJSON(url, postData, callback)
end