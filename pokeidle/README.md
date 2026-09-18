# PokeIdle

Web idle MMO built on the existing OTClient 1098 + TFS base that lives in
`../cliente` and `../servidor`.

**Architecture: strategy B.** The TFS server stays the authoritative simulator.
A Node gateway will speak the OT protocol to it and WebSocket/JSON to the
browser. The browser gets a new PixiJS renderer fed by content compiled offline
from the same DAT/SPR/OTB/OTBM the desktop client uses. Game systems migrate
from Lua to TypeScript later, one at a time, behind the gateway.

## Running

Requires Node >= 22.18 (type stripping runs the TypeScript directly — no build,
no dependencies).

```bash
node packages/content-compiler/src/cli.ts info
```

| Command | What it does |
| --- | --- |
| `info` | Reads all four formats and prints the compatibility matrix |
| `sprite <id> [id...]` | Decodes sprites to PNG in `out/` |
| `thing <category> <id>` | Inspects an appearance and renders its directions |
| `otb [serverId...]` | items.otb summary, or serverId → clientId lookup |
| `map [--full] [--box x1,y1,x2,y2,z1[,z2]] [--limit n]` | Scans an OTBM |
| `towns [name] [--map2]` | Lists towns and their temple positions |
| `pack --box ... [--budget mb] [--with-hunts]` | Compiles a content release for one cutout |
| `pack --hunt <zoneId> [--pad n]` | Compiles a release for one hunt zone |
| `species [name]` | Species registry summary, or one species in detail |
| `hunts [species\|region]` | Clusters spawns into hunt zones |

Categories: `item`, `creature`, `effect`, `missile`.
`map` defaults to `map2.otbm`; `--full` switches to the 94 MB `map.otbm`.
Override the base location with `POKEIDLE_ROOT`.

## Compatibility matrix

Verified against the real files, not assumed.

| | |
| --- | --- |
| Client version | 1098 |
| `spritesU32` | true (>= 960) |
| `spritesAlphaChannel` | true — coloured pixels are 4 bytes RGBA, not 3 |
| `enhancedAnimations` | true (>= 1050) — phase durations are serialised |
| `idleAnimations` | true (>= 1057) — creatures carry frame groups |
| `attributeShift1000` | true — attr 16 became "no move animation" |

Source of truth is `cliente/modules/game_features/features.lua`.
**`Tibia.otfi` is not authoritative** — nothing in the client ever parses it.

## What the base actually holds

| Artifact | Measured |
| --- | --- |
| Loot | 3,332 entries across 1,039 species, out of ten million |
| `Tibia.dat` | 52,542 appearances — 45,742 items, 4,128 outfits, 2,433 effects, 239 missiles |
| `Tibia.spr` | 495,802 sprites, 32×32 RGBA, all non-blank, 851 MiB |
| `items.otb` | 48,637 definitions, format 3, client 1098, 734 without a clientId |
| `map2.otbm` | 79,207 tiles, extent x 1012–1210 y 1020–1238 z 1–8 |
| `map.otbm` | 11,164,398 tiles, extent x 378–5392 y 1729–6847 z 0–15, 2048→7500 declared |

Cross-checks that passed:

- The DAT references exactly **495,802 distinct sprites** — identical to the
  count SPR declares. A misaligned parser could not land on that number.
- Every `clientId` in items.otb resolves to an appearance in the DAT (0 dangling).
- Both maps declare `items 3.57`, and `57` is the `clientVersion_t` ordinal for
  1098 — the same build items.otb was made for.

## The hub cutout

Towns live inside the OTBM, not in an XML. Read authoritatively with:

```bash
node packages/content-compiler/src/cli.ts towns saffron
```

`map.otbm` declares 23 towns. Saffron is town id 2, temple at **2608, 2524, 7**.
A 64x64 cutout centred there covers the CP:

```bash
node packages/content-compiler/src/cli.ts map --full --box 2576,2492,2640,2556,7,7
```

That box yields 4,224 tiles: 4,135 with ground, 2,305 stacked items and 1,021
marked protection zone. It is the first content release target.

