#!/usr/bin/env node
/**
 * Reconstruct a bootable schema for this fork.
 *
 * There is no schema.sql anywhere in the base, and the only dumps on the
 * machine belong to a different server. This assembles one from sources that
 * are real rather than invented:
 *
 *   - stock TFS tables come from a Poketibia dump of the same lineage, keys
 *     included: that exporter declares them in trailing ALTER TABLE
 *     statements, so reading only the CREATEs yields tables with no keys
 *   - five more come from a Canary schema
 *   - the fork's own tables are written from the named INSERT statements in
 *     servidor/src, which spell out their exact column lists
 *   - `players` is the dump's table plus the fourteen skill columns Canary
 *     defines and the three look columns this fork added
 *   - several Lua-side tables are recovered from positional INSERTs, which pin
 *     both the column count and the order, with names taken from the SELECTs
 *     that read the same rows back
 *   - a few more are confirmed against data/logs/stats/sql.log, a production
 *     query log left in the base
 *
 * The server boots on this, and a gateway logs in through it. What remains are
 * the tables reached only by concatenated queries with no INSERT to anchor
 * them; those are marked as stubs below and will fail when first touched,
 * which is the point at which the real dump becomes unavoidable.
 *
 * Usage: node infra/build-schema.mjs > infra/dump/01-schema.sql
 */

import { readFileSync } from 'node:fs';

const MYST = process.env.MYST_SQL ??
  'C:/Users/Dev Alx/Desktop/bases poke idle/6 gerações/Servidor Myst/pokemist.sql';
const CANARY = process.env.CANARY_SQL ??
  'C:/Users/Dev Alx/Desktop/base crystal/canary-main/schema.sql';

const read = (path) => readFileSync(path, 'latin1');

/**
 * Pull one CREATE TABLE statement out of a dump.
 *
 * Depth-counted rather than regex-matched on `\n)`: Canary writes multi-line
 * FOREIGN KEY clauses, and a pattern that stops at the first closing paren on
 * its own line truncates the table halfway through a constraint. The result
 * imports the tables before it and then dies, which is exactly what happened.
 */
function extract(sql, table) {
  const head = new RegExp('CREATE TABLE (?:IF NOT EXISTS )?`' + table + '` *\\(', 'i');
  const m = head.exec(sql);
  if (!m) return null;

  const open = m.index + m[0].length;
  let depth = 1;
  let i = open;
  for (; i < sql.length && depth > 0; i++) {
    const ch = sql[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
  }
  if (depth !== 0) return null;

  const close = i - 1;
  const semi = sql.indexOf(';', close);
  return {
    body: sql.slice(open, close).replace(/\s*$/, ''),
    tail: sql.slice(close + 1, semi === -1 ? undefined : semi),
  };
}

/**
 * Drop foreign keys from a borrowed table.
 *
 * The Canary tables reference Canary's own `accounts` and `players`, which are
 * not the ones this schema ends up with — the column signedness alone differs,
 * and MariaDB rejects the whole CREATE with errno 150. Mixing two lineages
 * makes these constraints wrong by construction, and the server enforces the
 * same relationships in code, so they come out rather than being patched up.
 */
function stripForeignKeys(body) {
  const kept = [];
  let depth = 0;
  let line = '';

  for (const ch of `${body}\n`) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === '\n' && depth === 0) {
      kept.push(line);
      line = '';
      continue;
    }
    line += ch;
  }

  const clauses = kept
    .join('\n')
    .split(/,\s*\n/)
    .map((c) => c.trim())
    .filter((c) => c && !/^(CONSTRAINT\s+`?[^`\s]+`?\s+)?FOREIGN KEY/i.test(c))
    // `CONSTRAINT x PRIMARY KEY (...)` is valid but noisy once the FK naming
    // scheme it belonged to is gone.
    .map((c) => c.replace(/^CONSTRAINT\s+`?[^`\s]+`?\s+(PRIMARY KEY)/i, '$1'));

  return `\n${clauses.map((c) => `  ${c}`).join(',\n')}`;
}

