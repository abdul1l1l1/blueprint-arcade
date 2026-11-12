// Phase 5B privacy and ownership acceptance against an isolated QA schema.
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { createApp } = require('../server');

const schema = `qa_p5b_${randomUUID().replaceAll('-', '')}`;
const seedPassword = randomBytes(24).toString('base64url');
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
let database, server, base, owner, other, ownerBuild, otherBuild;

async function start(db = database) {
  const listener = createApp({ database: db, env: { SESSION_SECRET: secret } }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}

async function close(listener) {
  listener.closeIdleConnections();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}

async function request(url, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return {
    status: response.status,
    text,
    data,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    headers: response.headers,
  };
}

async function createBuild(actor, title, imageReference) {
  return request('/api/builds', {
    method: 'POST',
    cookie: actor.cookie,
    body: {
      title,
      game_id: 1,
      description: `${title} description`,
      image_urls: [imageReference],
      budget_tier: 'mid',
      build_type: 'freeform',
      tags: ['Modern Villa'],
    },
  });
}

async function social(actor, buildId, action, body) {
  return request(`/api/social/builds/${buildId}/${action}`, {
    method: 'POST',
    cookie: actor.cookie,
    body,
  });
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Phase 5B tests must run in QA.');
  assert.ok(process.env.DATABASE_URL, 'QA database is required.');
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  await initialize(database);
  await seedDatabase(database, seedPassword);
  ({ server, base } = await start());

  for (const [username, email] of [
    ['DataOwner', 'data-owner@example.test'],
    ['DataOther', 'data-other@example.test'],
  ]) {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: { username, email, password, displayName: username },
    });
    assert.equal(result.status, 201);
    if (username === 'DataOwner') owner = { user: result.data.user, email, cookie: result.cookie, registration: result };
    else other = { user: result.data.user, email, cookie: result.cookie, registration: result };
  }

  await database.query(
    `UPDATE profiles SET bio=$1,avatar_url=$2,favorite_game_id=$3 WHERE user_id=$4`,
    ['owner-profile-marker', 'https://example.test/owner-avatar.png', 1, owner.user.id],
  );
  ownerBuild = (await createBuild(owner, 'Owner Export Build', 'https://example.test/owner-image.png')).data.build;
  otherBuild = (await createBuild(other, 'Other User Build', 'https://example.test/other-private-image.png')).data.build;
  assert.ok(ownerBuild?.id);
  assert.ok(otherBuild?.id);

  assert.equal((await social(owner, otherBuild.id, 'comments', { body: 'owner-authored-comment' })).status, 201);
  assert.equal((await social(other, ownerBuild.id, 'comments', { body: 'other-authored-comment' })).status, 201);
  assert.equal((await social(owner, otherBuild.id, 'rating', { stars: 4 })).status, 200);
  assert.equal((await social(other, ownerBuild.id, 'rating', { stars: 2 })).status, 200);
  assert.equal((await social(owner, otherBuild.id, 'like')).status, 200);
  assert.equal((await social(other, ownerBuild.id, 'like')).status, 200);
  assert.equal((await social(owner, otherBuild.id, 'favorite')).status, 200);
  assert.equal((await social(other, ownerBuild.id, 'favorite')).status, 200);
});