Worth knowing: town 21 `utilitarios` sits at 2609, 2519, 15 — practically on
top of Saffron in x/y but sixteen floors down. It is a staging area, not part
of the hub, and the `z` filter keeps it out.

## Content releases

```bash
node packages/content-compiler/src/cli.ts pack --box 2576,2492,2640,2556,7
```

The compiler never iterates the sprite file. It walks the cutout, resolves
serverId to clientId through items.otb, pulls only the appearances those tiles
reach, and packs only the sprites those appearances reference. A hard
`byteBudget` fails the build when the result is too big for a browser.

First release, the Saffron CP:

| | |
| --- | --- |
| Tiles | 4,224 |
| Item appearances | 414 of 45,742 in the dat |
| Sprites | 1,316 of 495,802 in the spr — **0.27%** |
| Atlases | 1 (2048x672, cropped to used rows) |
| Chunks | 4 |
| **Total** | **1.1 MB, 4.5% of the 25 MB budget** |

With `--with-hunts` over the full hub box, the release also carries creature
appearances, the hunt zones and the species registry:

| | |
| --- | --- |
| Tiles | 9,150 across 9 chunks |
| Appearances | 811 — 569 items, 242 creatures |
| Sprites | 12,527 in 4 atlases |
| Datasets | `hunts.json`, `species.json`, `npcs.json` |
| **Total** | **5.2 MB, 20.7% of budget** |

Creature appearances cannot be reached from tiles — the map stores items, and
every Pokemon and NPC is placed at runtime by the spawn file. They are named
explicitly from the hunt species and the NPCs standing inside the box, or the
world renders empty of life.

Zero warnings: every serverId on those tiles resolved through items.otb, and
every clientId resolved to an appearance in the dat.

Output layout:

```
manifest.json         releaseId, counts, budget, sha256 per file
appearances.json      geometry + animation timing + sprite -> atlas slot
atlas/atlas-NNN.png   2048px grids, 64x64 slots of 32px
chunks/<z>/<cx>_<cy>.json
```

Chunk tiles carry **clientIds, already resolved** — the browser never receives
items.otb and never needs it. Appearances carry geometry and phase timing only;
walkability, stacking rules and light stay server-side, which is what keeps the
client unable to lie about them.

## Game shape

One city, everything else is a hunt map.

**The hub** is Saffron, box `2576,2488,2688,2568,7` — 9,150 tiles covering both
the Pokemon Center and the market. Ten NPCs stand inside it, including the
healer and Mark's shop.

**Hunts** are not authored. They are clustered out of `map-spawn.xml` so every
zone corresponds to somewhere the live server actually spawns that species:

```bash
node packages/content-compiler/src/cli.ts hunts
```

799 zones across 280 species, from 9,121 spawn points. Single-link clustering
on Chebyshev distance, 30 tiles, per species per floor. Level curve runs
p25 = 10, p50 = 30, p75 = 60, p100 = 150.

Only two spawn names have no script behind them: `Eletrike` (a typo for
Electrike, 16 placements) and `Dummy` (3 placements, a training target).

### Packing a hunt zone

A zone already knows its own extent, so it does not need a hand-written box:

```bash
node packages/content-compiler/src/cli.ts pack --hunt bellsprout-base-z7-1 --budget 12
```

The box comes from the cluster's spawn extent plus padding, and the release
picks up every wild spawn inside it — not only the zone's headline species.
The Bellsprout field packs 99 placements across four species: Bellsprout x46,
Oddish x38, Weepinbell x13, Machoke x2. That mix is what makes it read as a
place rather than a spawner, and it comes straight from the server's data.

5.7 MB for 21,246 tiles over 12 chunks.

### The healer is not Nurse Joy

`Nurse Joy` is defined in `data/npc` but has **zero placements** anywhere on
the map. The NPC that actually heals in Saffron is `Nurse` (lookType 2636,
script `healer.lua`), standing three tiles from the temple beside
`Nurse Chansey` (2599). Anything that assumes "Joy" by name will find nothing.

## Data hazards in the base

Three cases where the source data disagrees with itself. All three are
detected and reported rather than resolved by accident, because each one
silently produced wrong output first.