/**
 * Collect the keys a phpMyAdmin dump declares away from its CREATE TABLE.
 *
 * That exporter writes bare column lists and then puts every PRIMARY KEY,
 * UNIQUE KEY, KEY and AUTO_INCREMENT in trailing `ALTER TABLE` statements.
 * Reading only the CREATEs produced tables with no primary key at all — they
 * import and the server boots, so nothing complains, but `INSERT INTO
 * accounts SET name = ...` has no id to generate and every lookup is a scan.
 *
 * Foreign keys are dropped for the same reason they are dropped from the
 * Canary tables: this schema mixes lineages and half the referenced tables are
 * stubs here.
 */
function alterClauses(sql, table) {
  const re = new RegExp('^ALTER TABLE `' + table + '`([\\s\\S]*?);\\s*$', 'gmi');
  const clauses = [];

  for (const block of sql.matchAll(re)) {
    let depth = 0;
    let current = '';
    for (const ch of block[1]) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        clauses.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    clauses.push(current);
  }

  return clauses
    .map((c) => c.trim().replace(/\s+/g, ' '))
    .filter((c) => c && !/^ADD CONSTRAINT/i.test(c))
    // The dump's counter reflects its own data; this schema starts empty.
    .filter((c) => !/^AUTO_INCREMENT\s*=/i.test(c))
    .map((c) => c.replace(/\s+AUTO_INCREMENT\s*=\s*\d+/i, ''));
}

function columnLine(body, column) {
  const re = new RegExp('^\\s*`' + column + '`\\s+([^\\n]*?),?\\s*$', 'mi');
  const m = re.exec(body);
  return m ? m[1].replace(/,$/, '') : null;
}

const myst = read(MYST);
const canary = read(CANARY);

const out = [];
const say = (s = '') => out.push(s);

say('-- Reconstructed schema for the PokeIdle base.');
say('-- Generated by infra/build-schema.mjs. Not a substitute for the real dump:');
say('-- see docs/database-schema.md for what is derived and what is a stub.');
say('');
say('SET NAMES utf8mb4;');
say('SET FOREIGN_KEY_CHECKS = 0;');
say('');

/** Tables taken verbatim from the Poketibia dump. */
const FROM_MYST = [
  'accounts', 'account_viplist', 'players', 'player_deaths', 'player_items',
  'player_depotitems', 'player_spells', 'player_storage', 'player_namelocks',
  'guilds', 'guild_ranks', 'guild_invites', 'guild_wars', 'houses',
  'house_lists', 'market_offers', 'server_config', 'tile_store', 'global_storage',
];

/** Tables the Poketibia dump lacks but Canary defines identically enough. */
const FROM_CANARY = [
  'account_bans', 'account_ban_history', 'ip_bans', 'players_online',
  'player_inboxitems',
];

/** Skill columns this fork's loadPlayer selects but the Poketibia dump dropped. */
const SKILLS = [
  'fist', 'club', 'sword', 'axe', 'dist', 'shielding', 'fishing',
].flatMap((s) => [`skill_${s}`, `skill_${s}_tries`]);

const canaryPlayers = extract(canary, 'players');

/**
 * Columns this fork queries that the source dump does not define.
 *
 * Each one was reported by the server itself on a boot attempt — it names the
 * table and column it could not find — and typed from the getter the C++ reads
 * it with. That loop is what makes this a reconstruction rather than a guess:
 * the server refuses to work until the schema matches what it asks for.
 */
const EXTRA_COLUMNS = {
  players: [
    // getNumber<uint64_t>("deletion"), a deletion timestamp; 0 means active.
    ['deletion', 'bigint(20) UNSIGNED NOT NULL DEFAULT 0'],
    // getString("pokemons") in getInfoForCharacter, sent with the character
    // list so the select screen can draw the team before the world loads.
    // logout.lua writes json.encode of {name, boost, level, looktype} and an
    // empty team as the literal '[]', which is why that is the default.
    ['pokemons', "text NOT NULL DEFAULT '[]'"],
  ],
  accounts: [
    // IOLoginData::loadAccount selects all four. A missing column does not
    // announce itself: storeQuery returns null, loadAccount returns false, and
    // the login server answers "Account name or password is not correct." —
    // a schema fault wearing a credentials error as a disguise.
    // decodeSecret(getString("secret")); empty means no authenticator.
    ['secret', "char(16) NOT NULL DEFAULT ''"],
    // getNumber<int32_t>("type") cast to AccountType_t; NORMAL is 1.
    ['type', 'tinyint(1) NOT NULL DEFAULT 1'],
    // IOCreateAccountData writes both on registration: time(nullptr) and the
    // caller's IP as a number, which is how the 5-minute throttle counts.
    ['creation', 'int(11) NOT NULL DEFAULT 0'],
    ['creationIp', 'int(10) UNSIGNED NOT NULL DEFAULT 0'],
    // The Lua shop currency. The dump has `premium_points`, but every script
    // in data/ spends `pontos`, and bankLib subtracts from it directly — so
    // the two are not the same column under different names.
    ['pontos', 'int(11) NOT NULL DEFAULT 0'],
  ],
  market_offers: [
    // getNumber<int>("currency"), the item id an offer is priced in.
    ['currency', 'int(11) NOT NULL DEFAULT 0'],
    // Serialised item attributes, stored the way player_items stores them.
    ['attributes', 'blob NOT NULL'],
  ],
};

