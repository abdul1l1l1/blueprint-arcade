// Actual HTTP + PostgreSQL acceptance, in an isolated retained QA schema.
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
const schema = `qa_p4_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
let database, server, base, actor, other, id, games;
async function start(db = database) {
  const listener = createApp({ database: db, env: { SESSION_SECRET: secret } }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}
async function close(listener) {
  listener.closeIdleConnections();
  await new Promise(resolve => listener.close(resolve));
}
async function request(path, { method = 'GET', body, cookie } = {}, origin = base) {
  const response = await fetch(origin + path, { method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0], cache: response.headers.get('cache-control') };
}
const social = (action, body, cookie = actor.cookie) => request(`/api/social/builds/${id}/${action}`, { method: 'POST', body, cookie });
const state = cookie => request(`/api/social/builds/${id}/state`, { cookie });
before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'QA only');
  assert.ok(process.env.DATABASE_URL);
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, password);
  ({ server, base } = await start());
  for (const name of ['P4Actor', 'P4Other']) {
    const result = await request('/api/auth/register', { method: 'POST',
      body: { username: name, email: `${name}@example.test`, password, displayName: name } });
    assert.equal(result.status, 201);
    if (!actor) actor = result; else other = result;
  }
  games = (await request('/api/games')).data.games;
  const created = await request('/api/builds', { method: 'POST', cookie: actor.cookie, body: {
    title: 'Phase 4 social fixture', game_id: games[0].id, description: 'Social fixture',
    image_urls: ['https://example.test/one.png', 'https://example.test/two.png'],
    budget_tier: 'mid', build_type: 'freeform', tags: [] } });
  assert.equal(created.status, 201);
  id = created.data.build.id;
});
after(async () => {
  if (server?.listening) await close(server);
  await database?.end();
  await pool.end();
});

test('P4.1 visitors read state/comments, but all mutations and favorites require login', async () => {
  const initial = await state();
  assert.equal(initial.status, 200);
  assert.equal(initial.cache, 'no-store');
  assert.equal(initial.data.liked, false);
  assert.equal(initial.data.favorited, false);
  assert.equal(initial.data.rating, null);
  assert.equal((await request(`/api/social/builds/${id}/comments`)).status, 200);
  for (const action of ['like', 'favorite', 'rating', 'comments']) {
    assert.equal((await request(`/api/social/builds/${id}/${action}`, { method: 'POST', body: {} })).status, 401);
  }
  assert.equal((await request('/api/social/favorites')).status, 401);
});
test('P4.2 likes toggle per session, no user spoofing, independent users and concurrent toggles', async () => {
  assert.equal((await social('like', { user_id: other.data.user.id })).data.liked, true);
  assert.equal((await state()).data.like_count, 1);
  assert.equal((await state(other.cookie)).data.liked, false);
  assert.equal((await social('like')).data.liked, false);
  const results = await Promise.all(Array.from({ length: 6 }, () => social('like')));
  assert.ok(results.every(result => result.status === 200));
  assert.equal((await state(actor.cookie)).data.liked, false);
  await social('like');
  await social('like', undefined, other.cookie);
  assert.equal((await state()).data.like_count, 2);
});
test('P4.3 ratings enforce integers 1-5 and upsert one row per user', async () => {
  for (const stars of [0, 6, 1.5, '5', null, true, {}, []]) {
    assert.equal((await social('rating', { stars })).status, 400);
  }
  assert.equal((await social('rating', { stars: 1 })).data.rating, 1);
  const updated = await social('rating', { stars: 5 });
  assert.equal(updated.data.rating_count, 1);
  assert.equal(updated.data.avg_rating, 5);
  await social('rating', { stars: 3 }, other.cookie);
  assert.equal((await state()).data.avg_rating, 4);
  await Promise.all([2, 4, 5].map(stars => social('rating', { stars })));
  assert.equal((await state()).data.rating_count, 2);
});
test('P4.4 comments validate and return trimmed literal text with safe public authorship', async () => {
  for (const body of ['', '   ', 10, null, 'x'.repeat(2001), 'bad\0text']) {
    assert.equal((await social('comments', { body })).status, 400);
  }
  const result = await social('comments', { body: '  <script>alert("text")</script>  ', user_id: other.data.user.id });
  assert.equal(result.status, 201);
  assert.equal(result.data.comment.body, '<script>alert("text")</script>');
  assert.equal(result.data.comment.username, 'P4Actor');
  await social('comments', { body: 'Second comment' }, other.cookie);
  const list = await request(`/api/social/builds/${id}/comments`);
  assert.equal(list.data.comments.length, 2);
  assert.equal(list.data.comments[0].body, 'Second comment');
  assert.equal((await state()).data.comment_count, 2);
  assert.doesNotMatch(JSON.stringify(list.data), /password_hash|"email"|"sess"/);
});
test('P4.5 favorites toggle, stay private, return full build cards, and serialize duplicates', async () => {
  assert.equal((await social('favorite')).data.favorited, true);
  const list = await request('/api/social/favorites', { cookie: actor.cookie });
  assert.equal(list.data.favorites.length, 1);
  assert.equal(list.data.favorites[0].id, id);
  assert.equal(list.data.favorites[0].image_urls.length, 2);
  assert.ok(Array.isArray(list.data.favorites[0].tags));
  assert.equal((await request('/api/social/favorites', { cookie: other.cookie })).data.favorites.length, 0);
  await Promise.all(Array.from({ length: 4 }, () => social('favorite')));
  assert.equal((await state(actor.cookie)).data.favorited, true);
  await social('favorite');
  assert.equal((await request('/api/social/favorites', { cookie: actor.cookie })).data.favorites.length, 0);
  await social('favorite');
});
test('P4.6 malformed and nonexistent build IDs fail explicitly on every social endpoint', async () => {
  for (const missing of ['bad-id', randomUUID()]) {
    for (const action of ['like', 'favorite', 'rating', 'comments', 'state']) {
      const read = ['comments', 'state'].includes(action);
      const result = await request(`/api/social/builds/${missing}/${action}`, {
        method: read ? 'GET' : 'POST', cookie: actor.cookie, body: read ? undefined : { stars: 4 } });
      assert.equal(result.status, missing === 'bad-id' ? 400 : 404);
    }
  }
});
test('P4.7 Top 10 uses exact average times likes, limits ten, and resolves ties deterministically', async () => {
  const expected = await database.query(
    `SELECT b.id,(bs.avg_rating*bs.like_count)::float8 AS score FROM builds b
     JOIN build_stats bs ON bs.build_id=b.id ORDER BY bs.avg_rating*bs.like_count DESC,
     bs.avg_rating DESC,bs.like_count DESC,b.id LIMIT 10`);
  const result = await request('/api/stats/top10');
  assert.equal(result.status, 200);
  assert.equal(result.data.top.length, 10);
  assert.deepEqual(result.data.top.map(({ id, score }) => ({ id, score })), expected.rows);
  for (const row of result.data.top) {
    assert.ok(Math.abs(row.score - row.avg_rating * row.like_count) < 1e-10);
    assert.ok(Array.isArray(row.image_urls));
  }
});
test('P4.8 comparison returns 2/3 games in chosen order with aligned data and vocabularies', async () => {
  for (const picked of [[games[2], games[0]], [games[3], games[1], games[0]]]) {
    const result = await request(`/api/games/compare/ids?ids=${picked.map(game => game.id).join(',')}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.games.map(game => game.id), picked.map(game => game.id));
    for (const game of result.data.games) {
      const detail = (await request(`/api/games/${game.slug}`)).data;
      assert.equal(game.build_count, detail.game.build_count);
      assert.equal(game.avg_rating, detail.game.avg_rating);
      assert.deepEqual(game.tags, detail.tags);
    }
  }
});
test('P4.9 comparison rejects missing, duplicate, malformed, repeated, excessive and nonexistent selections', async () => {
  for (const query of ['', 'ids=1', 'ids=1,1', 'ids=1,2,3,4', 'ids=0,1', 'ids=1,x', 'ids=1,2&ids=3,4',
    'ids=1.5,2', 'ids=2147483648,1', 'ids=1%3BDROP%20TABLE%20games,2']) {
    assert.equal((await request(`/api/games/compare/ids?${query}`)).status, 400);
  }
  assert.equal((await request('/api/games/compare/ids?ids=2147483647,2147483646')).status, 404);
});
test('P4.10 social data and sessions persist across an app restart', async () => {
  const previous = await state(actor.cookie);
  await close(server);
  ({ server, base } = await start());
  assert.deepEqual((await state(actor.cookie)).data, previous.data);
  assert.equal((await request('/api/social/favorites', { cookie: actor.cookie })).data.favorites[0].id, id);
  assert.equal((await request(`/api/social/builds/${id}/comments`)).data.comments.length, 2);
});
test('P4.11 database failures produce safe JSON on social, ranking and comparison', async () => {
  const broken = await start({ query: async () => { throw new Error('sensitive SQL failure'); } });
  try {
    for (const path of [`/api/social/builds/${id}/state`, '/api/stats/top10', '/api/games/compare/ids?ids=1,2']) {
      const result = await request(path, {}, broken.base);
      assert.equal(result.status, 500);
      assert.doesNotMatch(JSON.stringify(result.data), /sensitive|SELECT|password/);
    }
  } finally { await close(broken.server); }
});
test('P4.12 owner deletion cascades reactions, ratings, comments and favorites', async () => {
  assert.equal((await request(`/api/builds/${id}`, { method: 'DELETE', cookie: actor.cookie })).status, 200);
  for (const table of ['likes', 'ratings', 'comments', 'favorites']) {
    assert.equal((await database.query(`SELECT count(*)::int AS n FROM ${table} WHERE build_id=$1`, [id])).rows[0].n, 0);
  }
  assert.equal((await request('/api/social/favorites', { cookie: actor.cookie })).data.favorites.length, 0);
});