**42 Pokemon scripts register the wrong name.** 40 files under a `shiny/`
folder call `createMonsterType` with the plain species name, and 2 under
`mega/` register a `Shiny` name. On the live server the later load wins, so
`kanto/shiny/shiny pikachu.lua` overwrites Pikachu: the base form's 4,640 HP
and 1,454 exp become the shiny's 5,000 HP and 1 exp. The registry keys on the
folder, never the registered name, so a mis-named variant cannot displace the
species it shadows. `species` lists them all.

**22 NPC names are declared by more than one file.** `Jack.xml`, `Mark.xml`
and `Mark_backup.xml` all register an npc called "Mark", with different
outfits. Selection prefers the file named after the npc, so Mark resolves to
lookType 2598 and not to whatever the directory happened to yield first.

**542 loot entries reference items that do not exist.** Of the 45 distinct item
names the Pokemon loot tables use, three — `rubber ball`, `snow ball` and
`band aid` — appear nowhere else in the base: not in `items.xml`, not among the
43 named entries in `items.otb`, not in any script. On the live server
`CreateItem` by name fails and those drops never materialise. They are common
ones, so the 542 affected entries are 16% of the loot economy. The compiler
reports them and the bag marks them with a dashed slot.

**The spawn floor is the spawn's `centerz`, not the child's `z`.**
`Spawns::loadFromXml` builds every position as
`Position(centerPos.x + child.x, centerPos.y + child.y, centerPos.z)` and
ignores the child's own `z` entirely. Only one entry in 10,078 disagrees, but
the rule matters. Separately, the three Sinnoh zones declare `centerz` 6 while
that area of the map only has ground on floor 7 — those spawns sit on an empty
floor.

**map-spawn.xml contains corrupt respawn timers.** Alongside the sane 40-90
second values sit entries like `spawntime="-1885237504"` and `"1749162496"` —
garbage some editor wrote. 71 of them. A negative respawn makes the encounter
interval negative and every hunt built on that zone nonsensical, and it shows
up as an absurd number on screen rather than a crash. The parser now rejects
anything outside 1-3600 seconds, falls back to 60, and reports the count.

**Chances use two different denominators, and neither is the obvious one.**
`MAX_LOOTCHANCE` in `servidor/src/monsters.h` is 100,000, and the XML loader
clamps to it. That constant is a trap: every Pokemon here is defined in Lua,
and `scripts/lib/register_monster_type.lua` passes the raw value through
`setChance` with no clamp at all. The real scale is settled by
`lib/systems/pokedex.lua`, which renders a drop rate as
`chance / 10000000 * 100` — **loot is out of ten million**. So a chance of
8,000,000 is an 80% drop.

Catch is a third number again: `actions/scripts/poke/catch.lua` rolls
`math.random(0, 10000) <= chance`, so **catch is out of ten thousand** and a
`catchChance` of 400 means 4% before ball multipliers.

Getting this wrong is quiet and total. Clamping loot to 100,000 turns 3,328 of
the 3,332 loot entries into guaranteed drops and the whole economy with them.
At the right scale, none of them are guaranteed.

**Most NPCs share lookType 3328, and the colour channels do not save them.**
Sharing the lookType is not a parsing error. What is easy to get wrong is the
conclusion: it is tempting to assume the head/body/legs/feet attributes in the
xml differentiate them. They do not. Colourisation needs a layer-1 mask, and
of the 4,128 creature appearances only **297** have one. Everything this game
actually uses — lookType 3328, both player outfits (510, 511) and every
Pokemon — is single-layer. Those NPCs render identically because the art says
so, and no renderer pass can change it. Differentiating them means new
sprites, not new code.

## Rendering

```bash
node packages/renderer/src/cli.ts out/release-hub 7/40_39 --out out/chunk.png
```

The layout logic in `packages/renderer/src/layout.ts` is pure: no canvas, no
WebGL, no DOM. It turns a chunk plus the appearance set into an ordered list
of sprite draws, and nothing else. That is what lets the same rules drive both
a browser presenter and the headless rasteriser, and it is why the tricky
parts are unit tested rather than eyeballed.

The rules it encodes:

- **Patterns key on absolute map position**, not chunk-local. Ground variants
  would visibly seam at every chunk edge otherwise.