for (const table of FROM_MYST) {
  const found = extract(myst, table);
  if (!found) {
    say(`-- MISSING from source dump: ${table}`);
    continue;
  }

  let body = found.body;

  if (table === 'players') {
    const extra = [];
    for (const skill of SKILLS) {
      if (columnLine(body, skill)) continue;
      const def = canaryPlayers ? columnLine(canaryPlayers.body, skill) : null;
      // Canary's own definition where possible; the stock TFS default otherwise.
      extra.push(
        `  \`${skill}\` ${def ?? (skill.endsWith('_tries')
          ? 'bigint(20) UNSIGNED NOT NULL DEFAULT 0'
          : 'int(10) UNSIGNED NOT NULL DEFAULT 10')}`,
      );
    }
    // The three this fork added, typed from how the server reads them:
    // lookaura and lookwings via getNumber<uint32_t>, lookshader via uint16_t.
    for (const [col, type] of [
      ['lookaura', 'int(10) UNSIGNED NOT NULL DEFAULT 0'],
      ['lookwings', 'int(10) UNSIGNED NOT NULL DEFAULT 0'],
      ['lookshader', 'smallint(5) UNSIGNED NOT NULL DEFAULT 0'],
    ]) {
      if (!columnLine(body, col)) extra.push(`  \`${col}\` ${type}`);
    }
    if (extra.length) body = `${body.replace(/,?\s*$/, ',')}\n${extra.join(',\n')}`;
  }

  // Columns the boot log said were missing, whatever the table.
  const patches = (EXTRA_COLUMNS[table] ?? []).filter(([col]) => !columnLine(body, col));
  if (patches.length) {
    body = `${body.replace(/,?\s*$/, ',')}\n${patches
      .map(([col, type]) => `  \`${col}\` ${type}`)
      .join(',\n')}`;
  }

  say(`DROP TABLE IF EXISTS \`${table}\`;`);
  say(`CREATE TABLE \`${table}\` (${body}\n)${found.tail};`);

  const keys = alterClauses(myst, table);
  if (keys.length) {
    say(`ALTER TABLE \`${table}\`\n${keys.map((c) => `  ${c}`).join(',\n')};`);
  }
  say('');
}

for (const table of FROM_CANARY) {
  const found = extract(canary, table);
  if (!found) {
    say(`-- MISSING from canary: ${table}`);
    continue;
  }
  say(`DROP TABLE IF EXISTS \`${table}\`;`);
  say(`CREATE TABLE \`${table}\` (${stripForeignKeys(found.body)}\n)${found.tail};`);
  say('');
}

/**
 * The fork's own tables, written from the named INSERT statements in
 * servidor/src. Types follow the typed getters the server reads them with.
 */
const POKEBALL_COLUMNS = [
  'poke', 'great', 'ultra', 'saffari', 'master', 'moon', 'tinker', 'sora',
  'dusk', 'yume', 'tale', 'net', 'janguru', 'magu', 'fast', 'heavy', 'premier',
  'delta', 'esferadepal', 'esferamega', 'esferagiga', 'esferatera',
  'esferaultra', 'esferalendaria', 'super', 'especial', 'divine',
];

