-- chunkname: @/modules/gamelib/const.lua

VisionMode = {
	ExtraLarge = 4,
	Large = 3,
	Big = 2,
	Medium = 1,
	Small = 0,
	Last = 4,
	First = 0
}
ViewMode = {
	Classic = 1,
	First = 1,
	Last = 2,
	Extended = 2
}
MAPMARK_INTERROGATION = 1
MAPMARK_EXCLAMATION = 2
MAPMARK_STAR = 3
MAPMARK_ARROW_UP = 4
MAPMARK_ARROW_RIGHT = 5
MAPMARK_UP = 6
MAPMARK_CLOSE = 7
MAPMARK_CROSS = 8
MAPMARK_FOOD = 9
MAPMARK_FLAG = 10
MAPMARK_LOCKED = 11
MAPMARK_ARROW_DOWN = 12
MAPMARK_ARROW_LEFT = 13
MAPMARK_DOWN = 14
MAPMARK_MARK = 15
MAPMARK_DOLLAR = 16
MAPMARK_HOUSE = 17
MAPMARK_FISH = 18
MAPMARK_WARNING = 19
MAPMARK_BLOCKED = 20
MAPMARK_RAY = 21
MAPMARK_GHOST = 22
MAPMARK_STOPWATCH = 23
NAME_COLOR_RED = 0
NAME_COLOR_BLUE = 1
NAME_COLOR_WHITE = 2
NAME_COLOR_YELLOW = 3
NAME_COLOR_GREEN = 4
NAME_COLOR_DARKER_YELLOW = 5
NAME_COLOR_DARKER_BLUE = 6
NAME_COLOR_ORANGE = 7
NAME_COLOR_PURPLE = 8
NAME_COLOR_AQUA_BLUE = 9
NAME_COLOR_SKY_BLUE = 10
NAME_COLOR_PINK = 11
NAME_COLOR_LAVENDER_PURPLE = 12
NAME_COLOR_LIGHT_RED = 13
NAME_COLOR_BLACK = 14
CreatureNameColorsMap = {
	[NAME_COLOR_RED] = "#FF7575",
	[NAME_COLOR_BLUE] = "#7878FF",
	[NAME_COLOR_WHITE] = "#FFFFFF",
	[NAME_COLOR_YELLOW] = "#FFFF00",
	[NAME_COLOR_GREEN] = "#00FF00",
	[NAME_COLOR_DARKER_YELLOW] = "#DADA00",
	[NAME_COLOR_DARKER_BLUE] = "#000099",
	[NAME_COLOR_ORANGE] = "#FF7F00",
	[NAME_COLOR_PURPLE] = "#FF29FF",
	[NAME_COLOR_AQUA_BLUE] = "#00FFFF",
	[NAME_COLOR_SKY_BLUE] = "#87ceeb",
	[NAME_COLOR_PINK] = "#F976A3",
	[NAME_COLOR_LAVENDER_PURPLE] = "#AF76FA",
	[NAME_COLOR_LIGHT_RED] = "#ff4141",
	[NAME_COLOR_BLACK] = "#858585"
}
NameEffectsConfig = {
	[0] = {
		Texture = "",
		Name = "None"
	},
	{
		Texture = "/images/game/nameeffects/yellow_sparkles",
		Name = "Let's Go Sparkles"
	},
	{
		Texture = "/images/game/nameeffects/lightgreen_sparkles",
		Name = "Green's Sparkles Effect"
	},
	{
		Texture = "/images/game/nameeffects/black_sparkles",
		Name = "Black Sparkles"
	},
	{
		Texture = "/images/game/nameeffects/falling_sparkles",
		Name = "First Year"
	},
	{
		Texture = "/images/game/nameeffects/purple_sparkles",
		Name = "Blue's Sparkles Effect"
	},
	{
		Texture = "/images/game/nameeffects/red_effect",
		Name = "Red's Sparkles Effect"
	},
	{
		Texture = "/images/game/nameeffects/butterflies_fast",
		Name = "Butterflies Fast"
	},
	{
		Texture = "/images/game/nameeffects/pink_sparkles",
		Name = "Pink Sparkles"
	},
	{
		Texture = "/images/game/nameeffects/white_sparkles",
		Name = "White Sparkles"
	}
}
InsigniasInfo = {
	{
		tooltip = "Ins\xEDgnia Rocha",
		leader = "Brock",
		badgeOn = 11319,
		badgeOff = 11327
	},
	{
		tooltip = "Ins\xEDgnia Cascata",
		leader = "Misty",
		badgeOn = 11320,
		badgeOff = 11328
	},
	{
		tooltip = "Ins\xEDgnia Trov\xE3o",
		leader = "Surge",
		badgeOn = 11321,
		badgeOff = 11329
	},
	{
		tooltip = "Ins\xEDgnia Arco-\xCDris",
		leader = "Erika",
		badgeOn = 11322,
		badgeOff = 11330
	},
	{
		tooltip = "Ins\xEDgnia Lama",
		leader = "Sabrina",
		badgeOn = 11323,
		badgeOff = 11331
	},
	{
		tooltip = "Ins\xEDgnia da Alma",
		leader = "Koga",
		badgeOn = 11324,
		badgeOff = 11332
	},
	{
		tooltip = "Ins\xEDgnia da Vulc\xE3o",
		leader = "Blaine",
		badgeOn = 11325,
		badgeOff = 11333
	},
	{
		tooltip = "Ins\xEDgnia da Terra",
		leader = "Kira",
		badgeOn = 11326,
		badgeOff = 11334
	}
}
IMAGE_PATHS = {
	POKEMON = "/images/game/pokedex/pokemon/",
	PORTRAIT = "/images/game/portrait/",
	TYPES = "/images/game/pokedex/types/"
}
FloorHigher = 0
FloorLower = 15
SkullNone = 0
SkullYellow = 1
SkullGreen = 2
SkullWhite = 3
SkullRed = 4
SkullBlack = 5
SkullOrange = 6
ShieldNone = 0
ShieldWhiteYellow = 1
ShieldWhiteBlue = 2
ShieldBlue = 3
ShieldYellow = 4
ShieldBlueSharedExp = 5
ShieldYellowSharedExp = 6
ShieldBlueNoSharedExpBlink = 7
ShieldYellowNoSharedExpBlink = 8
ShieldBlueNoSharedExp = 9
ShieldYellowNoSharedExp = 10
ShieldGray = 11
EmblemNone = 0
EmblemGreen = 1
EmblemRed = 2
EmblemBlue = 3
EmblemMember = 4
EmblemOther = 5
VipIconFirst = 0
VipIconLast = 7
OrderButton = 3157
UseSelf = 1
UseWith = 2
UseTele = 3
Directions = {
	North = 0,
	NorthWest = 7,
	SouthWest = 6,
	SouthEast = 5,
	NorthEast = 4,
	West = 3,
	South = 2,
	East = 1
}
Skill = {
	AutoLoot = 17,
	PokeJobEnergy = 16,
	Profile = 15,
	Clan = 14,
	Badges = 13,
	ManaLeechAmount = 12,
	ManaLeechChance = 11,
	LifeLeechAmount = 10,
	LifeLeechChance = 9,
	CriticalDamage = 8,
	CriticalChance = 7,
	Fishing = 6,
	Shielding = 5,
	Distance = 4,
	Axe = 3,
	Sword = 2,
	Club = 1,
	Fist = 0
}
North = Directions.North
East = Directions.East
South = Directions.South
West = Directions.West
NorthEast = Directions.NorthEast
SouthEast = Directions.SouthEast
SouthWest = Directions.SouthWest
NorthWest = Directions.NorthWest
FightOffensive = 1
FightBalanced = 2
FightDefensive = 3
DontChase = 0
ChaseOpponent = 1
PVPWhiteDove = 0
PVPWhiteHand = 1
PVPYellowHand = 2
PVPRedFist = 3
GameProtocolChecksum = 1
GameAccountNames = 2
GameChallengeOnLogin = 3
GamePenalityOnDeath = 4
GameNameOnNpcTrade = 5
GameDoubleFreeCapacity = 6
GameDoubleExperience = 7
GameTotalCapacity = 8
GameSkillsBase = 9
GamePlayerRegenerationTime = 10
GameChannelPlayerList = 11
GamePlayerMounts = 12
GameEnvironmentEffect = 13
GameCreatureEmblems = 14
GameItemAnimationPhase = 15
GameMagicEffectU16 = 16
GamePlayerMarket = 17
GameSpritesU32 = 18
GameTileAddThingWithStackpos = 19
GameOfflineTrainingTime = 20
GamePurseSlot = 21
GameFormatCreatureName = 22
GameSpellList = 23
GameClientPing = 24
GameExtendedClientPing = 25
GameDoubleHealth = 28
GameDoubleSkills = 29
GameChangeMapAwareRange = 30
GameMapMovePosition = 31
GameAttackSeq = 32
GameBlueNpcNameColor = 33
GameDiagonalAnimatedText = 34
GameLoginPending = 35
GameNewSpeedLaw = 36
GameForceFirstAutoWalkStep = 37
GameMinimapRemove = 38
GameDoubleShopSellAmount = 39
GameContainerPagination = 40
GameThingMarks = 41
GameLooktypeU16 = 42
GamePlayerStamina = 43
GamePlayerAddons = 44
GameMessageStatements = 45
GameMessageLevel = 46
GameNewFluids = 47
GamePlayerStateU16 = 48
GameNewOutfitProtocol = 49
GamePVPMode = 50
GameWritableDate = 51
GameAdditionalVipInfo = 52
GameBaseSkillU16 = 53
GameCreatureIcons = 54
GameHideNpcNames = 55
GameSpritesAlphaChannel = 56
GamePremiumExpiration = 57
GameBrowseField = 58
GameEnhancedAnimations = 59
GameOGLInformation = 60
GameMessageSizeCheck = 61
GamePreviewState = 62
GameLoginPacketEncryption = 63
GameClientVersion = 64
GameContentRevision = 65
GameExperienceBonus = 66
GameAuthenticator = 67
GameUnjustifiedPoints = 68
GameSessionKey = 69
GameDeathType = 70
GameIdleAnimations = 71
GameKeepUnawareTiles = 72
GameIngameStore = 73
GameIngameStoreHighlights = 74
GameIngameStoreServiceType = 75
GameAdditionalSkills = 76
GameDistanceEffectU16 = 77
GamePrey = 78
GameDoubleMagicLevel = 79
GameExtendedOpcode = 80
GameMinimapLimitedToSingleFloor = 81
GameSendWorldName = 82
GameDoubleLevel = 83
GameDoubleSoul = 84
GameDoublePlayerGoodsMoney = 85
GameCreatureWalkthrough = 86
GameDoubleTradeMoney = 87
GameSequencedPackets = 88
GameTibia12Protocol = 89
GameNewWalking = 90
GameSlowerManualWalking = 91
GameItemTooltip = 93
GameBot = 95
GameBiggerMapCache = 96
GameForceLight = 97
GameNoDebug = 98
GameBotProtection = 99
GameCreatureDirectionPassable = 100
GameFasterAnimations = 101
GameCenteredOutfits = 102
GameSendIdentifiers = 103
GameWingsAndAura = 104
GamePlayerStateU32 = 105
GameOutfitShaders = 106
GameForceAllowItemHotkeys = 107
GameCountU16 = 108
GameDrawAuraOnTop = 109
GamePacketSizeU32 = 110
GamePacketCompression = 111
GameOldInformationBar = 112
GameHealthInfoBackground = 113
GameWingOffset = 114
GameAuraFrontAndBack = 115
GameMapDrawGroundFirst = 116
GameMapIgnoreCorpseCorrection = 117
GameDontCacheFiles = 118
GameBigAurasCenter = 119
GameNewUpdateWalk = 120
GameWalkSmoothElevation = 121
GameMapDrawItemCount = 122
GameFasterDiagonal = 123
GameMapDrawPokemonIcons = 124
GameDoubleShopBuyAmount = 125
GameMagicEffectDrawBottom = 126
LastGameFeature = 130
HighscoreSkill_t = {
    HIGHSCORE_SKILL_FIST = 0,
    HIGHSCORE_SKILL_CLUB = 1,
    HIGHSCORE_SKILL_SWORD = 2,
    HIGHSCORE_SKILL_AXE = 3,
    HIGHSCORE_SKILL_DISTANCE = 4,
    HIGHSCORE_SKILL_SHIELDING = 5,
    HIGHSCORE_SKILL_FISHING = 6,
    HIGHSCORE_SKILL_MAGIC = 7,
    HIGHSCORE_SKILL_EXPERIENCE = 8
}

