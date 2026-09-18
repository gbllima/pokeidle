# Schema: what exists, what does not

Written after searching this machine for a schema that fits this fork. It does
not exist here. This is the evidence and the shortest way out.

## The search

Two `.sql` files exist across every Poketibia base on the Desktop, and both are
the same dump from a different server ("Servidor Myst", 6 generations). A
Canary schema also sits on the Desktop. Neither fits:

| | Myst dump |
| --- | --- |
| Tables it has | 97 |
| Of the 29 our C++ queries | 18 present, **11 missing** |
| Of the 12 our Lua queries | 2 present, **10 missing** |
| Of the 21 custom `players` columns | **0 present** |

Combining Myst with Canary still leaves six standard tables and nine
fork-specific ones with no source at all.

## Table coverage

| Table | Required by | Available from |
| --- | --- | --- |
| `account_ban_history` | C++ | Canary |
| `account_bans` | C++ | Canary |
| `account_viplist` | C++ | Myst |
| `accounts` | C++ | Myst |
| `boss_ranking` | Lua | — |
| `daily_points` | Lua | — |
| `global_storage` | Lua | Myst |
| `guild_invites` | C++ | Myst |
| `guild_members` | C++ | — |
| `guild_ranks` | C++ | Myst |
| `guild_wars` | C++ | Myst |
| `guilds` | C++ | Myst |
| `guilds_inbox` | C++ | — |
| `guilds_player_inbox` | Lua | — |
| `guildwar_kills` | Lua | Canary |
| `historico_pagamentos` | Lua | — |
| `house_lists` | C++ | Myst |
| `houses` | C++ | Myst |
| `ip_bans` | C++ | Canary |
| `market_offers` | C++ | Myst |
| `pix_payment` | Lua | — |
| `player_deaths` | C++ | Myst |
| `player_depotitems` | C++ | Myst |
| `player_ditto_memory_slots` | Lua | — |
| `player_inboxitems` | C++ | Canary |
| `player_items` | C++ | Myst |
| `player_misc` | Lua | — |
| `player_namelocks` | C++ | Myst |
| `player_oldnames` | C++ | — |
| `player_spells` | C++ | Myst |
| `player_storage` | C++ | Myst |
| `players` | C++ | Myst |
| `players_online` | C++ | Canary |
| `players_stringstorages` | C++ | — |
| `pokeball_stats` | C++ | — |
| `pokemon_points` | C++ | — |
| `server_config` | C++ | Myst |
| `shop_historico` | Lua | — |
| `shop_history` | Lua | Myst |
| `spectate_bans` | Lua | — |
| `tile_store` | C++ | Myst |

## Column types are derivable

The server reads every column through a typed getter, so a type can be read
out of the source rather than guessed:

| Custom column | Read as | Implies |
| --- | --- | --- |
| `esferadepal` | `uint32_t` | INT UNSIGNED |
| `esferagiga` | `uint32_t` | INT UNSIGNED |
| `esferalendaria` | `uint32_t` | INT UNSIGNED |
| `esferamega` | `uint32_t` | INT UNSIGNED |
| `esferatera` | `uint32_t` | INT UNSIGNED |
| `esferaultra` | `uint32_t` | INT UNSIGNED |
| `pokemons` | `string` | TEXT |
| `pokemonName` | `string` | TEXT |
| `saffari` | `uint32_t` | INT UNSIGNED |
| `lookaura` | `uint16_t` | SMALLINT UNSIGNED |
| `lookwings` | `uint16_t` | SMALLINT UNSIGNED |
| `lookshader` | `uint16_t` | SMALLINT UNSIGNED |
| `divine` | `uint32_t` | INT UNSIGNED |
| `dusk` | `uint32_t` | INT UNSIGNED |
| `moon` | `uint32_t` | INT UNSIGNED |
| `sora` | `uint32_t` | INT UNSIGNED |
| `yume` | `uint32_t` | INT UNSIGNED |
| `janguru` | `uint32_t` | INT UNSIGNED |
| `magu` | `uint32_t` | INT UNSIGNED |
| `tinker` | `uint32_t` | INT UNSIGNED |
| `premier` | `uint32_t` | INT UNSIGNED |

138 columns across the codebase resolve this way. Twelve are ambiguous because
the same name means different things in different tables — `value` is a string
in one and a number in another — so a generator has to key on table context,
not column name.

## What is still not derivable

Types are readable. These are not:

- **Indexes on the fork's own tables.** The nineteen stock tables get their
  real keys from the Myst dump, which declares them in trailing `ALTER TABLE`
  statements rather than inline — easy to miss, and missing them costs no error
  at all, just a table with no primary key. For the tables the fork added there
  is nothing to copy: they are recoverable in part from `WHERE` clauses, and a
  missed one turns into a slow query under load rather than a failure.
- **Defaults and NOT NULL.** A column that should default to 0 and instead
  allows NULL fails at the first row the server writes without it.
- **String widths.** `getString` says TEXT or VARCHAR, not `VARCHAR(32)`.
- **Foreign keys and cascade rules.** These are what keep a deleted account
  from leaving orphaned characters behind.

A reconstruction would boot and then be wrong in ways that surface as data
bugs weeks later. That is worse than not booting.

Two sources cut into that risk more than expected, and both were already in the
tree:

- **Positional `INSERT`s.** Lua writes several tables as
  `INSERT INTO guilds_inbox VALUES (NULL, ...)` with no column list. That
  pins the column count and the order exactly, and it fails loudly if either is
  wrong — so those tables are recovered rather than guessed. `guilds_inbox`,
  `guilds_player_inbox` and `guildwar_kills` were all wrong before this and
  would have failed on first write.
- **`data/logs/stats/sql.log`.** 195,000 lines of real production queries left
  in the base, including the `INSERT` column lists for `pokemon_points`,
  `players_stringstorages` and the item tables, and the detail that
  `shop_history` keys on `account`, not `account_id`.

## The shortest way out

`servidor/start.sh` already writes a dump on every restart:

```
mysqldump -u root -p<senha> poke > backups/$(date '+%Y-%m-%d_%H-%M').sql
```

Structure alone is enough — no player data has to leave the box:

```bash
mysqldump --no-data --routines --triggers -u root -p poke > schema.sql
```

Drop the file in `infra/dump/` and `docker compose up -d` imports it.

## If the dump is genuinely unreachable

A reconstruction can be built from the sources above: standard tables from the
Myst dump, five more from Canary, the rest written from the queries that touch
them, with types derived as shown. TFS then validates it by refusing to start
until it is right. Expect the custom tables to need several rounds, and expect
indexes and defaults to stay approximate.