say('-- Fork tables, from the named INSERTs in servidor/src.');
say('DROP TABLE IF EXISTS `pokeball_stats`;');
say('CREATE TABLE `pokeball_stats` (');
say('  `player_id` int(11) NOT NULL,');
say('  `pokemonName` varchar(255) NOT NULL,');
say(POKEBALL_COLUMNS.map((c) => `  \`${c}\` int(10) UNSIGNED NOT NULL DEFAULT 0`).join(',\n') + ',');
say('  KEY `player_id` (`player_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

say('DROP TABLE IF EXISTS `pokemon_points`;');
say('CREATE TABLE `pokemon_points` (');
say('  `player_id` int(11) NOT NULL,');
say('  `pokemonName` varchar(255) NOT NULL,');
say('  `pontos` int(10) UNSIGNED NOT NULL DEFAULT 0,');
say('  KEY `player_id` (`player_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

say('DROP TABLE IF EXISTS `players_stringstorages`;');
say('CREATE TABLE `players_stringstorages` (');
say('  `player_id` int(11) NOT NULL,');
say('  `key` int(10) UNSIGNED NOT NULL,');
say('  `value` text NOT NULL,');
say('  UNIQUE KEY `player_key` (`player_id`, `key`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

say('DROP TABLE IF EXISTS `player_oldnames`;');
say('CREATE TABLE `player_oldnames` (');
say('  `id` int(11) NOT NULL AUTO_INCREMENT,');
say('  `player_id` int(11) NOT NULL,');
say('  `oldname` varchar(255) NOT NULL,');
say('  PRIMARY KEY (`id`),');
say('  KEY `player_id` (`player_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

// guild_members and guilds_inbox are written positionally by the server, so
// the column names had to be taken from the SELECTs that read them back.
say('DROP TABLE IF EXISTS `guild_members`;');
say('CREATE TABLE `guild_members` (');
say('  `player_id` int(11) NOT NULL,');
say('  `guild_id` int(11) NOT NULL,');
say('  `rank_id` int(11) NOT NULL,');
say('  `nick` varchar(15) NOT NULL DEFAULT "",');
say('  `leader` tinyint(1) NOT NULL DEFAULT 0,');
say('  `extra` int(11) NOT NULL DEFAULT 0,');
say('  UNIQUE KEY `player_id` (`player_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

// A positional INSERT pins the column order exactly, and a positional INSERT
// with the wrong number of columns fails outright — so these are recovered,
// not guessed:
//   INSERT INTO `guilds_inbox` VALUES (NULL, targetId, guildId, os.time(),
//                                      msgType, text, 0)
// and the names come from the SELECTs that read the same rows back.
say('DROP TABLE IF EXISTS `guilds_inbox`;');
say('CREATE TABLE `guilds_inbox` (');
say('  `id` int(11) NOT NULL AUTO_INCREMENT,');
say('  `target_id` int(11) NOT NULL DEFAULT 0,');
say('  `guild_id` int(11) NOT NULL DEFAULT 0,');
say('  `time` int(11) NOT NULL DEFAULT 0,');
say('  `type` int(11) NOT NULL DEFAULT 0,');
say('  `text` text,');
say('  `finished` tinyint(1) NOT NULL DEFAULT 0,');
say('  PRIMARY KEY (`id`),');
say('  KEY `guild_id` (`guild_id`),');
say('  KEY `target_id` (`target_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

// INSERT INTO `guilds_player_inbox` VALUES (member.guid, inboxId) — two
// columns and no surrogate key. An `id` column here would break every write.
say('DROP TABLE IF EXISTS `guilds_player_inbox`;');
say('CREATE TABLE `guilds_player_inbox` (');
say('  `player_id` int(11) NOT NULL,');
say('  `inbox_id` int(11) NOT NULL,');
say('  UNIQUE KEY `player_inbox` (`player_id`,`inbox_id`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

// INSERT INTO `guildwar_kills` VALUES (0, warId, killerName, victimName,
//                                      killerId, victimId, os.time())
// with the names taken from `SELECT k.warid, k.killer, k.target, k.killerguild`
// and the `targetguild` the same WHERE clause filters on.
say('DROP TABLE IF EXISTS `guildwar_kills`;');
say('CREATE TABLE `guildwar_kills` (');
say('  `id` int(11) NOT NULL AUTO_INCREMENT,');
say('  `warid` int(11) NOT NULL DEFAULT 0,');
say('  `killer` varchar(50) NOT NULL,');
say('  `target` varchar(50) NOT NULL,');
say('  `killerguild` int(11) NOT NULL DEFAULT 0,');
say('  `targetguild` int(11) NOT NULL DEFAULT 0,');
say('  `time` bigint(20) UNSIGNED NOT NULL DEFAULT 0,');
say('  PRIMARY KEY (`id`),');
say('  KEY `warid` (`warid`)');
say(') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');
say('');

/**
 * Lua-side tables. Their queries are assembled by string concatenation, so the
 * column sets could not be read out of the source. These are stubs that let
 * the server start; the systems behind them will fail on first use.
 */
const STUBS = {
  boss_ranking: ['`player` varchar(255) NOT NULL', '`points` int(11) NOT NULL DEFAULT 0'],
  daily_points: [
    '`player_id` int(11) NOT NULL',
    '`point_type` varchar(64) NOT NULL',
    '`points` int(11) NOT NULL DEFAULT 0',
  ],
  player_misc: ['`player_id` int(11) NOT NULL'],
  pix_payment: [
    '`id` int(11) NOT NULL AUTO_INCREMENT',
    // The donation reports order by `loc_id`, so it exists and is not `id`.
    '`loc_id` int(11) NOT NULL DEFAULT 0',
    '`player_id` int(11) NOT NULL DEFAULT 0',
    '`txid` varchar(255) NOT NULL',
    // getDataString then tonumber: read as text, spent as a number.
    "`price` varchar(32) NOT NULL DEFAULT '0'",
    // Not a datetime. It is compared against '2024-04-09T00:00:00Z' — the
    // payment API's ISO-8601 string stored verbatim, which a real DATETIME
    // column would never match.
    "`creation` varchar(32) NOT NULL DEFAULT ''",
    '`paid` tinyint(1) NOT NULL DEFAULT 0',
    // Polled on a loop and compared to the literal 'CONCLUIDA'.
    "`status` varchar(32) NOT NULL DEFAULT ''",
    'PRIMARY KEY (`id`)',
    'KEY `loc_id` (`loc_id`)',
  ],
  spectate_bans: [
    '`id` int(11) NOT NULL AUTO_INCREMENT',
    '`host_account_id` int(11) NOT NULL',
    '`banned_account_id` int(11) NOT NULL',
    '`banned_name` varchar(255) NOT NULL',
    'PRIMARY KEY (`id`)',
  ],
  player_ditto_memory_slots: [
    '`player_id` int(11) NOT NULL',
    '`slot_id` int(11) NOT NULL',
    '`pokemon_name` varchar(255) NOT NULL',
    '`level` int(11) NOT NULL DEFAULT 1',
    '`portrait` int(11) NOT NULL DEFAULT 0',
  ],
  shop_historico: ['`id` int(11) NOT NULL AUTO_INCREMENT', '`entregue` tinyint(1) NOT NULL DEFAULT 0', 'PRIMARY KEY (`id`)'],
  // `SELECT * FROM shop_history WHERE account = ... ORDER BY id DESC` in the
  // production query log: the key is `account`, not `account_id`.
  shop_history: [
    '`id` int(11) NOT NULL AUTO_INCREMENT',
    '`account` int(11) NOT NULL DEFAULT 0',
    'PRIMARY KEY (`id`)',
    'KEY `account` (`account`)',
  ],
  historico_pagamentos: [
    '`id` int(11) NOT NULL AUTO_INCREMENT',
    '`player_id` int(11) NOT NULL DEFAULT 0',
    // getDataInt, summed into the donation total.
    '`valor` int(11) NOT NULL DEFAULT 0',
    // Compared against '2024-04-09 00:00:00', so this one really is a datetime
    // shape — unlike pix_payment.creation, which carries the ISO-8601 form.
    '`date_created` datetime DEFAULT NULL',
    // Compared to the literal '4', quoted, so the column is text-ish.
    "`status` varchar(16) NOT NULL DEFAULT ''",
    "`entregue` varchar(4) NOT NULL DEFAULT '0'",
    'PRIMARY KEY (`id`)',
  ],
};

say('-- Stubs: no INSERT anchors these, so the column sets are partial.');
for (const [table, columns] of Object.entries(STUBS)) {
  say(`DROP TABLE IF EXISTS \`${table}\`;`);
  say(`CREATE TABLE \`${table}\` (\n${columns.map((c) => `  ${c}`).join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
  say('');
}

say('SET FOREIGN_KEY_CHECKS = 1;');
say('');
say("INSERT INTO `server_config` (`config`, `value`) VALUES ('db_version', '1')");
say('  ON DUPLICATE KEY UPDATE `value` = `value`;');

process.stdout.write(out.join('\n') + '\n');
