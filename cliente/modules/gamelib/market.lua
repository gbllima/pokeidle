-- chunkname: @/modules/gamelib/market.lua

MarketOpcode = 88
MarketParse = {
	Open = 1,
	Message = 6,
	Item = 5,
	Historic = 4,
	Sales = 3,
	Offers = 2
}
MarketRequest = {
	AcceptOffer = 6,
	CreateOffer = 5,
	CancelOffer = 7,
	Item = 4,
	Historic = 3,
	Sales = 2,
	Offers = 1
}
MarketSortType = {
	Desc = 2,
	Asc = 1
}
MarketCategory = {
	Furnitures = 10,
	Helds = 9,
	Cards = 8,
	Pokemon = 7,
	Outfits = 6,
	Addons = 5,
	Coins = 4,
	Pokeballs = 3,
	Stones = 2,
	Items = 1,
	All = 0,
	Supplies = 11
}
MarketCategoryStrings = {
	[0] = "All",
	"Items",
	"Stones",
	"Pokeballs",
	"Coins",
	"Addons",
	"Outfits",
	"Pokemon",
	"Cards",
	"Helds",
	"Furnitures",
	"Supplies"
}