- **Stack priority** comes from the dat flags, emitted per appearance as `sp`:
  ground 0, border 1, bottom 2, top 3, everything else 5. Ties keep the order
  the map stored them in.
- **Southern rows draw last**, so overhanging art overlaps the tile behind it.
- **Multi-tile appearances anchor at their bottom-right cell** and extend
  north and west from there.
- **Elevation lifts what is stacked above it**, not the thing itself.

Creatures are placed from the release's `npcs.json` and `spawns.json`, which
carry positions as well as outfits. Their x pattern is their **facing**, not their position —
that is the one rule where creatures differ from items.

`rasterChunk` composites straight from the shipped atlas PNGs, so the golden
image tests the real release artifact rather than a parallel code path.
`--crop x,y,w,h` and `--scale n` cut and magnify a window for inspection.

First full render of the Saffron chunk: 3,071 tiles, 7,161 draws, 2176x2176,
211 ms, **zero missing sprites**.

## Web client

```bash
npm run dev            # http://localhost:5173
RELEASE=out/release-hunt npm run dev
```

Drag to pan, `0` to recentre on the trainer, `Esc` to close a panel.
The map renders at native sprite scale and stays there — there is no zoom.

The client imports **the same `layout.ts`** the headless rasteriser uses. The
dev server strips the types on the way out with node's built-in
`stripTypeScriptTypes`, so there is no bundler, no build step, and no second
copy of the layout rules that could drift from the first.

Two things make it hold framerate:

- **Terrain is baked once per chunk** into an offscreen canvas. Re-issuing
  seven thousand `drawImage` calls per frame would not hold sixty; blitting
  nine canvases does.
- **Creatures are drawn live on top**, sorted by world row rather than by
  chunk, so they can move later without invalidating any bake.

Measured on the Saffron hub: 120 fps at 0.38x with 6 chunks and 65 creatures
in view.

Outfit tinting is cached per `sprite:mask:colours` and the atlas pixel data is
only read back when a tintable creature actually appears — which, for this
content, is never.

### Interface

The trainer stands in the CP with four party Pokemon around them, two tiles
apart because most creature appearances are 2x2 and adjacent tiles would smear
them together. The party panel takes its species, base HP and levels from the
release's own `species.json`, so every number traces back to the server's Lua
rather than being invented; current HP, EXP and coins are local state until the
gateway lands.

Interactive things carry a floating label with an action, positioned from world
coordinates each frame:

| Where | Label | Action |
| --- | --- | --- |
| Depot tiles | Depot | Abrir Depot |
| Healer NPCs | their name | Curar |
| Shop NPCs | their name | Conversar |

Depot ids come from `data/items/items.xml` (`type="depot"`); healer and shop
NPCs are classified by script name and shop module when the release is packed.
`Curar` really does restore the party — it is the one action that needs no
server. The others open a panel that says plainly that it is waiting on the
gateway.

Bottom right, **Ir ao Mercado** finds the nearest shop NPC and takes the
trainer there. Walking is the server's job, so for now they simply arrive.

### Hunting

The **Hunts** button opens the zone browser: all 799 zones, searchable by
species, type or region, filterable by level. Picking one starts a run.

The client owns a `HuntRun` from `packages/sim` and advances it on wall time,
once a second — `advance` is chunk-invariant, so ticking once a second gives
exactly the same result as ticking sixty times for a sixtieth of the work.
Every number in the run panel and the combat log comes out of the shared
simulation, the same code the server will run once the gateway exists. Moving
authority across later means changing who calls `advance`, not rewriting what
a hunt means.

The run is checkpointed to `localStorage` on every tick. On load, the time
since that checkpoint goes through the offline path. Verified end to end:
away 2h, credited 1h at 50%, 59 encounters folded at 61.0s each, 1,298
experience — 59 × 22 exactly.

### Pokedex

`--all-species` packs a portrait for every species, not just the ones a hunt
zone spawns: 734 lookTypes covering all 1,057 entries, 33,320 sprites in 9
atlases, 11.9 MB — 47.6% of budget. Without it the release carries only the
244 the hunts reach.

The grid draws portraits lazily through an IntersectionObserver; building a
thousand canvases up front costs seconds and most are never looked at. Only
the visible ~56 are drawn on open.