after(async () => {
  if (server?.listening) await close(server);
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('5B. export is generated for the session user and includes every owned data category', async () => {
  const result = await request('/api/auth/me/data?userId=ignored', { cookie: owner.cookie });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('content-type'), /application\/json/);
  assert.match(result.headers.get('content-disposition'), /attachment; filename="?blueprint-arcade-my-data\.json"?/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('x-content-type-options'), 'nosniff');

  const data = result.data;
  assert.equal(data.formatVersion, 1);
  assert.ok(Number.isFinite(Date.parse(data.exportedAt)));
  assert.equal(data.account.username, 'DataOwner');
  assert.equal(data.account.email, owner.email);
  assert.equal(data.account.role, 'member');
  assert.equal(data.profile.displayName, 'DataOwner');
  assert.equal(data.profile.bio, 'owner-profile-marker');
  assert.equal(data.profile.avatarUrl, 'https://example.test/owner-avatar.png');
  assert.equal(data.profile.favoriteGameId, 1);
  assert.equal(data.builds.length, 1);
  assert.equal(data.builds[0].id, ownerBuild.id);
  assert.deepEqual(data.builds[0].imageReferences, ['https://example.test/owner-image.png']);
  assert.deepEqual(data.builds[0].tags, ['Modern Villa']);

  assert.deepEqual(data.comments.map(comment => comment.body), ['owner-authored-comment']);
  assert.equal(data.comments[0].buildId, otherBuild.id);
  assert.deepEqual(data.ratings.map(rating => [rating.buildId, rating.stars]), [[otherBuild.id, 4]]);
  assert.deepEqual(data.likes.map(like => like.buildId), [otherBuild.id]);
  assert.deepEqual(data.favorites.map(favorite => favorite.buildId), [otherBuild.id]);

  const json = JSON.stringify(data);
  assert.doesNotMatch(json, /password_hash|passwordHash|other-authored-comment|Other User Build|other-private-image/);
  assert.equal(json.includes(other.email), false);
  assert.equal(Object.hasOwn(data.account, 'password'), false);
  assert.equal(Object.hasOwn(data.account, 'passwordHash'), false);

  const secondUser = await request('/api/auth/me/data?userId=ignored', { cookie: other.cookie });
  assert.equal(secondUser.status, 200);
  assert.equal(secondUser.data.account.username, 'DataOther');
  assert.deepEqual(secondUser.data.builds.map(build => build.id), [otherBuild.id]);
  assert.deepEqual(secondUser.data.comments.map(comment => comment.body), ['other-authored-comment']);
  assert.equal(JSON.stringify(secondUser.data).includes(owner.email), false);
});

test('5B. unauthenticated export requests are rejected', async () => {
  for (const url of ['/api/auth/me/data', `/api/auth/me/data?userId=${owner.user.id}`]) {
    const result = await request(url);
    assert.equal(result.status, 401);
  }
});

test('5B. public API responses omit all account emails and password hashes', async () => {
  const accounts = (await database.query('SELECT email,password_hash FROM users ORDER BY username')).rows;
  assert.ok(accounts.length >= 7);
  const responses = [
    owner.registration,
    other.registration,
    await request('/api/health'),
    await request('/api/auth/me'),
    await request('/api/builds'),
    await request(`/api/builds/${otherBuild.id}`),
    await request('/api/games'),
    await request('/api/games/bloxburg'),
    await request('/api/stats/top10'),
    await request('/api/stats/profile/DataOwner'),
    await request(`/api/social/builds/${ownerBuild.id}/comments`),
    await request(`/api/social/builds/${ownerBuild.id}/state`),
    await request('/api/auth/login', {
      method: 'POST',
      body: { username: 'DataOwner', password },
    }),
  ];
  for (const response of responses) {
    assert.ok([200, 201].includes(response.status), `Unexpected public API status: ${response.status}`);
    assert.doesNotMatch(response.text, /"password_hash"\s*:|"email"\s*:/i);
    for (const account of accounts) {
      assert.equal(response.text.includes(account.email), false, `Private email leaked from API: ${account.email}`);
      assert.equal(response.text.includes(account.password_hash), false, 'Password hash leaked from a public API response.');
    }
  }
});

test('5B. My Data controls and deletion guidance appear only in the profile settings', async () => {
  const html = readFileSync(path.join(__dirname, '../public/profile.html'), 'utf8');
  const script = readFileSync(path.join(__dirname, '../public/js/profile.js'), 'utf8');
  assert.match(html, /id="profile-data-tools"[^>]*hidden/);
  assert.match(html, /href="\/api\/auth\/me\/data"[^>]*download/);
  assert.match(html, />Download My Data</);
  assert.match(html, /Delete a build/);
  assert.match(html, /request account deletion from the site owner/i);
  assert.match(script, /dataTools\.hidden = !isOwner/);
  assert.match(script, /String\(me\.id\) === String\(profile\.id\)/);
});

test('5B. My Data controls are visible only on the logged-in user profile', async () => {
  const source = readFileSync(path.join(__dirname, '../public/js/profile.js'), 'utf8');
  async function toolsHidden(sessionUser, profileUser) {
    const elements = new Map();
    const makeElement = () => ({
      hidden: true,
      textContent: '',
      replaceChildren() {},
      append() {},
      setAttribute() {},
    });
    const document = {
      title: '',
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeElement());
        return elements.get(id);
      },
      querySelector() { return { setAttribute() {} }; },
      addEventListener(name, callback) { handlers[name] = callback; },
    };
    const handlers = {};
    const profile = {
      id: profileUser.id,
      username: profileUser.username,
      display_name: profileUser.username,
      bio: '',
      avatar_url: '',
      build_count: 0,
      pinned_count: 0,
    };
    const context = {
      document,
      location: { search: `?username=${encodeURIComponent(profile.username)}` },
      URLSearchParams,
      getMe: async () => ({ user: sessionUser }),
      api: async () => ({ profile, builds: [] }),
      BuildsUI: {
        statePanel() {},
        node(_tag, _className, text) { return { textContent: text, setAttribute() {} }; },
        safeImageUrl() { return ''; },
        renderCards() {},
      },
    };
    vm.runInNewContext(source, context);
    await handlers.DOMContentLoaded();
    return elements.get('profile-data-tools').hidden;
  }

  assert.equal(await toolsHidden(owner.user, owner.user), false);
  assert.equal(await toolsHidden(other.user, owner.user), true);
  assert.equal(await toolsHidden(null, owner.user), true);
});