HighscoreSkill_t.HIGHSCORE_SKILL_FIRST = HighscoreSkill_t.HIGHSCORE_SKILL_ACHIEVEMENTS
HighscoreSkill_t.HIGHSCORE_SKILL_LAST = HighscoreSkill_t.HIGHSCORE_SKILL_FARMING
HighscoreVocation_t = {
	HIGHSCORE_VOCATION_PALADIN = 2,
	HIGHSCORE_VOCATION_DRUID = 1,
	HIGHSCORE_VOCATION_KNIGHT = 0,
	HIGHSCORE_VOCATION_COUNT = 5,
	HIGHSCORE_VOCATION_NONE = 4,
	HIGHSCORE_VOCATION_SORCERER = 3
}
HighscoreMethod_t = {
	HIGHSCORE_METHOD_REDIRECT = 2,
	HIGHSCORE_METHOD_OWN_RANKS = 1,
	HIGHSCORE_METHOD_ENTRIES = 0
}
TextColors = {
	lightblue = "#5ff7f7",
	green = "#00EB00",
	blue = "#9f9dfd",
	yellow = "#ffff00",
	white = "#ffffff",
	orange = "#f36500",
	red = "#f55e5e"
}
MessageModes = {
	Warning = 17,
	Login = 16,
	GamemasterPrivateTo = 15,
	GamemasterPrivateFrom = 14,
	GamemasterChannel = 13,
	GamemasterBroadcast = 12,
	NpcTo = 11,
	NpcFrom = 10,
	Spell = 9,
	ChannelHighlight = 8,
	Channel = 7,
	ChannelManagement = 6,
	PrivateTo = 5,
	PrivateFrom = 4,
	Yell = 3,
	Whisper = 2,
	Say = 1,
	Heal = 23,
	Last = 52,
	Invalid = 255,
	NpcFromStartBlock = 51,
	GameHighlight = 50,
	RVRContinue = 49,
	RVRAnswer = 48,
	RVRChannel = 47,
	Blue = 46,
	Red = 45,
	MonsterSay = 44,
	MonsterYell = 43,
	BeyondLast = 42,
	Mana = 41,
	Market = 40,
	Thankyou = 39,
	TutorialHint = 38,
	HotkeyUse = 37,
	Report = 36,
	BarkLoud = 35,
	BarkLow = 34,
	Party = 33,
	PartyManagement = 32,
	Guild = 31,
	TradeNpc = 30,
	Loot = 29,
	Status = 28,
	ExpOthers = 27,
	HealOthers = 26,
	DamageOthers = 25,
	Exp = 24,
	None = 0,
	DamageReceived = 22,
	DamageDealed = 21,
	Look = 20,
	Failure = 19,
	Game = 18
}


