// Phase 2 HTTP + PostgreSQL acceptance tests. Only a new retained QA fixture
// schema is written; public QA data and all production data remain untouched.
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { createApp } = require('../server');
const content = require('../db/content');

const schema = `qa_p2_${randomUUID().replaceAll('-', '')}`;
const secret = randomBytes(32).toString('hex');
let database;
let server;
let base;

async function serve(db = database) {
  const listener = createApp({ database: db, env: { SESSION_SECRET: secret } }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}
async function close(listener) {
  listener.closeIdleConnections();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}
async function get(path, origin = base) {
  const response = await fetch(origin + path);
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, text, headers: response.headers };
}
const namesAscending = (a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en');
function expectedRating(game) {
  const builds = content.builds.filter(build => build.game === game.slug);
  if (!builds.length) return 0;
  const sum = builds.reduce((total, build) => {
    const stars = content.sampleRatings.filter(rating => rating.build === build.title).map(rating => rating.stars);
    return total + (stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0);
  }, 0);
  return sum / builds.length;
}
function assertRating(actual, expected) {
  assert.equal(typeof actual, 'number');
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should equal ${expected}`);
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'QA tests must not run in production.');
  assert.ok(process.env.DATABASE_URL, 'QA PostgreSQL is required.');
  assert.match(schema, /^qa_p2_[a-z0-9]+$/);
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, randomBytes(24).toString('base64url'));
  ({ server, base } = await serve());
});
after(async () => {
  if (server?.listening) await close(server);
  if (database) await database.end();
  await pool.end();
});

test('P2.1 directory publicly returns all eight seeded games with exact build counts and existing aggregate ratings', async () => {
  const result = await get('/api/games');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('set-cookie'), null);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.data.games.length, 8);
  assert.deepEqual(result.data.games.map(game => game.slug), [...content.games].sort(namesAscending).map(game => game.slug));
  let count = 0;
  for (const game of result.data.games) {
    const expected = content.games.find(row => row.slug === game.slug);
    assert.equal(game.name, expected.name);
    assert.equal(game.description, expected.description);
    assert.equal(game.is_sandbox, expected.is_sandbox);
    assert.equal(typeof game.build_count, 'number');
    assert.equal(game.build_count, content.builds.filter(build => build.game === game.slug).length);
    assertRating(game.avg_rating, expectedRating(game));
    count += game.build_count;
  }
  assert.equal(count, 10);
});

test('P2.2 search is trimmed, case-insensitive, searches names/genres/descriptions, and has honest empty results', async () => {
  for (const [query, expected] of [
    ['  MINECRAFT  ', ['minecraft']],
    ['wallpaper', ['the-sims-4']],
    ['City builder', ['cities-skylines-ii', 'manor-lords']],
    ['no-such-game-qa', []], ['%', []], ['_', []], ['\\', []], ["' OR 1=1 --", []],
  ]) {
    const result = await get(`/api/games?q=${encodeURIComponent(query)}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.games.map(game => game.slug), expected);
  }
  assert.equal((await get('/api/games?q=%20%20')).data.games.length, 8);
});

test('P2.3 sandbox true/false filters use the seeded boolean, not a guess from genre', async () => {
  for (const sandbox of [true, false]) {
    const result = await get(`/api/games?sandbox=${sandbox}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.games.map(game => game.slug),
      content.games.filter(game => game.is_sandbox === sandbox).sort(namesAscending).map(game => game.slug));
    assert.equal(result.data.games.every(game => game.is_sandbox === sandbox), true);
  }
  assert.equal((await get('/api/games?sandbox=false&q=hometopia')).data.games.length, 1);
});

test('P2.4 all four sorts return the right complete order with deterministic name ties', async () => {
  const comparators = {
    name: namesAscending,
    builds: (a, b) => b.build_count - a.build_count || namesAscending(a, b),
    rating: (a, b) => b.avg_rating - a.avg_rating || namesAscending(a, b),
    newest: (a, b) => b.release_year - a.release_year || namesAscending(a, b),
  };
  const all = (await get('/api/games')).data.games;
  for (const [sort, comparator] of Object.entries(comparators)) {
    const result = await get(`/api/games?sort=${sort}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.games.map(game => game.slug), [...all].sort(comparator).map(game => game.slug));
  }
});

test('P2.5 search, sandbox and sorting compose without losing selected constraints', async () => {
  const sandbox = await get('/api/games?q=cozy&sandbox=true&sort=rating');
  assert.equal(sandbox.status, 200);
  assert.deepEqual(sandbox.data.games.map(game => game.slug), ['tiny-glade']);
  const cities = await get('/api/games?q=city&sandbox=false&sort=newest');
  assert.equal(cities.status, 200);
  assert.deepEqual(cities.data.games.map(game => game.slug), ['manor-lords', 'cities-skylines-ii']);
  assert.equal((await get('/api/games?q=minecraft&sandbox=false&sort=builds')).data.games.length, 0);
});