One trap worth remembering: the observer must **not** take the grid as its
`root`. It is constructed while the panel is still `display:none`, and a root
with no layout box at construction never reports an intersection afterwards —
the callback simply never fires, with no error. Viewport root gives the same
answer because the grid clips its children anyway.

Catches during a run fill the dex, keyed `variant:slug` and persisted in
localStorage.

### Cache and the confetti world

Atlas and minimap URLs carry `?v=<releaseId>`. Without it the browser happily
pairs a cached atlas with a newer `appearances.json`, every sprite id resolves
to the wrong slot, and the world renders as confetti — correct geometry,
completely wrong art. It is worth recognising on sight: if the tiles are in the
right places but show the wrong things, the atlas and the appearance set came
from different builds. The releaseId is a content hash, so a mismatched pair
is now impossible rather than merely unlikely.

### Hunt map

The zone browser is a region map. `--minimaps` renders one image per region at
one pixel per tile, coloured from the dat's `minimapColor` — an index into a
6x6x6 cube that `framework/util/color.h` resolves as `51 *` each digit. All
five regions total 0.7 MB: minimaps are flat colour and compress hard, so the
17.6 megapixels they cover cost almost nothing.

Pins land where the species actually spawns because the minimap and the zone
centres come out of the same release and share one coordinate space. Region
tabs, 19 type chips, a level range and a search narrow the 799 zones; only the
busiest zone per species gets a pin, since overlapping pins are unclickable.

The render is top-down across every floor rather than anchored to one: zones
of a single region are spread over as many as eleven floors, and anchoring to
the most popular one left whole regions blank.

### Bag

Drops and captures from a run are credited to a persistent bag, and the bag
resolves an icon for each drop through an item-name index built from
`items.xml`.

Both the tick path and the offline restore path credit it. That is easy to get
wrong: restore folds encounters without producing lines, so a restore that
stayed silent would swallow everything earned while away.

### Moves and damage

Every one of the 1,057 species declares **two** move blocks, and they are not
the same list:

| Block | Role | Charizard's Flamethrower |
| --- | --- | --- |
| `pokemon.moves` | what the player fights with, carries a per-move `type` | 18s cooldown |
| `pokemon.attacks` | how the species behaves as a wild encounter, carries `chance` | 25s cooldown |

8,102 player moves and 8,084 wild attacks. Reading the wrong one silently
understates a party's output, so the parser makes the caller name the block it
wants rather than guessing.

Party damage is now derived: each move lands `power` every `interval`
milliseconds, `chance` percent of the time, and those rates sum. Species stop
being interchangeable — Cyndaquil sustains 2.3 to Poliwhirl's 5.6 before level
scaling. The level term is still ours to tune, because the base has no
player-level damage formula to read, but the per-species shape is the server's
own data.

52 species declare no moves at all and contribute nothing to damage.

The Pokedex shows a species' move list on click, and each gym card shows its
roster's moves the same way.

### Gyms

All eight Kanto leaders exist as npcs, and the base already models rosters as
npcs named `<Leader>'s <Species>` — Brock has five, Misty six, Sabrina one.
The other five leaders have none, so those rosters are generated and flagged
`fromBase: false`; the panel says so on screen rather than passing a generated
team off as the base's own content.

The fill rule took two attempts. "Strongest species of the gym's element" is
the obvious one and it is wrong: it hands the third gym Raikou and Zapdos.
Nothing in the data marks a legendary — Raikou reports `minimumLevel` 1 and
the same catch chance as Pikachu. The one clean signal is health, where twenty
species sit above a million while ordinary ones are in the thousands. Filtering
those out and ordering by distance from the gym's own level gives Surge
Electrode and Flaaffy instead.

### Onboarding

Login, account creation, trainer setup and starter choice, gated in front of
the world. `ensureAccount` resolves immediately when an account is stored and
otherwise walks the four screens; the caller awaits it before building the
game. It runs after the atlases load, because the outfit and starter pickers
draw real sprites.