OTSERV_RSA  = "1091201329673994292788609605089955415282375029027981291234687579" ..
              "3726629149257644633073969600111060390723088861007265581882535850" ..
              "3429057592827629436413108566029093628212635953836686562675849720" ..
              "6207862794310902180176810615217550567108238764764442605581471797" ..
              "07119674283982419152118103759076030616683978566631413"

CIPSOFT_RSA = "1321277432058722840622950990822933849527763264961655079678763618" ..
              "4334395343554449668205332383339435179772895415509701210392836078" ..
              "6959821132214473291575712138800495033169914814069637740318278150" ..
              "2907336840325241747827401343576296990629870233111328210165697754" ..
              "88792221429527047321331896351555606801473202394175817"

-- set to the latest Tibia.pic signature to make otclient compatible with official tibia
PIC_SIGNATURE = 0x56C5DDE7

OsTypes = {
  Linux = 1,
  Windows = 2,
  Flash = 3,
  OtclientLinux = 10,
  OtclientWindows = 11,
  OtclientMac = 12,
}

PathFindResults = {
  Ok = 0,
  Position = 1,
  Impossible = 2,
  TooFar = 3,
  NoWay = 4,
}

PathFindFlags = {
  AllowNullTiles = 1,
  AllowCreatures = 2,
  AllowNonPathable = 4,
  AllowNonWalkable = 8,
}

