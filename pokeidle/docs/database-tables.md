# Database tables this server needs

Extracted from the fork itself, not from an upstream TFS schema: table names
were read out of the SQL in `servidor/src/*.cpp` and the backtick-quoted
queries in `servidor/data/**/*.lua`.

The point of this list is to check a dump before importing it. If a dump is
missing tables from the "fork-specific" sections, the server will start and
then fail at runtime the first time that system is touched.

## Standard TFS tables (29, from C++)

Referenced by `servidor/src`:

```
accounts                account_bans            account_ban_history
account_viplist         ip_bans                 players
players_online          player_deaths           player_items
player_depotitems       player_inboxitems       player_spells
player_storage          player_namelocks        player_oldnames
guilds                  guild_members           guild_ranks
guild_invites           guild_wars              guilds_inbox
houses                  house_lists             market_offers
server_config           tile_store
```

`information_schema` also appears — that is MariaDB's own catalog, queried by
`DatabaseManager::tableExists`, not something a dump provides.

`server_config` is the one table the server creates by itself on first boot
(`databasemanager.cpp`). Everything else must already exist.

## Fork-specific tables from C++ (3)

```
pokeball_stats          pokemon_points          players_stringstorages
```

No upstream schema has these. They have zero references in Lua, so they are
touched only by the C++ layer.

## Fork-specific tables from Lua

Confirmed via backtick-quoted queries:

```
boss_ranking            daily_points            global_storage
guilds_player_inbox     guildwar_kills          historico_pagamentos
pix_payment             player_misc             shop_historico
shop_history            spectate_bans
```

Confirmed via unquoted queries:

```
player_ditto_memory_slots
```

Additional names appear unquoted across the Lua tree and are likely tables,
but the surrounding queries are built by string concatenation so they could
not be attributed with confidence: `channels`, `bank`, `spectating`,
`watching`, `points`. Treat a dump that lacks them as suspect rather than
broken.

## How to verify a dump before trusting it

With the database up and the dump imported:

```bash
docker exec pokeidle-db mariadb -uroot poke2 -e "SHOW TABLES" 
```

Compare against the lists above. The systems most likely to be silently
missing are the payment ones (`pix_payment`, `historico_pagamentos`), the
shop history pair, and `player_ditto_memory_slots` — none of which any
generic TFS schema will contain.

## Note on the database name

`servidor/config.lua` sets `mysqlDatabase = "poke2"`.
`servidor/start.sh` dumps a database called `poke`.

Those disagree. Confirm which one the live server actually writes to before
copying a dump, and rename it on import if needed.