**No password is ever stored.** There is no server to authenticate against, so
the field exists to make the flow real and nothing more — putting a password
in localStorage would be security theatre and worse than storing nothing.
Wiring this to the gateway later means replacing one function, not redesigning
the screens. For the same reason an unknown e-mail continues into account
creation rather than pretending to reject a password it cannot check.

The nine starters come from the species registry, three per generation:
Bulbasaur/Charmander/Squirtle, Chikorita/Cyndaquil/Totodile and
Treecko/Torchic/Mudkip. The chosen one leads the party.

`portrait.ts` exists because two callers need appearance thumbnails at
different moments — onboarding before the world exists, the game after — and
one implementation keeps a Bulbasaur looking the same in both.

### Profile and depot

The profile shows lifetime totals: hunt time, kills, experience, captures,
pokedex progress and what sits in the bag versus the depot. The depot is two
columns with click-to-move and a "store everything" button; the world's
`Abrir Depot` label opens it.

Two ordering traps bit here, both the same shape. `const` declarations in a
function body are not hoisted, so anything wired early that reaches for
something declared later throws at call time with nothing in the console
until it fires. The offline restore had to move below the bag it credits, and
the depot is reached through a late-bound `openDepot` hook because the world
labels are wired before the depot panel exists.

Lifetime hunt time is accumulated from **deltas**, never from a run's own
`activeMs`. A run carries its accumulated time across sessions, so booking
that total on first sight double-counts the whole history and leaves hunt time
disagreeing with the kills that produced it.

### Measuring framerate

`requestAnimationFrame` is throttled hard when the browser pane is hidden, so
an fps reading taken while the pane is not on screen will say something like
5 fps and mean nothing. Read it from a visible pane: the hub sits at 120-130.

## Offline progression

```bash
npm test
```

The mechanic that separates an idle game from an MMO with auto-attack, and the
one the original roadmap never specified. It lives in `packages/sim`.

**Efficiency scales time, not rewards.** An offline hour becomes a smaller
number of *active* milliseconds, and those milliseconds then run through the
exact same encounter fold as live play. Scaling the rewards instead would make
an offline encounter differ from an online one and the determinism guarantee
would be gone. Defaults: an 8 hour cap at 50% efficiency.

**Encounters are addressed, not streamed.** Every random draw is a pure
function of `(seed, encounterIndex, channel)`, so the outcome of encounter
5,000 is the same whether the run was simulated in one pass or resumed forty
times. The only carried quantity is `activeMs`.

That makes the roadmap's hardest gate hold by construction rather than by
luck. Three tests pin it down:

- advancing 8 hours in one call equals advancing it in irregular slices
- the same, sliced one millisecond at a time
- suspending, closing for 8 hours and resuming equals never having left

Also covered: the cap discards rather than banks time, a replayed resume pays
nothing, a suspended run earns nothing from a stray tick, settle is
idempotent, and every mutation bumps `revision` so stale commands are
rejectable.

`now` always comes from the server clock. A client-supplied timestamp there
would let a player mint experience by lying about how long they were away.

### States

`IDLE -> TELEPORTING -> RUNNING -> RETURNING -> SETTLING -> DONE`, with
`SUSPENDED` hanging off `RUNNING` for the offline case. Stop reasons are
explicit: `encounter-limit`, `time-limit`, `loot-full`, `player-command`.

## Gateway protocol

`packages/gateway` speaks the login protocol the server expects, built from
`servidor/src/protocollogin.cpp` and `xtea.cpp` rather than from a spec. It
needs no database, which is why it exists ahead of one.

The handshake carries **two** RSA blocks, not one. The first holds the XTEA
key both sides use for the rest of the session plus the credentials; the
second sits at the very end and carries the authenticator token. The server
finds that second block by seeking to `length - 128` rather than reading
forward, so its position at the tail is load-bearing — anything between the
two is skipped.

Blocks are raw RSA with no padding scheme: exactly 128 bytes, laid out by hand
with a leading zero that tells the server decryption worked. `RSA_NO_PADDING`
is therefore correct and anything but 128 bytes is refused rather than padded.

XTEA is written out rather than pulled from a dependency because the wire
format has to match `xtea.cpp` exactly — one wrong rotation and every packet
after the handshake is silently garbage instead of an error.