VipState = {
  Offline = 0,
  Online = 1,
  Pending = 2,
}

ExtendedIds = {
  Activate = 0,
  Locale = 1,
  Ping = 2,
  Sound = 3,
  Game = 4,
  Particles = 5,
  MapShader = 6,
  NeedsUpdate = 7
}

PreviewState = {
  Default = 0,
  Inactive = 1,
  Active = 2
}

Blessings = {
  None = 0,
  Adventurer = 1,
  SpiritualShielding = 2,
  EmbraceOfTibia = 4,
  FireOfSuns = 8,
  WisdomOfSolitude = 16,
  SparkOfPhoenix = 32
}

DeathType = {
  Regular = 0,
  Blessed = 1
}

ProductType = {
  Other = 0,
  NameChange = 1
}

StoreErrorType = {
  NoError = -1,
  PurchaseError = 0,
  NetworkError = 1,
  HistoryError = 2,
  TransferError = 3,
  Information = 4
}

StoreState = {
  None = 0,
  New = 1,
  Sale = 2,
  Timed = 3
}

AccountStatus = {
  Ok = 0,
  Frozen = 1,
  Suspended = 2,
}

SubscriptionStatus = {
  Free = 0,
  Premium = 1,
}

ChannelEvent = {
  Join = 0,
  Leave = 1,
  Invite = 2,
  Exclude = 3,
}

Servers = {
   PokeContest = "http://127.0.0.1"
}

API_KEY = {
	[Servers.PokeContest] = "Testando"
}


API = {
	ACCOUNTS = {
		AUTHENTICATION = "/api/accounts/authentication.php",
		CREATE = "/api/accounts/create.php"
	},
	CHARACTERS = {
		CREATE = "/api/management/Characters/Character.php",
		DELETE = "/api/management/Characters/Delete.php",
		GET = "/api/management/Characters/Character.php",
		DELETE_CANCEL = "/api/management/Characters/Delete/Cancel.php"
	},
	ACTIVATION = {
		CODE = "/api/management/AccountActivation.php",
		SEND_EMAIL = "/api/management/AccountActivation/SendEmail.php"
	},
	EMAIL = {
		CHANGE_CANCEL = "/api/management/AccountEmail/Cancel.php",
		CHANGE = "/api/management/AccountEmail/Change.php"
	},
	PIX = {
		DONATE = "/api/management/Pix.php"
	},
	PASSWORD = {
		SEND_RECOVER_CODE = "/api/management/Password/Send.php",
		RECOVER = "/api/management/Password/Recover.php",
		CHANGE = "/api/management/Password/Change.php"
	}
}

