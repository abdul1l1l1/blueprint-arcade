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

const schema = `qa_p5c_repost_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
let database, server, base, owner, reposter, another, gameId, original, second;

async function start() {
  const listener = createApp({ database, env: { SESSION_SECRET: secret } }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}

async function close(listener) {
  listener.closeIdleConnections();
  await new Promise(resolve => listener.close(resolve));
}

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data;
  const text = await response.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

async function register(username) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email: `${username}@example.test`, password, displayName: username },
  });
  assert.equal(result.status, 201);
  return result;
}

const repost = (buildId, actor = reposter) => request(`/api/social/builds/${buildId}/repost`, {
  method: 'POST', cookie: actor.cookie,
});

async function createBuild(title) {
  const result = await request('/api/builds', {
    method: 'POST',
    cookie: owner.cookie,
    body: {
      title,
      game_id: gameId,
      description: `${title} description`,
      image_urls: ['https://example.test/front.png', 'https://example.test/back.png'],
      budget_tier: 'mid',
      build_type: 'freeform',
      tags: [],
    },
  });
  assert.equal(result.status, 201);
  return result.data.build;
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'QA only');
  assert.ok(process.env.DATABASE_URL);
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, password);
  ({ server, base } = await start());
  owner = await register('P5CDetailOwner');
  reposter = await register('P5CDetailReposter');
  another = await register('P5CDetailAnother');
  gameId = (await request('/api/games')).data.games[0].id;
  original = await createBuild('Original detail build');
  second = await createBuild('Second original build');
});

after(async () => {
  if (server) await close(server);
  if (database) await database.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
});

test('5C detail endpoint and page expose complete public build details', async () => {
  const response = await request(`/api/builds/${original.id}`);
  assert.equal(response.status, 200);
  assert.equal(response.data.build.title, 'Original detail build');
  assert.equal(response.data.build.owner, 'P5CDetailOwner');
  assert.equal(response.data.build.game_id, gameId);
  assert.equal(response.data.build.description, 'Original detail build description');
  assert.deepEqual(response.data.build.image_urls, ['https://example.test/front.png', 'https://example.test/back.png']);
  assert.equal(response.data.build.budget_tier, 'mid');
  assert.deepEqual(response.data.build.tags, []);
  const page = await request(`/build.html?id=${original.id}`);
  assert.equal(page.status, 200);
  assert.match(page.data, /data-build-detail/);
  assert.match(page.data, /data-social-actions/);
  assert.match(page.data, /data-social-comments/);
});

test('5C social writes and repost are rejected while signed out', async () => {
  for (const [action, body] of [
    ['like', undefined],
    ['favorite', undefined],
    ['rating', { stars: 5 }],
    ['comments', { body: 'Visitor comment' }],
    ['repost', undefined],
  ]) {
    const response = await request(`/api/social/builds/${original.id}/${action}`, { method: 'POST', body });
    assert.equal(response.status, 401, action);
  }
});

test('5C repost toggle is unique, excludes self-reposts, and is concurrency safe', async () => {
  assert.equal((await repost(original.id, owner)).status, 403);

  const first = await repost(original.id);
  assert.equal(first.status, 200);
  assert.equal(first.data.reposted, true);
  assert.equal(first.data.repost_count, 1);
  assert.equal(first.data.can_repost, true);

  const duplicateToggle = await repost(original.id);
  assert.equal(duplicateToggle.status, 200);
  assert.equal(duplicateToggle.data.reposted, false);
  assert.equal(duplicateToggle.data.repost_count, 0);

  const concurrent = await Promise.all([repost(original.id), repost(original.id)]);
  assert.deepEqual(concurrent.map(result => result.status), [200, 200]);
  const actorId = reposter.data?.user?.id || reposter.user?.id;
  const { rows } = await database.query('SELECT count(*)::int AS count FROM reposts WHERE user_id=$1 AND build_id=$2',
    [actorId, original.id]);
  assert.equal(rows[0].count, 0);
  assert.equal((await repost(original.id)).data.reposted, true);
  await assert.rejects(
    database.query('INSERT INTO reposts(user_id,build_id) VALUES($1,$2)', [actorId, original.id]),
    error => error.code === '23505',
  );
  assert.equal((await repost(original.id)).data.reposted, false);
});

test('5C repost feed and profile reference the original build in repost order', async () => {
  const actorId = reposter.data?.user?.id || reposter.user?.id;
  await request(`/api/social/builds/${original.id}/repost`, { method: 'POST', cookie: reposter.cookie });
  await request(`/api/social/builds/${second.id}/repost`, { method: 'POST', cookie: reposter.cookie });
  await request(`/api/social/builds/${original.id}/repost`, { method: 'POST', cookie: another.cookie });
  await database.query(
    `UPDATE reposts SET created_at=CASE
      WHEN build_id=$1 THEN now()-interval '2 hours'
      WHEN build_id=$2 THEN now()-interval '1 hour'
      ELSE created_at END WHERE user_id=$3`,
    [original.id, second.id, actorId],
  );

  const feed = await request('/api/builds?sort=newest');
  const feedItems = feed.data.builds.filter(item => item.id === original.id && item.is_repost);
  assert.equal(feedItems.length, 2);
  assert.deepEqual(new Set(feedItems.map(item => item.reposted_by)), new Set(['P5CDetailReposter', 'P5CDetailAnother']));
  assert.ok(feedItems.every(item => item.owner === 'P5CDetailOwner'));

  const profile = await request('/api/stats/profile/P5CDetailReposter');
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.data.reposts.map(item => item.id), [second.id, original.id]);
  assert.ok(profile.data.reposts.every(item => item.is_repost && item.owner === 'P5CDetailOwner'));
  assert.equal(profile.data.reposts[0].reposted_by, 'P5CDetailReposter');

  const updated = await request(`/api/builds/${original.id}`, {
    method: 'PUT',
    cookie: owner.cookie,
    body: {
      title: 'Updated original build',
      game_id: gameId,
      description: 'Updated original description',
      image_urls: original.image_urls,
      budget_tier: original.budget_tier,
      build_type: original.build_type,
      tags: [],
    },
  });
  assert.equal(updated.status, 200);
  const repostedProfile = await request('/api/stats/profile/P5CDetailReposter');
  assert.equal(repostedProfile.data.reposts.find(item => item.id === original.id).title, 'Updated original build');

  assert.equal((await request(`/api/builds/${original.id}`, { method: 'PUT', cookie: reposter.cookie, body: {} })).status, 403);
  assert.equal((await request(`/api/builds/${original.id}`, { method: 'DELETE', cookie: reposter.cookie })).status, 403);
  assert.equal((await request(`/api/builds/${original.id}/pin`, {
    method: 'POST', cookie: reposter.cookie, body: { is_pinned: true },
  })).status, 403);

  const deleted = await request(`/api/builds/${original.id}`, { method: 'DELETE', cookie: owner.cookie });
  assert.equal(deleted.status, 200);
  const remaining = await database.query('SELECT count(*)::int AS count FROM reposts WHERE build_id=$1', [original.id]);
  assert.equal(remaining.rows[0].count, 0);
  assert.equal((await request(`/api/builds/${original.id}`)).status, 404);
  const afterDelete = await request('/api/stats/profile/P5CDetailReposter');
  assert.deepEqual(afterDelete.data.reposts.map(item => item.id), [second.id]);
});
