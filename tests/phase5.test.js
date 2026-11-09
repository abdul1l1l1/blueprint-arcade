// Whole-requirements API journey; its own disposable PostgreSQL schema.
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { seedDatabase, inspectSeed } = require('../db/seed');
const { addConstructionSite } = require('../db/add-construction-site');
const { COVER_PATH } = require('../routes/approved-assets');
const { createApp } = require('../server');
const schema = `qa_p5_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
let database, server, base;
before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  assert.match(schema, /^qa_p5_[a-f0-9]{32}$/);
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, password);
  server = createApp({ database, env: { SESSION_SECRET: randomBytes(32).toString('hex') } }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});
async function request(route, method = 'GET', body, cookie) {
  const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

test('P5 approved eleventh build import uses real DB, preserves seed, remains editable and idempotent', async () => {
  const original = (await database.query('SELECT * FROM builds ORDER BY id')).rows;
  assert.equal((await addConstructionSite(database)).status, 'added');
  assert.equal((await addConstructionSite(database)).status, 'unchanged');
  const all = (await database.query('SELECT * FROM builds ORDER BY id')).rows;
  assert.equal(all.length, 11);
  assert.deepEqual(all.filter(b => b.title !== 'Construction Site'), original);
  assert.deepEqual((await inspectSeed(database)).missing, []);
  const login = await request('/api/auth/login', 'POST', { username: 'abdul_builds', password });
  assert.equal(login.status, 200);
  const build = (await request('/api/builds?q=Construction%20Site')).data.builds[0];
  assert.deepEqual(build.image_urls, [COVER_PATH]);
  const edited = await request(`/api/builds/${build.id}`, 'PUT', { ...build, tags: [] }, login.cookie);
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.data.build.image_urls, [COVER_PATH]);
});

test('P5 full integration: auth → CRUD → search/filter/sort → social/favorites → ranking/compare → delete/logout', async () => {
  const actor = await request('/api/auth/register', 'POST', { username: 'Phase5Actor', email: 'phase5actor@example.test', password, displayName: 'QA builder' });
  assert.equal(actor.status, 201);
  const cookie = actor.cookie;
  const games = (await request('/api/games')).data.games;
  assert.equal(games.length, 8);
  const game = games.find(g => g.slug === 'bloxburg');
  const detail = await request('/api/games/bloxburg');
  assert.ok(detail.data.tags.includes('Modern Villa'));
  const data = { title: 'Phase Five Journey', game_id: game.id, description: 'Persistent requirement coverage',
    image_urls: ['https://example.test/front.png', COVER_PATH], budget_tier: 'mid', build_type: 'freeform', tags: ['Modern Villa'], is_pinned: true };
  const created = await request('/api/builds', 'POST', data, cookie);
  assert.equal(created.status, 201);
  const id = created.data.build.id;
  const found = await request('/api/builds?q=Phase%20Five&game=bloxburg&build_type=freeform&budget_tier=mid&tag=Modern%20Villa&sort=newest');
  assert.deepEqual(found.data.builds.map(b => b.id), [id]);
  assert.equal((await request(`/api/builds/${id}`)).data.build.title, data.title);
  for (const sort of ['rating', 'likes']) assert.equal((await request('/api/builds?sort=' + sort)).status, 200);
  const action = (name, body) => request(`/api/social/builds/${id}/${name}`, 'POST', body, cookie);
  assert.equal((await action('like')).data.liked, true);
  assert.equal((await action('rating', { stars: 5 })).status, 200);
  assert.equal((await action('rating', { stars: 4 })).status, 200);
  assert.equal((await action('comments', { body: '<script>literal comment</script>' })).status, 201);
  assert.equal((await action('favorite')).data.favorited, true);
  assert.ok((await request('/api/social/favorites', 'GET', undefined, cookie)).data.favorites.some(b => b.id === id));
  const state = (await request(`/api/social/builds/${id}/state`, 'GET', undefined, cookie)).data;
  assert.equal(state.like_count, 1);
  assert.equal(state.rating, 4);
  assert.equal(Number((await database.query('SELECT count(*) FROM ratings WHERE build_id=$1', [id])).rows[0].count), 1);
  const top = (await request('/api/stats/top10')).data.top;
  assert.ok(top.length <= 10);
  assert.equal(Number(top.find(b => b.id === id).score), 4);
  const compare = await request('/api/games/compare/ids?ids=' + games.slice(0, 3).map(g => g.id).join(','));
  assert.equal(compare.status, 200);
  assert.equal(compare.data.games.length, 3);
  assert.equal((await request(`/api/builds/${id}`, 'PUT', { ...data, title: 'Edited journey' }, cookie)).status, 200);
  assert.equal((await request('/api/stats/profile/Phase5Actor')).data.builds[0].title, 'Edited journey');
  assert.equal((await request(`/api/builds/${id}`, 'DELETE', undefined, cookie)).status, 200);
  assert.equal((await request('/api/social/favorites', 'GET', undefined, cookie)).data.favorites.length, 0);
  assert.equal((await request('/api/auth/logout', 'POST', undefined, cookie)).status, 200);
  assert.equal((await request('/api/auth/me', 'GET', undefined, cookie)).data.user, null);
  assert.equal((await request('/api/builds', 'POST', data, cookie)).status, 401);
});
