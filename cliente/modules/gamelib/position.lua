-- chunkname: @/modules/gamelib/position.lua

Position = {}

function Position.equals(pos1, pos2)
	return pos1.x == pos2.x and pos1.y == pos2.y and pos1.z == pos2.z
end

function Position.greaterThan(pos1, pos2, orEqualTo)
	if orEqualTo then
		return pos1.x >= pos2.x or pos1.y >= pos2.y or pos1.z >= pos2.z
	else
		return pos1.x > pos2.x or pos1.y > pos2.y or pos1.z > pos2.z
	end
end

function Position.lessThan(pos1, pos2, orEqualTo)
	if orEqualTo then
		return pos1.x <= pos2.x or pos1.y <= pos2.y or pos1.z <= pos2.z
	else
		return pos1.x < pos2.x or pos1.y < pos2.y or pos1.z < pos2.z
	end
end

function Position.isInRange(pos1, pos2, xRange, yRange)
	return xRange >= math.abs(pos1.x - pos2.x) and yRange >= math.abs(pos1.y - pos2.y) and pos1.z == pos2.z
end

function Position.isValid(pos)
	return pos.x ~= 65535 or pos.y ~= 65535 or pos.z ~= 255
end

function Position.distance(pos1, pos2)
	return math.sqrt(math.pow(pos2.x - pos1.x, 2) + math.pow(pos2.y - pos1.y, 2))
end

function Position.manhattanDistance(pos1, pos2)
	return math.abs(pos2.x - pos1.x) + math.abs(pos2.y - pos1.y)
end

function Position.getAngle(fromPos, toPos)
	local deltaX = toPos.x - fromPos.x
	local deltaY = toPos.y - fromPos.y

	return (math.deg(math.atan2(-deltaY, -deltaX)) + 360 - 90) % 360
end

function Position.distanceBetween(pos1, pos2)
  return math.max(math.abs(pos1.x - pos2.x), math.abs(pos1.y - pos2.y))
end