test('P2.6 invalid/repeated query values and sort injection are rejected with safe field errors', async () => {
  for (const [query, field] of [
    [`q=${'x'.repeat(121)}`, 'q'], ['q=%00', 'q'], ['q=a&q=b', 'q'],
    ['sandbox=yes', 'sandbox'], ['sandbox=true&sandbox=false', 'sandbox'],
    ['sort=unknown', 'sort'], ['sort=name&sort=rating', 'sort'],
    ['sort=constructor', 'sort'], ['sort=__proto__', 'sort'], ['sort=toString', 'sort'],
    ['sort=rating%3BDROP%20TABLE%20games', 'sort'],
  ]) {
    const result = await get(`/api/games?${query}`);
    assert.equal(result.status, 400);
    assert.ok(result.data.errors[field]);
    assert.doesNotMatch(result.text, /SELECT|password_hash|connectionString|postgres:\/\//);
  }
  assert.equal((await get('/api/games')).data.games.length, 8);
});

test('P2.7 every seeded slug returns the exact game, vocabulary, and only its credited builds', async () => {
  for (const expected of content.games) {
    const result = await get(`/api/games/${expected.slug}`);
    assert.equal(result.status, 200);
    const { game, tags, builds } = result.data;
    assert.equal(game.slug, expected.slug);
    assert.equal(game.description, expected.description);
    assert.deepEqual(tags, [...expected.tags].sort());
    assertRating(game.avg_rating, expectedRating(game));
    const expectedBuilds = content.builds.filter(build => build.game === expected.slug);
    assert.equal(game.build_count, expectedBuilds.length);
    assert.deepEqual(builds.map(build => build.title).sort(), expectedBuilds.map(build => build.title).sort());
    for (const build of builds) {
      const original = expectedBuilds.find(row => row.title === build.title);
      assert.equal(build.game_id, game.id);
      assert.equal(build.owner, original.owner);
      assert.equal(build.display_name, content.users.find(user => user.username === original.owner).display_name);
      assert.equal(build.description, original.description);
      assert.equal(build.build_type, original.build_type);
      assert.equal(build.budget_tier, original.budget_tier);
      assert.deepEqual(build.tags, [...original.tags].sort());
      assert.deepEqual(build.image_urls, []);
    }
    assert.doesNotMatch(result.text, /password_hash|"email"|"session"|"role"/);
    assert.equal(result.headers.get('set-cookie'), null);
  }
});

test('P2.8 games with zero builds still have their description and tag vocabulary', async () => {
  for (const slug of ['minecraft', 'hometopia', 'manor-lords']) {
    const { data } = await get(`/api/games/${slug}`);
    assert.equal(data.game.build_count, 0);
    assert.equal(data.game.avg_rating, 0);
    assert.ok(data.game.description);
    assert.ok(data.tags.length);
    assert.deepEqual(data.builds, []);
  }
});

test('P2.9 unknown/malformed slugs fail clearly and return no cross-game data', async () => {
  assert.equal((await get('/api/games/no-such-game-qa')).status, 404);
  for (const slug of ['%27%20OR%201%3D1', 'BAD_SLUG', 'a'.repeat(101)]) {
    const result = await get(`/api/games/${slug}`);
    assert.equal(result.status, 400);
    assert.ok(result.data.errors.slug);
    assert.equal(result.data.builds, undefined);
  }
});

test('P2.10 server failures are safe JSON errors, and comparison is publicly available', async () => {
  const failing = { query: async () => { throw new Error('Private database fixture detail'); } };
  const instance = await serve(failing);
  try {
    for (const path of ['/api/games', '/api/games/bloxburg']) {
      const result = await get(path, instance.base);
      assert.equal(result.status, 500);
      assert.ok(result.data.errors._general);
      assert.doesNotMatch(result.text, /Private|password|SELECT|stack/);
    }
  } finally { await close(instance.server); }
  assert.equal((await get('/api/games/compare/ids?ids=1,2')).status, 200);
});

test('P2.11 game descriptions, vocabulary, builds, and stats persist across app restart', async () => {
  const directory = (await get('/api/games')).data;
  const detail = (await get('/api/games/bloxburg')).data;
  await close(server);
  ({ server, base } = await serve());
  assert.deepEqual((await get('/api/games')).data, directory);
  assert.deepEqual((await get('/api/games/bloxburg')).data, detail);
});

test('P2.12 both page shells and their actual controller/styles are served by the same Express app', async () => {
  for (const path of ['/games.html', '/game.html?slug=bloxburg']) {
    const result = await get(path);
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-type'), /text\/html/);
    assert.match(result.text, /\/js\/games.js/);
    assert.match(result.text, /\/js\/app.js/);
    assert.match(result.text, /\/css\/games.css/);
    assert.match(result.text, /name="description"/);
  }
  for (const path of ['/js/games.js', '/css/games.css']) assert.equal((await get(path)).status, 200);
});

test('P2.13 a fixture game with no vocabulary/builds and unknown release year remains browsable and sorts last by release', async () => {
  const slug = 'qa-empty-vocabulary';
  await database.query(
    'INSERT INTO games (slug, name, genre, description) VALUES ($1, $2, $3, $4)',
    [slug, 'QA Empty Game', 'Fixture', 'Empty-vocabulary QA fixture, not public content.']);
  const result = await get(`/api/games/${slug}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.tags, []);
  assert.deepEqual(result.data.builds, []);
  assert.equal(result.data.game.build_count, 0);
  assert.equal(result.data.game.avg_rating, 0);
  assert.equal((await get('/api/games?sort=newest')).data.games.at(-1).slug, slug);
});
