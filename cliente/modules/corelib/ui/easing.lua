-- chunkname: @/modules/corelib/ui/easing.lua

Easing = {}

function Easing.easeOutBack(t, b, c, d)
	local s = 1.70158

	t = t / d - 1

	return c * (t * t * ((s + 1) * t + s) + 1) + b
end

function Easing.easeOut(t, b, c, d)
	t = t / d

	return -c * t * (t - 2) + b
end

function Easing.easeIn(t, b, c, d)
	t = t / d

	return c * t * t + b
end

function Easing.linear(t, b, c, d)
	return c * t / d + b
end

function Easing.easeInQuad(t, b, c, d)
	t = t / d

	return c * t * t + b
end

function Easing.easeOutQuad(t, b, c, d)
	t = t / d

	return -c * t * (t - 2) + b
end

function Easing.easeInOutQuad(t, b, c, d)
	t = t / (d / 2)

	if t < 1 then
		return c / 2 * t * t + b
	end

	t = t - 1

	return -c / 2 * (t * (t - 2) - 1) + b
end

function Easing.easeInCubic(t, b, c, d)
	t = t / d

	return c * t * t * t + b
end

function Easing.easeOutCubic(t, b, c, d)
	t = t / d - 1

	return c * (t * t * t + 1) + b
end

function Easing.easeInOutCubic(t, b, c, d)
	t = t / (d / 2)

	if t < 1 then
		return c / 2 * t * t * t + b
	end

	t = t - 2

	return c / 2 * (t * t * t + 2) + b
end

function Easing.easeInBack(t, b, c, d)
	local s = 1.70158

	t = t / d

	return c * t * t * ((s + 1) * t - s) + b
end

function Easing.easeOutBack(t, b, c, d)
	local s = 1.70158

	t = t / d - 1

	return c * (t * t * ((s + 1) * t + s) + 1) + b
end

function Easing.easeInOutBack(t, b, c, d)
	local s = 2.5949095

	t = t / (d / 2)

	if t < 1 then
		return c / 2 * (t * t * ((s + 1) * t - s)) + b
	end

	t = t - 2

	return c / 2 * (t * t * ((s + 1) * t + s) + 2) + b
end
