-- chunkname: @/modules/game_analytics/utils.lua

function formatNumber(value)
	if value < 10000 then
		return value
	end

	local scales = {
		{
			suffix = "M",
			divisor = 1000000,
			threshold = 1000000
		},
		{
			suffix = "k",
			divisor = 1000,
			threshold = 1000
		}
	}

	for i, scale in ipairs(scales) do
		if value >= scale.threshold then
			local result = value / scale.divisor
			local intPart = math.floor(result)
			local decimalPart = math.floor((result - intPart) * 10)

			if decimalPart == 0 then
				return string.format("%d%s", intPart, scale.suffix)
			else
				return string.format("%d.%d%s", intPart, decimalPart, scale.suffix)
			end
		end
	end

	return value
end

function formatTime(seconds)
	local hour = math.floor(seconds / 3600)
	local minute = math.floor((seconds - hour * 3600) / 60)

	return string.format("%0.2d:%0.2d", hour, minute)
end
