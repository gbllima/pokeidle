import test from 'node:test';
import assert from 'node:assert/strict';

import {
  nameCandidates,
  portraitUrl,
  artworkUrl,
  typeIconUrl,
  knownArt,
  exists,
} from '../src/art.ts';

test('a plain species is only ever itself', () => {
  assert.deepEqual(nameCandidates('Bellsprout'), ['bellsprout']);
});

test('a variant falls back to the species it is a variant of', () => {
  // These have no art of their own in the base, but `dugtrio` does.
  assert.deepEqual(nameCandidates('Alolan Dugtrio'), ['alolan dugtrio', 'dugtrio']);
  assert.deepEqual(nameCandidates('Ancient Alakazam'), ['ancient alakazam', 'alakazam']);
  assert.deepEqual(nameCandidates('Big Onix'), ['big onix', 'onix']);
  assert.deepEqual(nameCandidates('Shiny Pikachu'), ['shiny pikachu', 'pikachu']);
});

test('a mega drops its X or Y, since the two share one picture', () => {
  assert.deepEqual(nameCandidates('Mega Charizard X'), [
    'mega charizard x',
    'mega charizard',
    'charizard x',
    'charizard',
  ]);
});

test('a two-word variant peels one word at a time', () => {
  assert.deepEqual(nameCandidates('Banshee Shiny Misdreavus'), [
    'banshee shiny misdreavus',
    'shiny misdreavus',
    'misdreavus',
  ]);
});

test('candidates are ordered most specific first and never repeat', () => {
  const list = nameCandidates('Shiny Shiny Pikachu');
  assert.equal(list[0], 'shiny shiny pikachu');
  assert.equal(list.at(-1), 'pikachu');
  assert.equal(new Set(list).size, list.length);
});

test('an empty name asks for nothing rather than for a broken url', () => {
  assert.deepEqual(nameCandidates('   '), []);
});

test('names with spaces are escaped for the url', () => {
  // `alolan muk.png` is a real file; an unescaped space is not a valid URL.
  assert.equal(portraitUrl('Alolan Muk'), '/art/portrait/alolan%20muk.png');
  assert.equal(artworkUrl('Alolan Muk'), '/art/pokedex/pokemon/alolan%20muk.png');
});

test('type icons are capitalised the way the folder is', () => {
  // The type folder is the one place the base capitalises: `Grass.png`.
  assert.equal(typeIconUrl('grass'), '/art/pokedex/types/Grass.png');
  assert.equal(typeIconUrl('POISON'), '/art/pokedex/types/Poison.png');
});

// ── knowing what exists ──────────────────────────────────────────────────────

test('with a manifest, only files the release ships are asked for', () => {
  // Told what exists, the chain skips straight past the misses instead of
  // discovering each one through a 404.
  knownArt(['dugtrio'], ['articuno']);

  assert.equal(exists('portrait', 'dugtrio'), true);
  assert.equal(exists('portrait', 'alolan dugtrio'), false);
  assert.equal(exists('artwork', 'articuno'), true);
  assert.equal(exists('portrait', 'articuno'), false, 'art but no portrait, like the base');
});

test('names are matched case- and space-insensitively against the manifest', () => {
  knownArt(['alolan muk'], []);
  assert.equal(exists('portrait', '  Alolan Muk '), true);
});

test('with no manifest nothing is ruled out', () => {
  // Before the release loads, guessing is better than showing nothing.
  knownArt([], []);
  assert.equal(exists('portrait', 'anything'), true);
});
