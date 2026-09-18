#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, resolve, normalize } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

/**
 * Static server for the web client.
 *
 * The one interesting thing it does is strip types from `.ts` on the way out,
 * so the browser imports the very same `layout.ts` the headless rasteriser
 * uses. No bundler, no build step, and no second copy of the layout rules
 * that could drift from the first.
 */

const ROOT = resolve(import.meta.dirname, '../..');
const PORT = Number(process.env.PORT ?? 5173);
const RELEASE = process.env.RELEASE ?? 'out/release-hub';

/**
 * The base client's own artwork, served as-is.
 *
 * `gamelib/util.lua` resolves every Pokémon image by lowercased name against
 * these folders — `getPokemonImage` and `getPokemonPortrait` — rather than by
 * looktype, and this client does the same. That is not a shortcut: the sprite
 * pack only holds real Pokémon in parts of its creature range, so a name is
 * the only identifier that resolves correctly for all of them.
 */
const ART = resolve(ROOT, '../cliente/data/images/game');

/**
 * The client keeps a handful of interface icons one level up from the game
 * art — the diamond the cash shop charges in is `customIcons/diamond16.png`.
 * They are served under the same `/art/` prefix so the pages have one rule for
 * where a picture comes from.
 */
const ART_EXTRA = resolve(ROOT, '../cliente/data/images');
const EXTRA_PREFIXES = ['/customIcons/'];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === '/') pathname = '/packages/client/index.html';
    // The client asks for /release/... whichever release is being served.
    if (pathname.startsWith('/release/')) {
      pathname = `/${RELEASE}/${pathname.slice('/release/'.length)}`;
    }

    // Everything resolves under one of two roots, and never above either.
    const artRequest = pathname.startsWith('/art/');
    const rest = artRequest ? pathname.slice('/art'.length) : pathname;
    const base = artRequest
      ? EXTRA_PREFIXES.some((prefix) => rest.startsWith(prefix))
        ? ART_EXTRA
        : ART
      : ROOT;

    const target = join(base, normalize(rest).replace(/^(\.\.[/\\])+/, ''));
    if (!target.startsWith(base)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end(`not found: ${pathname}`);
      return;
    }

    const ext = extname(target).toLowerCase();

    if (ext === '.ts') {
      const source = await readFile(target, 'utf8');
      const js = stripTypeScriptTypes(source, { mode: 'strip' });
      res.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'no-cache',
      });
      res.end(js);
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': ext === '.png' ? 'public, max-age=3600' : 'no-cache',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end(`error: ${(err as Error).message}`);
  }
});

server.listen(PORT, () => {
  console.log(`pokeidle client on http://localhost:${PORT}`);
  console.log(`serving release ${RELEASE}`);
});