The decisive test builds a packet with the public half of `servidor/key.pem`,
decrypts both blocks with the private half, and asserts the session key,
account name, password and token all come back. That validates the whole
layout against the real key without a server running.

### Why not a schema

Deriving `schema.sql` from the source was the other way to unblock this. The
column *names* are readable — `iologindata.cpp` alone touches 97, including
fork-specific ones like `esferalendaria`, `pokemons`, `saffari` and
`lookshader`. Their types, widths, defaults and indexes are not. An `INT`
where the base wants a `BIGINT` overflows a player's experience silently.
That is a guess dressed as a deliverable, so the dump is still the answer.

## Database

Nothing is installed on the host — MariaDB runs in a container matched to
`servidor/config.lua` exactly as shipped (`poke2`, root, empty password):

```bash
docker compose -f infra/docker-compose.yml up -d
```

**A dump is required.** There is no `schema.sql` anywhere in this base, and a
generic TFS one will not do: the fork queries tables no upstream schema has.
Drop the dump in `infra/dump/` before the first start — see that folder's
README, and `docs/database-tables.md` for the table inventory to check it
against.

## Format notes worth keeping

Things that cost time to discover and are easy to get wrong again:

- **items.otb stores the client version as an enum ordinal**, not a literal.
  `57` means 10.98. Comparing it to `1098` fails.
- **The OTBM root node has type byte `0`**, not `OTBM_ROOTV1` (1). Matching on
  the type silently drops the entire tree.
- **A tile's inline `OTBM_ATTR_ITEM` carries only a `u16` id**, no attributes —
  `Item::CreateItem(PropStream&)` reads nothing more.
- **`ThingAttrBones` (38) is specific to this fork** and does not exist upstream.
  It carries 8 `u16` values (N/S/E/W points).
- Property ranges are escape-encoded, so they must be scanned, never skipped by
  length.

## Layout

```
packages/client/
  server.ts              static server, strips .ts types on the way out
  index.html
  src/main.ts            canvas presenter, camera, chunk baking
  src/hunt.ts            run controller: ticking, logging, offline restore
packages/renderer/src/
  layout.ts              pure draw-list builder: order, patterns, anchoring
  outfit.ts              133-colour palette and mask tinting
  raster.ts              headless compositor over the shipped atlases
  cli.ts
packages/sim/src/
  rng.ts                 addressed draws: pure in (seed, index, channel)
  hunt.ts                run state machine, encounter fold, stop policies
  offline.ts             suspend, resume, cap and efficiency
packages/content-compiler/src/
  config.ts              paths + the compatibility matrix as code
  io/reader.ts           little-endian cursor over a Buffer
  io/png.ts              zero-dependency RGBA8 PNG encoder
  formats/spr.ts         Tibia.spr — positioned reads, never loaded whole
  formats/dat.ts         Tibia.dat — appearances, frame groups, animators
  formats/node-tree.ts   the OTB container shared by items.otb and OTBM
  formats/otb.ts         items.otb — serverId <-> clientId
  formats/otbm.ts        OTBM — tiles, with area-level bounding box rejection
  cli.ts
```

## Next

1. ~~Atlas packer with a declared cutout and a hard byte budget.~~ Done.
2. ~~Creature appearances, hunt zones and the species registry.~~ Done.
3. ~~Renderer for one static chunk.~~ Done, headless and under test.
4. ~~Outfit colourisation.~~ Implemented in `outfit.ts` and under test, but
   inert for this content: see the note above on layer counts. It serves the
   297 leftover vanilla outfits, not the Pokemon ones.
5. ~~Creatures and NPCs in the draw list.~~ Done, placed from `npcs.json`.
6. ~~Wild Pokemon in hunt zones.~~ Done, placed from `spawns.json`.
7. ~~Browser presenter over the same layout module.~~ Done.
8. Golden-image comparison against the desktop client — the Phase 0 gate.
9. Minimap raster from the dat's `minimapColor`.
10. Wire the sim to the client: a hunt run driving what the viewport shows.
11. ~~Offline progression model.~~ Done, with the determinism gate under test.
12. Gateway spike: log into TFS from Node and re-emit map/creature packets as
   JSON. Blocked on the database dump.
