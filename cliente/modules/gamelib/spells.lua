-- chunkname: @/modules/gamelib/spells.lua

SpelllistSettings = {
	Default = {
		spellListWidth = 210,
		iconFile = "/images/game/spells/defaultspells",
		spellWindowWidth = 550,
		iconSize = {
			width = 32,
			height = 32
		},
		spellOrder = {
			"Animate Dead",
			"Annihilation",
			"Avalanche",
			"Berserk",
			"Blood Rage",
			"Brutal Strike",
			"Cancel Invisibility",
			"Challenge",
			"Chameleon",
			"Charge",
			"Conjure Arrow",
			"Conjure Bolt",
			"Conjure Explosive Arrow",
			"Conjure Piercing Bolt",
			"Conjure Poisoned Arrow",
			"Conjure Power Bolt",
			"Conjure Sniper Arrow",
			"Convince Creature",
			"Creature Illusion",
			"Cure Bleeding",
			"Cure Burning",
			"Cure Curse",
			"Cure Electrification",
			"Cure Poison",
			"Cure Poison Rune",
			"Curse",
			"Death Strike",
			"Desintegrate",
			"Destroy Field",
			"Divine Caldera",
			"Divine Healing",
			"Divine Missile",
			"Electrify",
			"Enchant Party",
			"Enchant Spear",
			"Enchant Staff",
			"Energy Beam",
			"Energy Field",
			"Energy Strike",
			"Energy Wall",
			"Energy Wave",
			"Energybomb",
			"Envenom",
			"Eternal Winter",
			"Ethereal Spear",
			"Explosion",
			"Fierce Berserk",
			"Find Person",
			"Fire Field",
			"Fire Wall",
			"Fire Wave",
			"Fireball",
			"Firebomb",
			"Flame Strike",
			"Food",
			"Front Sweep",
			"Great Energy Beam",
			"Great Fireball",
			"Great Light",
			"Groundshaker",
			"Haste",
			"Heal Friend",
			"Heal Party",
			"Heavy Magic Missile",
			"Hells Core",
			"Holy Flash",
			"Holy Missile",
			"Ice Strike",
			"Ice Wave",
			"Icicle",
			"Ignite",
			"Inflict Wound",
			"Intense Healing",
			"Intense Healing Rune",
			"Intense Recovery",
			"Intense Wound Cleansing",
			"Invisibility",
			"Levitate",
			"Light",
			"Light Healing",
			"Light Magic Missile",
			"Lightning",
			"Magic Rope",
			"Magic Shield",
			"Magic Wall",
			"Mass Healing",
			"Paralyze",
			"Physical Strike",
			"Poison Bomb",
			"Poison Field",
			"Poison Wall",
			"Protect Party",
			"Protector",
			"Rage of the Skies",
			"Recovery",
			"Salvation",
			"Sharpshooter",
			"Soulfire",
			"Stalagmite",
			"Stone Shower",
			"Strong Energy Strike",
			"Strong Ethereal Spear",
			"Strong Flame Strike",
			"Strong Haste",
			"Strong Ice Strike",
			"Strong Ice Wave",
			"Strong Terra Strike",
			"Sudden Death",
			"Summon Creature",
			"Swift Foot",
			"Terra Strike",
			"Terra Wave",
			"Thunderstorm",
			"Train Party",
			"Ultimate Energy Strike",
			"Ultimate Flame Strike",
			"Ultimate Healing",
			"Ultimate Healing Rune",
			"Ultimate Ice Strike",
			"Ultimate Light",
			"Ultimate Terra Strike",
			"Whirlwind Throw",
			"Wild Growth",
			"Wound Cleansing",
			"Wrath of Nature"
		}
	}
}
SpellInfo = {
	Default = {
		["Death Strike"] = {
			id = 87,
			icon = "deathstrike",
			premium = true,
			level = 16,
			exhaustion = 2000,
			words = "exori mort",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Flame Strike"] = {
			id = 89,
			icon = "flamestrike",
			premium = true,
			level = 14,
			exhaustion = 2000,
			words = "exori flam",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Strong Flame Strike"] = {
			id = 150,
			icon = "strongflamestrike",
			premium = true,
			level = 70,
			exhaustion = 8000,
			words = "exori gran flam",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[1] = 2000,
				[4] = 8000
			},
			vocations = {
				1,
				5
			}
		},
		["Ultimate Flame Strike"] = {
			id = 154,
			icon = "ultimateflamestrike",
			premium = true,
			level = 90,
			exhaustion = 30000,
			words = "exori max flam",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[1] = 4000
			},
			vocations = {
				1,
				5
			}
		},
		["Energy Strike"] = {
			id = 88,
			icon = "energystrike",
			premium = true,
			level = 12,
			exhaustion = 2000,
			words = "exori vis",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Strong Energy Strike"] = {
			id = 151,
			icon = "strongenergystrike",
			premium = true,
			level = 80,
			exhaustion = 8000,
			words = "exori gran vis",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[1] = 2000,
				[4] = 8000
			},
			vocations = {
				1,
				5
			}
		},
		["Ultimate Energy Strike"] = {
			id = 155,
			icon = "ultimateenergystrike",
			premium = true,
			level = 100,
			exhaustion = 30000,
			words = "exori max vis",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[1] = 4000
			},
			vocations = {
				1,
				5
			}
		},
		["Whirlwind Throw"] = {
			id = 107,
			icon = "whirlwindthrow",
			premium = true,
			level = 28,
			exhaustion = 6000,
			words = "exori hur",
			type = "Instant",
			soul = 0,
			mana = 40,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Fire Wave"] = {
			id = 19,
			icon = "firewave",
			premium = false,
			level = 18,
			exhaustion = 4000,
			words = "exevo flam hur",
			type = "Instant",
			soul = 0,
			mana = 25,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Ethereal Spear"] = {
			id = 111,
			icon = "etherealspear",
			premium = true,
			level = 23,
			exhaustion = 2000,
			words = "exori con",
			type = "Instant",
			soul = 0,
			mana = 25,
			group = {
				[1] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Strong Ethereal Spear"] = {
			id = 57,
			icon = "strongetherealspear",
			premium = true,
			level = 90,
			exhaustion = 8000,
			words = "exori gran con",
			type = "Instant",
			soul = 0,
			mana = 55,
			group = {
				[1] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Energy Beam"] = {
			id = 22,
			icon = "energybeam",
			premium = false,
			level = 23,
			exhaustion = 4000,
			words = "exevo vis lux",
			type = "Instant",
			soul = 0,
			mana = 40,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Great Energy Beam"] = {
			id = 23,
			icon = "greatenergybeam",
			premium = false,
			level = 29,
			exhaustion = 6000,
			words = "exevo gran vis lux",
			type = "Instant",
			soul = 0,
			mana = 110,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		Groundshaker = {
			id = 106,
			icon = "groundshaker",
			premium = true,
			level = 33,
			exhaustion = 8000,
			words = "exori mas",
			type = "Instant",
			soul = 0,
			mana = 160,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		Berserk = {
			id = 80,
			icon = "berserk",
			premium = true,
			level = 35,
			exhaustion = 4000,
			words = "exori",
			type = "Instant",
			soul = 0,
			mana = 115,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		Annihilation = {
			id = 62,
			icon = "annihilation",
			premium = true,
			level = 110,
			exhaustion = 30000,
			words = "exori gran ico",
			type = "Instant",
			soul = 0,
			mana = 300,
			group = {
				[1] = 4000
			},
			vocations = {
				4,
				8
			}
		},
		["Brutal Strike"] = {
			id = 61,
			icon = "brutalstrike",
			premium = true,
			level = 16,
			exhaustion = 6000,
			words = "exori ico",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Front Sweep"] = {
			id = 59,
			icon = "frontsweep",
			premium = true,
			level = 70,
			exhaustion = 6000,
			words = "exori min",
			type = "Instant",
			soul = 0,
			mana = 200,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Inflict Wound"] = {
			id = 141,
			icon = "inflictwound",
			premium = true,
			level = 40,
			exhaustion = 30000,
			words = "utori kor",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		Ignite = {
			id = 138,
			icon = "ignite",
			premium = true,
			level = 26,
			exhaustion = 30000,
			words = "utori flam",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		Lightning = {
			id = 149,
			icon = "lightning",
			premium = true,
			level = 55,
			exhaustion = 8000,
			words = "exori amp vis",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[1] = 2000,
				[4] = 8000
			},
			vocations = {
				1,
				5
			}
		},
		Curse = {
			id = 139,
			icon = "curse",
			premium = true,
			level = 75,
			exhaustion = 50000,
			words = "utori mort",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		Electrify = {
			id = 140,
			icon = "electrify",
			premium = true,
			level = 34,
			exhaustion = 30000,
			words = "utori vis",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Energy Wave"] = {
			id = 13,
			icon = "energywave",
			premium = false,
			level = 38,
			exhaustion = 8000,
			words = "exevo vis hur",
			type = "Instant",
			soul = 0,
			mana = 170,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Rage of the Skies"] = {
			id = 119,
			icon = "rageoftheskies",
			premium = true,
			level = 55,
			exhaustion = 40000,
			words = "exevo gran mas vis",
			type = "Instant",
			soul = 0,
			mana = 600,
			group = {
				[1] = 4000
			},
			vocations = {
				1,
				5
			}
		},
		["Fierce Berserk"] = {
			id = 105,
			icon = "fierceberserk",
			premium = true,
			level = 90,
			exhaustion = 6000,
			words = "exori gran",
			type = "Instant",
			soul = 0,
			mana = 340,
			group = {
				[1] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Hells Core"] = {
			id = 24,
			icon = "hellscore",
			premium = true,
			level = 60,
			exhaustion = 40000,
			words = "exevo gran mas flam",
			type = "Instant",
			soul = 0,
			mana = 1100,
			group = {
				[1] = 4000
			},
			vocations = {
				1,
				5
			}
		},
		["Holy Flash"] = {
			id = 143,
			icon = "holyflash",
			premium = true,
			level = 70,
			exhaustion = 40000,
			words = "utori san",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Divine Missile"] = {
			id = 122,
			icon = "divinemissile",
			premium = true,
			level = 40,
			exhaustion = 2000,
			words = "exori san",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Divine Caldera"] = {
			id = 124,
			icon = "divinecaldera",
			premium = true,
			level = 50,
			exhaustion = 4000,
			words = "exevo mas san",
			type = "Instant",
			soul = 0,
			mana = 160,
			group = {
				[1] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Physical Strike"] = {
			id = 148,
			icon = "physicalstrike",
			premium = true,
			level = 16,
			exhaustion = 2000,
			words = "exori moe ico",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Eternal Winter"] = {
			id = 118,
			icon = "eternalwinter",
			premium = true,
			level = 60,
			exhaustion = 40000,
			words = "exevo gran mas frigo",
			type = "Instant",
			soul = 0,
			mana = 1050,
			group = {
				[1] = 4000
			},
			vocations = {
				2,
				6
			}
		},
		["Ice Strike"] = {
			id = 112,
			icon = "icestrike",
			premium = true,
			level = 15,
			exhaustion = 2000,
			words = "exori frigo",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5,
				2,
				6
			}
		},
		["Strong Ice Strike"] = {
			id = 152,
			icon = "strongicestrike",
			premium = true,
			level = 80,
			exhaustion = 8000,
			words = "exori gran frigo",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[1] = 2000,
				[4] = 8000
			},
			vocations = {
				2,
				6
			}
		},
		["Ultimate Ice Strike"] = {
			id = 156,
			icon = "ultimateicestrike",
			premium = true,
			level = 100,
			exhaustion = 30000,
			words = "exori max frigo",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[1] = 4000
			},
			vocations = {
				2,
				6
			}
		},
		["Ice Wave"] = {
			id = 121,
			icon = "icewave",
			premium = false,
			level = 18,
			exhaustion = 4000,
			words = "exevo frigo hur",
			type = "Instant",
			soul = 0,
			mana = 25,
			group = {
				[1] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Strong Ice Wave"] = {
			id = 43,
			icon = "strongicewave",
			premium = true,
			level = 40,
			exhaustion = 8000,
			words = "exevo gran frigo hur",
			type = "Instant",
			soul = 0,
			mana = 170,
			group = {
				[1] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Envenom = {
			id = 142,
			icon = "envenom",
			premium = true,
			level = 50,
			exhaustion = 40000,
			words = "utori pox",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[1] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Terra Strike"] = {
			id = 113,
			icon = "terrastrike",
			premium = true,
			level = 13,
			exhaustion = 2000,
			words = "exori tera",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5,
				2,
				6
			}
		},
		["Strong Terra Strike"] = {
			id = 153,
			icon = "strongterrastrike",
			premium = true,
			level = 70,
			exhaustion = 8000,
			words = "exori gran tera",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[1] = 2000,
				[4] = 8000
			},
			vocations = {
				2,
				6
			}
		},
		["Ultimate Terra Strike"] = {
			id = 157,
			icon = "ultimateterrastrike",
			premium = true,
			level = 90,
			exhaustion = 30000,
			words = "exori max tera",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[1] = 4000
			},
			vocations = {
				2,
				6
			}
		},
		["Terra Wave"] = {
			id = 120,
			icon = "terrawave",
			premium = false,
			level = 38,
			exhaustion = 4000,
			words = "exevo tera hur",
			type = "Instant",
			soul = 0,
			mana = 210,
			group = {
				[1] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Wrath of Nature"] = {
			id = 56,
			icon = "wrathofnature",
			premium = true,
			level = 55,
			exhaustion = 40000,
			words = "exevo gran mas tera",
			type = "Instant",
			soul = 0,
			mana = 700,
			group = {
				[1] = 4000
			},
			vocations = {
				2,
				6
			}
		},
		["Light Healing"] = {
			id = 1,
			icon = "lighthealing",
			premium = false,
			level = 9,
			exhaustion = 1000,
			words = "exura",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[2] = 1000
			},
			vocations = {
				1,
				2,
				3,
				5,
				6,
				7
			}
		},
		["Wound Cleansing"] = {
			id = 123,
			icon = "woundcleansing",
			premium = false,
			level = 10,
			exhaustion = 1000,
			words = "exura ico",
			type = "Instant",
			soul = 0,
			mana = 40,
			group = {
				[2] = 1000
			},
			vocations = {
				4,
				8
			}
		},
		["Intense Wound Cleansing"] = {
			id = 158,
			icon = "intensewoundcleansing",
			premium = true,
			level = 80,
			exhaustion = 600000,
			words = "exura gran ico",
			type = "Instant",
			soul = 0,
			mana = 200,
			group = {
				[2] = 1000
			},
			vocations = {
				4,
				8
			}
		},
		["Cure Bleeding"] = {
			id = 144,
			icon = "curebleeding",
			premium = true,
			level = 30,
			exhaustion = 6000,
			words = "exana kor",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[2] = 1000
			},
			vocations = {
				4,
				8
			}
		},
		["Cure Electrification"] = {
			id = 146,
			icon = "curseelectrification",
			premium = true,
			level = 22,
			exhaustion = 6000,
			words = "exana vis",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[2] = 1000
			},
			vocations = {
				2,
				6
			}
		},
		["Cure Poison"] = {
			id = 29,
			icon = "curepoison",
			premium = false,
			level = 10,
			exhaustion = 6000,
			words = "exana pox",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[2] = 1000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		["Cure Burning"] = {
			id = 145,
			icon = "cureburning",
			premium = true,
			level = 30,
			exhaustion = 6000,
			words = "exana flam",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[2] = 1000
			},
			vocations = {
				2,
				6
			}
		},
		["Cure Curse"] = {
			id = 147,
			icon = "curecurse",
			premium = true,
			level = 80,
			exhaustion = 6000,
			words = "exana mort",
			type = "Instant",
			soul = 0,
			mana = 40,
			group = {
				[2] = 1000
			},
			vocations = {
				3,
				7
			}
		},
		Recovery = {
			id = 159,
			icon = "recovery",
			premium = true,
			level = 50,
			exhaustion = 60000,
			words = "utura",
			type = "Instant",
			soul = 0,
			mana = 75,
			group = {
				[2] = 1000
			},
			vocations = {
				4,
				8,
				3,
				7
			}
		},
		["Intense Recovery"] = {
			id = 160,
			icon = "intenserecovery",
			premium = true,
			level = 100,
			exhaustion = 60000,
			words = "utura gran",
			type = "Instant",
			soul = 0,
			mana = 165,
			group = {
				[2] = 1000
			},
			vocations = {
				4,
				8,
				3,
				7
			}
		},
		Salvation = {
			id = 36,
			icon = "salvation",
			premium = true,
			level = 60,
			exhaustion = 1000,
			words = "exura gran san",
			type = "Instant",
			soul = 0,
			mana = 210,
			group = {
				[2] = 1000
			},
			vocations = {
				3,
				7
			}
		},
		["Intense Healing"] = {
			id = 2,
			icon = "intensehealing",
			premium = false,
			level = 20,
			exhaustion = 1000,
			words = "exura gran",
			type = "Instant",
			soul = 0,
			mana = 70,
			group = {
				[2] = 1000
			},
			vocations = {
				1,
				2,
				3,
				5,
				6,
				7
			}
		},
		["Heal Friend"] = {
			id = 84,
			icon = "healfriend",
			premium = true,
			level = 18,
			exhaustion = 1000,
			words = "exura sio",
			type = "Instant",
			soul = 0,
			mana = 140,
			group = {
				[2] = 1000
			},
			vocations = {
				2,
				6
			}
		},
		["Ultimate Healing"] = {
			id = 3,
			icon = "ultimatehealing",
			premium = false,
			level = 30,
			exhaustion = 1000,
			words = "exura vita",
			type = "Instant",
			soul = 0,
			mana = 160,
			group = {
				[2] = 1000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Mass Healing"] = {
			id = 82,
			icon = "masshealing",
			premium = true,
			level = 36,
			exhaustion = 2000,
			words = "exura gran mas res",
			type = "Instant",
			soul = 0,
			mana = 150,
			group = {
				[2] = 1000
			},
			vocations = {
				2,
				6
			}
		},
		["Divine Healing"] = {
			id = 125,
			icon = "divinehealing",
			premium = false,
			level = 35,
			exhaustion = 1000,
			words = "exura san",
			type = "Instant",
			soul = 0,
			mana = 160,
			group = {
				[2] = 1000
			},
			vocations = {
				3,
				7
			}
		},
		Light = {
			id = 10,
			icon = "light",
			premium = false,
			level = 8,
			exhaustion = 2000,
			words = "utevo lux",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		["Find Person"] = {
			id = 20,
			icon = "findperson",
			premium = false,
			level = 8,
			exhaustion = 2000,
			words = "exiva",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		["Magic Rope"] = {
			id = 76,
			icon = "magicrope",
			premium = true,
			level = 9,
			exhaustion = 2000,
			words = "exani tera",
			type = "Instant",
			soul = 0,
			mana = 20,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		Levitate = {
			id = 81,
			icon = "levitate",
			premium = true,
			level = 12,
			exhaustion = 2000,
			words = "exani hur",
			type = "Instant",
			soul = 0,
			mana = 50,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		["Great Light"] = {
			id = 11,
			icon = "greatlight",
			premium = false,
			level = 13,
			exhaustion = 2000,
			words = "utevo gran lux",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		["Magic Shield"] = {
			id = 44,
			icon = "magicshield",
			premium = false,
			level = 14,
			exhaustion = 2000,
			words = "utamo vita",
			type = "Instant",
			soul = 0,
			mana = 50,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Haste = {
			id = 6,
			icon = "haste",
			premium = true,
			level = 14,
			exhaustion = 2000,
			words = "utani hur",
			type = "Instant",
			soul = 0,
			mana = 60,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				4,
				5,
				6,
				7,
				8
			}
		},
		Charge = {
			id = 131,
			icon = "charge",
			premium = true,
			level = 25,
			exhaustion = 2000,
			words = "utani tempo hur",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[3] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Swift Foot"] = {
			id = 134,
			icon = "swiftfoot",
			premium = true,
			level = 55,
			exhaustion = 2000,
			words = "utamo tempo san",
			type = "Instant",
			soul = 0,
			mana = 400,
			group = {
				[1] = 10000,
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		Challenge = {
			id = 93,
			icon = "challenge",
			premium = true,
			level = 20,
			exhaustion = 2000,
			words = "exeta res",
			type = "Instant",
			soul = 0,
			mana = 30,
			group = {
				[3] = 2000
			},
			vocations = {
				8
			}
		},
		["Strong Haste"] = {
			id = 39,
			icon = "stronghaste",
			premium = true,
			level = 20,
			exhaustion = 2000,
			words = "utani gran hur",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Creature Illusion"] = {
			id = 38,
			icon = "creatureillusion",
			premium = false,
			level = 23,
			exhaustion = 2000,
			words = "utevo res ina",
			type = "Instant",
			soul = 0,
			mana = 100,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Ultimate Light"] = {
			id = 75,
			icon = "ultimatelight",
			premium = true,
			level = 26,
			exhaustion = 2000,
			words = "utevo vis lux",
			type = "Instant",
			soul = 0,
			mana = 140,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Cancel Invisibility"] = {
			id = 90,
			icon = "cancelinvisibility",
			premium = true,
			level = 26,
			exhaustion = 2000,
			words = "exana ina",
			type = "Instant",
			soul = 0,
			mana = 200,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		Invisibility = {
			id = 45,
			icon = "invisible",
			premium = false,
			level = 35,
			exhaustion = 2000,
			words = "utana vid",
			type = "Instant",
			soul = 0,
			mana = 440,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Sharpshooter = {
			id = 135,
			icon = "sharpshooter",
			premium = true,
			level = 60,
			exhaustion = 2000,
			words = "utito tempo san",
			type = "Instant",
			soul = 0,
			mana = 450,
			group = {
				[2] = 10000,
				[3] = 10000
			},
			vocations = {
				3,
				7
			}
		},
		Protector = {
			id = 132,
			icon = "protector",
			premium = true,
			level = 55,
			exhaustion = 2000,
			words = "utamo tempo",
			type = "Instant",
			soul = 0,
			mana = 200,
			group = {
				[1] = 10000,
				[3] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Blood Rage"] = {
			id = 133,
			icon = "bloodrage",
			premium = true,
			level = 60,
			exhaustion = 2000,
			words = "utito tempo",
			type = "Instant",
			soul = 0,
			mana = 290,
			group = {
				[3] = 2000
			},
			vocations = {
				4,
				8
			}
		},
		["Train Party"] = {
			id = 126,
			icon = "trainparty",
			premium = true,
			level = 32,
			exhaustion = 2000,
			words = "utito mas sio",
			type = "Instant",
			soul = 0,
			mana = "Var.",
			group = {
				[3] = 2000
			},
			vocations = {
				8
			}
		},
		["Protect Party"] = {
			id = 127,
			icon = "protectparty",
			premium = true,
			level = 32,
			exhaustion = 2000,
			words = "utamo mas sio",
			type = "Instant",
			soul = 0,
			mana = "Var.",
			group = {
				[3] = 2000
			},
			vocations = {
				7
			}
		},
		["Heal Party"] = {
			id = 128,
			icon = "healparty",
			premium = true,
			level = 32,
			exhaustion = 2000,
			words = "utura mas sio",
			type = "Instant",
			soul = 0,
			mana = "Var.",
			group = {
				[3] = 2000
			},
			vocations = {
				6
			}
		},
		["Enchant Party"] = {
			id = 129,
			icon = "enchantparty",
			premium = true,
			level = 32,
			exhaustion = 2000,
			words = "utori mas sio",
			type = "Instant",
			soul = 0,
			mana = "Var.",
			group = {
				[3] = 2000
			},
			vocations = {
				5
			}
		},
		["Summon Creature"] = {
			id = 9,
			icon = "summoncreature",
			premium = false,
			level = 25,
			exhaustion = 2000,
			words = "utevo res",
			type = "Instant",
			soul = 0,
			mana = "Var.",
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Conjure Arrow"] = {
			id = 51,
			icon = "conjurearrow",
			premium = false,
			level = 13,
			exhaustion = 2000,
			words = "exevo con",
			type = "Conjure",
			soul = 1,
			mana = 100,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		Food = {
			id = 42,
			icon = "food",
			premium = false,
			level = 14,
			exhaustion = 2000,
			words = "exevo pan",
			type = "Instant",
			soul = 1,
			mana = 120,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Conjure Poisoned Arrow"] = {
			id = 48,
			icon = "poisonedarrow",
			premium = false,
			level = 16,
			exhaustion = 2000,
			words = "exevo con pox",
			type = "Conjure",
			soul = 2,
			mana = 130,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Conjure Bolt"] = {
			id = 79,
			icon = "conjurebolt",
			premium = false,
			level = 17,
			exhaustion = 2000,
			words = "exevo con mort",
			type = "Conjure",
			soul = 2,
			mana = 140,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Conjure Sniper Arrow"] = {
			id = 108,
			icon = "sniperarrow",
			premium = false,
			level = 24,
			exhaustion = 2000,
			words = "exevo con hur",
			type = "Conjure",
			soul = 3,
			mana = 160,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Conjure Explosive Arrow"] = {
			id = 49,
			icon = "explosivearrow",
			premium = false,
			level = 25,
			exhaustion = 2000,
			words = "exevo con flam",
			type = "Conjure",
			soul = 3,
			mana = 290,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Conjure Piercing Bolt"] = {
			id = 109,
			icon = "piercingbolt",
			premium = false,
			level = 33,
			exhaustion = 2000,
			words = "exevo con grav",
			type = "Conjure",
			soul = 3,
			mana = 180,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Enchant Staff"] = {
			id = 92,
			icon = "enchantstaff",
			premium = false,
			level = 41,
			exhaustion = 2000,
			words = "exeta vis",
			type = "Conjure",
			soul = 0,
			mana = 80,
			group = {
				[3] = 2000
			},
			vocations = {
				5
			}
		},
		["Enchant Spear"] = {
			id = 110,
			icon = "enchantspear",
			premium = false,
			level = 45,
			exhaustion = 2000,
			words = "exeta con",
			type = "Conjure",
			soul = 3,
			mana = 350,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Conjure Power Bolt"] = {
			id = 95,
			icon = "powerbolt",
			premium = false,
			level = 59,
			exhaustion = 2000,
			words = "exevo con vis",
			type = "Conjure",
			soul = 3,
			mana = 800,
			group = {
				[3] = 2000
			},
			vocations = {
				7
			}
		},
		["Poison Field"] = {
			id = 26,
			icon = "poisonfield",
			premium = false,
			level = 14,
			exhaustion = 2000,
			words = "adevo grav pox",
			type = "Conjure",
			soul = 1,
			mana = 200,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Light Magic Missile"] = {
			id = 7,
			icon = "lightmagicmissile",
			premium = false,
			level = 15,
			exhaustion = 2000,
			words = "adori min vis",
			type = "Conjure",
			soul = 1,
			mana = 120,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Fire Field"] = {
			id = 25,
			icon = "firefield",
			premium = false,
			level = 15,
			exhaustion = 2000,
			words = "adevo grav flam",
			type = "Conjure",
			soul = 1,
			mana = 240,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Fireball = {
			id = 15,
			icon = "fireball",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adori flam",
			type = "Conjure",
			soul = 3,
			mana = 460,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Energy Field"] = {
			id = 27,
			icon = "energyfield",
			premium = false,
			level = 18,
			exhaustion = 2000,
			words = "adevo grav vis",
			type = "Conjure",
			soul = 2,
			mana = 320,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Stalagmite = {
			id = 77,
			icon = "stalagmite",
			premium = false,
			level = 24,
			exhaustion = 2000,
			words = "adori tera",
			type = "Conjure",
			soul = 2,
			mana = 400,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5,
				2,
				6
			}
		},
		["Great Fireball"] = {
			id = 16,
			icon = "greatfireball",
			premium = false,
			level = 30,
			exhaustion = 2000,
			words = "adori mas flam",
			type = "Conjure",
			soul = 3,
			mana = 530,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Heavy Magic Missile"] = {
			id = 8,
			icon = "heavymagicmissile",
			premium = false,
			level = 25,
			exhaustion = 2000,
			words = "adori vis",
			type = "Conjure",
			soul = 2,
			mana = 350,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5,
				2,
				6
			}
		},
		["Poison Bomb"] = {
			id = 91,
			icon = "poisonbomb",
			premium = false,
			level = 25,
			exhaustion = 2000,
			words = "adevo mas pox",
			type = "Conjure",
			soul = 2,
			mana = 520,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Firebomb = {
			id = 17,
			icon = "firebomb",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adevo mas flam",
			type = "Conjure",
			soul = 3,
			mana = 600,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Soulfire = {
			id = 50,
			icon = "soulfire",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adevo res flam",
			type = "Conjure",
			soul = 3,
			mana = 600,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Poison Wall"] = {
			id = 32,
			icon = "poisonwall",
			premium = false,
			level = 29,
			exhaustion = 2000,
			words = "adevo mas grav pox",
			type = "Conjure",
			soul = 3,
			mana = 640,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Explosion = {
			id = 18,
			icon = "explosion",
			premium = false,
			level = 31,
			exhaustion = 2000,
			words = "adevo mas hur",
			type = "Conjure",
			soul = 3,
			mana = 570,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Fire Wall"] = {
			id = 28,
			icon = "firewall",
			premium = false,
			level = 33,
			exhaustion = 2000,
			words = "adevo mas grav flam",
			type = "Conjure",
			soul = 3,
			mana = 780,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Energybomb = {
			id = 55,
			icon = "energybomb",
			premium = false,
			level = 37,
			exhaustion = 2000,
			words = "adevo mas vis",
			type = "Conjure",
			soul = 5,
			mana = 880,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Energy Wall"] = {
			id = 33,
			icon = "energywall",
			premium = false,
			level = 41,
			exhaustion = 2000,
			words = "adevo mas grav vis",
			type = "Conjure",
			soul = 5,
			mana = 1000,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Sudden Death"] = {
			id = 21,
			icon = "suddendeath",
			premium = false,
			level = 45,
			exhaustion = 2000,
			words = "adori gran mort",
			type = "Conjure",
			soul = 5,
			mana = 985,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Cure Poison Rune"] = {
			id = 31,
			icon = "antidote",
			premium = false,
			level = 15,
			exhaustion = 2000,
			words = "adana pox",
			type = "Conjure",
			soul = 1,
			mana = 200,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Intense Healing Rune"] = {
			id = 4,
			icon = "intensehealingrune",
			premium = false,
			level = 15,
			exhaustion = 2000,
			words = "adura gran",
			type = "Conjure",
			soul = 2,
			mana = 240,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Ultimate Healing Rune"] = {
			id = 5,
			icon = "ultimatehealingrune",
			premium = false,
			level = 24,
			exhaustion = 2000,
			words = "adura vita",
			type = "Conjure",
			soul = 3,
			mana = 400,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Convince Creature"] = {
			id = 12,
			icon = "convincecreature",
			premium = false,
			level = 16,
			exhaustion = 2000,
			words = "adeta sio",
			type = "Conjure",
			soul = 3,
			mana = 200,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Animate Dead"] = {
			id = 83,
			icon = "animatedead",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adana mort",
			type = "Conjure",
			soul = 5,
			mana = 600,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		Chameleon = {
			id = 14,
			icon = "chameleon",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adevo ina",
			type = "Conjure",
			soul = 2,
			mana = 600,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Destroy Field"] = {
			id = 30,
			icon = "destroyfield",
			premium = false,
			level = 17,
			exhaustion = 2000,
			words = "adito grav",
			type = "Conjure",
			soul = 2,
			mana = 120,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				5,
				6,
				7
			}
		},
		Desintegrate = {
			id = 78,
			icon = "desintegrate",
			premium = false,
			level = 21,
			exhaustion = 2000,
			words = "adito tera",
			type = "Conjure",
			soul = 3,
			mana = 200,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				2,
				3,
				5,
				6,
				7
			}
		},
		["Magic Wall"] = {
			id = 86,
			icon = "magicwall",
			premium = false,
			level = 32,
			exhaustion = 2000,
			words = "adevo grav tera",
			type = "Conjure",
			soul = 5,
			mana = 750,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Wild Growth"] = {
			id = 94,
			icon = "wildgrowth",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adevo grav vita",
			type = "Conjure",
			soul = 5,
			mana = 600,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Paralyze = {
			id = 54,
			icon = "paralyze",
			premium = false,
			level = 54,
			exhaustion = 2000,
			words = "adana ani",
			type = "Conjure",
			soul = 3,
			mana = 1400,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Icicle = {
			id = 114,
			icon = "icicle",
			premium = false,
			level = 28,
			exhaustion = 2000,
			words = "adori frigo",
			type = "Conjure",
			soul = 3,
			mana = 460,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Avalanche = {
			id = 115,
			icon = "avalanche",
			premium = false,
			level = 30,
			exhaustion = 2000,
			words = "adori mas frigo",
			type = "Conjure",
			soul = 3,
			mana = 530,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		["Stone Shower"] = {
			id = 116,
			icon = "stoneshower",
			premium = false,
			level = 28,
			exhaustion = 2000,
			words = "adori mas tera",
			type = "Conjure",
			soul = 3,
			mana = 430,
			group = {
				[3] = 2000
			},
			vocations = {
				2,
				6
			}
		},
		Thunderstorm = {
			id = 117,
			icon = "thunderstorm",
			premium = false,
			level = 28,
			exhaustion = 2000,
			words = "adori mas vis",
			type = "Conjure",
			soul = 3,
			mana = 430,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Holy Missile"] = {
			id = 130,
			icon = "holymissile",
			premium = false,
			level = 27,
			exhaustion = 2000,
			words = "adori san",
			type = "Conjure",
			soul = 3,
			mana = 350,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Summon Paladin Familiar"] = {
			id = 171,
			icon = "summonpaladinfamiliar",
			premium = true,
			level = 200,
			exhaustion = 1800000,
			words = "utevo gran res sac",
			type = "Instant",
			soul = 0,
			mana = 2000,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Summon Knight Familiar"] = {
			id = 170,
			icon = "summonknightfamiliar",
			premium = true,
			level = 200,
			exhaustion = 1800000,
			words = "utevo gran res eq",
			type = "Instant",
			soul = 0,
			mana = 1000,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Summon Druid Familiar"] = {
			id = 172,
			icon = "summondruidfamiliar",
			premium = true,
			level = 200,
			exhaustion = 1800000,
			words = "utevo gran res dru",
			type = "Instant",
			soul = 0,
			mana = 3000,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Summon Sorcerer Familiar"] = {
			id = 173,
			icon = "summonsorcererfamiliar",
			premium = true,
			level = 200,
			exhaustion = 1800000,
			words = "utevo gran res eq",
			type = "Instant",
			soul = 0,
			mana = 3000,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		},
		["Chivalrous Challenge"] = {
			id = 101,
			icon = "chivalrouschallange",
			premium = true,
			level = 150,
			exhaustion = 2000,
			words = "exeta amp res",
			type = "Instant",
			soul = 0,
			mana = 80,
			group = {
				[3] = 2000
			},
			vocations = {
				8
			}
		},
		["Fair Wound Cleansing"] = {
			id = 102,
			icon = "fairwoundcleansing",
			premium = true,
			level = 300,
			exhaustion = 1000,
			words = "exura med ico",
			type = "Instant",
			soul = 0,
			mana = 90,
			group = {
				[2] = 1000
			},
			vocations = {
				8
			}
		},
		["Conjure Wand of Darkness"] = {
			id = 92,
			icon = "conjurewandofdarkness",
			premium = true,
			level = 41,
			exhaustion = 1800000,
			words = "exevo gran mort",
			type = "Conjure",
			soul = 0,
			mana = 250,
			group = {
				[3] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		["Expose Weakness"] = {
			id = 106,
			icon = "exposeweakness",
			premium = true,
			level = 275,
			exhaustion = 12000,
			words = "exori moe",
			type = "Instant",
			soul = 0,
			mana = 400,
			group = {
				[3] = 2000,
				[5] = 12000
			},
			vocations = {
				1,
				5
			}
		},
		["Sap Strenght"] = {
			id = 105,
			icon = "sapstrenght",
			premium = true,
			level = 175,
			exhaustion = 12000,
			words = "exori kor",
			type = "Instant",
			soul = 0,
			mana = 300,
			group = {
				[3] = 2000,
				[5] = 12000
			},
			vocations = {
				1,
				5
			}
		},
		["Great Fire Wave"] = {
			id = 100,
			icon = "greatfirewave",
			premium = true,
			level = 38,
			exhaustion = 4000,
			words = "exevo gran flam hur",
			type = "Instant",
			soul = 0,
			mana = 120,
			group = {
				[1] = 2000
			},
			vocations = {
				1,
				5
			}
		},
		Restoration = {
			id = 103,
			icon = "restoration",
			premium = true,
			level = 300,
			exhaustion = 6000,
			words = "exura max vita",
			type = "Instant",
			soul = 0,
			mana = 260,
			group = {
				[2] = 1000
			},
			vocations = {
				1,
				2,
				5,
				6
			}
		},
		["Nature's Embrace"] = {
			id = 101,
			icon = "naturesembrace",
			premium = true,
			level = 300,
			exhaustion = 60000,
			words = "exura gran sio",
			type = "Instant",
			soul = 0,
			mana = 400,
			group = {
				[2] = 1000
			},
			vocations = {
				2,
				6
			}
		},
		["Divine Dazzle"] = {
			id = 101,
			icon = "divinedazzle",
			premium = true,
			level = 250,
			exhaustion = 16000,
			words = "exana amp res",
			type = "Instant",
			soul = 0,
			mana = 80,
			group = {
				[3] = 2000
			},
			vocations = {
				3,
				7
			}
		}
	}
}
SpellIcons = {
	summonsorcererfamiliar = {
		130,
		173
	},
	summondruidfamiliar = {
		129,
		172
	},
	summonpaladinfamiliar = {
		127,
		171
	},
	summonknightfamiliar = {
		128,
		170
	},
	exposeweakness = {
		134,
		106
	},
	sapstrenght = {
		135,
		105
	},
	restoration = {
		137,
		103
	},
	fairwoundcleansing = {
		132,
		102
	},
	chivalrouschallange = {
		131,
		101
	},
	naturesembrace = {
		138,
		101
	},
	divinedazzle = {
		139,
		101
	},
	greatfirewave = {
		136,
		100
	},
	conjurewandofdarkness = {
		133,
		92
	},
	intenserecovery = {
		16,
		160
	},
	recovery = {
		15,
		159
	},
	intensewoundcleansing = {
		4,
		158
	},
	ultimateterrastrike = {
		37,
		157
	},
	ultimateicestrike = {
		34,
		156
	},
	ultimateenergystrike = {
		31,
		155
	},
	ultimateflamestrike = {
		28,
		154
	},
	strongterrastrike = {
		36,
		153
	},
	strongicestrike = {
		33,
		152
	},
	strongenergystrike = {
		30,
		151
	},
	strongflamestrike = {
		27,
		150
	},
	lightning = {
		51,
		149
	},
	physicalstrike = {
		17,
		148
	},
	curecurse = {
		11,
		147
	},
	curseelectrification = {
		14,
		146
	},
	cureburning = {
		13,
		145
	},
	curebleeding = {
		12,
		144
	},
	holyflash = {
		53,
		143
	},
	envenom = {
		58,
		142
	},
	inflictwound = {
		57,
		141
	},
	electrify = {
		56,
		140
	},
	curse = {
		54,
		139
	},
	ignite = {
		55,
		138
	},
	sharpshooter = {
		121,
		135
	},
	swiftfoot = {
		119,
		134
	},
	bloodrage = {
		96,
		133
	},
	protector = {
		122,
		132
	},
	charge = {
		98,
		131
	},
	holymissile = {
		76,
		130
	},
	enchantparty = {
		113,
		129
	},
	healparty = {
		126,
		128
	},
	protectparty = {
		123,
		127
	},
	trainparty = {
		120,
		126
	},
	divinehealing = {
		2,
		125
	},
	divinecaldera = {
		40,
		124
	},
	woundcleansing = {
		3,
		123
	},
	divinemissile = {
		39,
		122
	},
	icewave = {
		45,
		121
	},
	terrawave = {
		47,
		120
	},
	rageoftheskies = {
		52,
		119
	},
	eternalwinter = {
		50,
		118
	},
	thunderstorm = {
		63,
		117
	},
	stoneshower = {
		65,
		116
	},
	avalanche = {
		92,
		115
	},
	icicle = {
		75,
		114
	},
	terrastrike = {
		35,
		113
	},
	icestrike = {
		32,
		112
	},
	etherealspear = {
		18,
		111
	},
	enchantspear = {
		104,
		110
	},
	piercingbolt = {
		110,
		109
	},
	sniperarrow = {
		112,
		108
	},
	whirlwindthrow = {
		19,
		107
	},
	groundshaker = {
		25,
		106
	},
	fierceberserk = {
		22,
		105
	},
	powerbolt = {
		108,
		95
	},
	wildgrowth = {
		61,
		94
	},
	challenge = {
		97,
		93
	},
	enchantstaff = {
		103,
		92
	},
	poisonbomb = {
		70,
		91
	},
	cancelinvisibility = {
		95,
		90
	},
	flamestrike = {
		26,
		89
	},
	energystrike = {
		29,
		88
	},
	deathstrike = {
		38,
		87
	},
	magicwall = {
		72,
		86
	},
	healfriend = {
		8,
		84
	},
	animatedead = {
		93,
		83
	},
	masshealing = {
		9,
		82
	},
	levitate = {
		125,
		81
	},
	berserk = {
		21,
		80
	},
	conjurebolt = {
		107,
		79
	},
	desintegrate = {
		88,
		78
	},
	stalagmite = {
		66,
		77
	},
	magicrope = {
		105,
		76
	},
	ultimatelight = {
		115,
		75
	},
	annihilation = {
		24,
		62
	},
	brutalstrike = {
		23,
		61
	},
	frontsweep = {
		20,
		59
	},
	strongetherealspear = {
		59,
		57
	},
	wrathofnature = {
		48,
		56
	},
	energybomb = {
		86,
		55
	},
	paralyze = {
		71,
		54
	},
	conjurearrow = {
		106,
		51
	},
	soulfire = {
		67,
		50
	},
	explosivearrow = {
		109,
		49
	},
	poisonedarrow = {
		111,
		48
	},
	invisible = {
		94,
		45
	},
	magicshield = {
		124,
		44
	},
	strongicewave = {
		46,
		43
	},
	food = {
		99,
		42
	},
	stronghaste = {
		102,
		39
	},
	creatureillusion = {
		100,
		38
	},
	salvation = {
		60,
		36
	},
	energywall = {
		84,
		33
	},
	poisonwall = {
		68,
		32
	},
	antidote = {
		10,
		31
	},
	destroyfield = {
		87,
		30
	},
	curepoison = {
		10,
		29
	},
	firewall = {
		80,
		28
	},
	energyfield = {
		85,
		27
	},
	poisonfield = {
		69,
		26
	},
	firefield = {
		81,
		25
	},
	hellscore = {
		49,
		24
	},
	greatenergybeam = {
		42,
		23
	},
	energybeam = {
		41,
		22
	},
	suddendeath = {
		64,
		21
	},
	findperson = {
		114,
		20
	},
	firewave = {
		44,
		19
	},
	explosion = {
		83,
		18
	},
	firebomb = {
		82,
		17
	},
	greatfireball = {
		78,
		16
	},
	fireball = {
		79,
		15
	},
	chameleon = {
		91,
		14
	},
	energywave = {
		43,
		13
	},
	convincecreature = {
		90,
		12
	},
	greatlight = {
		116,
		11
	},
	light = {
		117,
		10
	},
	summoncreature = {
		118,
		9
	},
	heavymagicmissile = {
		77,
		8
	},
	lightmagicmissile = {
		73,
		7
	},
	haste = {
		101,
		6
	},
	ultimatehealingrune = {
		62,
		5
	},
	intensehealingrune = {
		74,
		4
	},
	ultimatehealing = {
		1,
		3
	},
	intensehealing = {
		7,
		2
	},
	lighthealing = {
		6,
		1
	}
}
VocationNames = {
	"Sorcerer",
	"Druid",
	"Paladin",
	"Knight",
	"Master Sorcerer",
	"Elder Druid",
	"Royal Paladin",
	"Elite Knight"
}
SpellGroups = {
	"Attack",
	"Healing",
	"Support",
	"Special",
	"Cripple"
}
Spells = {}

function Spells.getClientId(spellName)
	local profile = Spells.getSpellProfileByName(spellName)
	local id = SpellInfo[profile][spellName].icon

	if not tonumber(id) and SpellIcons[id] then
		return SpellIcons[id][1]
	end

	return tonumber(id)
end

function Spells.getServerId(spellName)
	local profile = Spells.getSpellProfileByName(spellName)
	local id = SpellInfo[profile][spellName].icon

	if not tonumber(id) and SpellIcons[id] then
		return SpellIcons[id][2]
	end

	return tonumber(id)
end

function Spells.getSpellByName(name)
	return SpellInfo[Spells.getSpellProfileByName(name)][name]
end

function Spells.getSpellByWords(words)
	local words = words:lower():trim()

	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			if spell.words == words then
				return spell, profile, k
			end
		end
	end

	return nil
end

function Spells.getSpellByIcon(iconId)
	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			if spell.id == iconId then
				return spell, profile, k
			end
		end
	end

	return nil
end

function Spells.getSpellIconIds()
	local ids = {}

	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			table.insert(ids, spell.id)
		end
	end

	return ids
end

function Spells.getSpellProfileById(id)
	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			if spell.id == id then
				return profile
			end
		end
	end

	return nil
end

function Spells.getSpellProfileByWords(words)
	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			if spell.words == words then
				return profile
			end
		end
	end

	return nil
end

function Spells.getSpellProfileByName(spellName)
	for profile, data in pairs(SpellInfo) do
		if table.findbykey(data, spellName:trim(), true) then
			return profile
		end
	end

	return nil
end

function Spells.getSpellsByVocationId(vocId)
	local spells = {}

	for profile, data in pairs(SpellInfo) do
		for k, spell in pairs(data) do
			if table.contains(spell.vocations, vocId) then
				table.insert(spells, spell)
			end
		end
	end

	return spells
end

function Spells.filterSpellsByGroups(spells, groups)
	local filtered = {}

	for v, spell in pairs(spells) do
		local spellGroups = Spells.getGroupIds(spell)

		if table.equals(spellGroups, groups) then
			table.insert(filtered, spell)
		end
	end

	return filtered
end

function Spells.getGroupIds(spell)
	local groups = {}

	for k, _ in pairs(spell.group) do
		table.insert(groups, k)
	end

	return groups
end

function Spells.getImageClip(id, profile)
	return (id - 1) % 12 * SpelllistSettings[profile].iconSize.width .. " " .. (math.ceil(id / 12) - 1) * SpelllistSettings[profile].iconSize.height .. " " .. SpelllistSettings[profile].iconSize.width .. " " .. SpelllistSettings[profile].iconSize.height
end
