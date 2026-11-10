// Phase 3 acceptance: actual PostgreSQL + HTTP, isolated retained QA schema.
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
const schema = `qa_p3_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
let database, server, base, owner, other, gameId, build, unpinned;
const newIds = [];
async function serve(db = database) {
  const listener = createApp({ database: db, env: { SESSION_SECRET: secret } }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}
async function close(listener) {
  listener.closeIdleConnections();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}
async function request(path, { method = 'GET', body, cookie } = {}, origin = base) {
  const response = await fetch(origin + path, {
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, text, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const payload = (extra = {}) => ({
  title: 'QA Build', game_id: gameId, description: 'QA description',
  image_urls: ['https://example.test/qa-cover.png', 'https://example.test/second.png'],
  budget_tier: 'mid', build_type: 'freeform', tags: ['Modern Villa'], is_pinned: false, ...extra,
});
async function create(extra = {}, actor = owner) {
  return request('/api/builds', { method: 'POST', cookie: actor.cookie, body: payload(extra) });
}
async function profile(actor = owner) {
  return request(`/api/stats/profile/${actor.user.username}`);
}
before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'QA only.');
  assert.ok(process.env.DATABASE_URL);
  assert.match(schema, /^qa_p3_[a-z0-9]+$/);
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, password);
  ({ server, base } = await serve());
  gameId = (await database.query("SELECT id FROM games WHERE slug=$1", ['bloxburg'])).rows[0].id;
});
after(async () => {
  if (server?.listening) await close(server);
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('P3.1 anonymous showcase returns all ten credited seed builds, complete public fields, tags, and no credentials', async () => {
  const result = await request('/api/builds');
  assert.equal(result.status, 200);
  assert.equal(result.data.builds.length, 10);
  for (const row of result.data.builds) {
    const original = content.builds.find(item => item.title === row.title);
    assert.equal(row.owner, original.owner);
    assert.equal(row.game_slug, original.game);
    assert.equal(row.budget_tier, original.budget_tier);
    assert.equal(row.build_type, original.build_type);
    assert.equal(row.description, original.description);
    assert.deepEqual(row.tags, [...original.tags].sort());
    assert.deepEqual(row.image_urls, []);
    assert.equal(typeof row.avg_rating, 'number');
    assert.equal(typeof row.like_count, 'number');
  }
  assert.doesNotMatch(result.text, /password_hash|"email"|"sess"|"role"/);
});

test('P3.2 search is case-insensitive and literal; game, type, budget, tag, combined filters and empty results are correct', async () => {
  for (const [query, titles] of [
    ['q=SUNSET', ['Sunset Manor']],
    ['q=infinity', ['Sunset Manor']],
    ['q=%25', []], ["q=%27%20OR%201%3D1--", []],
    ['game=the-sims-4', ['Mill Mansion', 'Tiny Town Rowhome']],
    ['build_type=renovation', ['Hoarder House Rescue', 'The Loft Rebirth']],
    ['budget_tier=luxury', ['Mill Mansion', 'Sunset Manor']],
    ['tag=No-Cheats', ['Beach A-Frame', 'Sunset Manor']],
    ['game=bloxburg&build_type=freeform&budget_tier=starter&tag=No-Cheats&q=beach', ['Beach A-Frame']],
    ['game=minecraft', []],
  ]) {
    const result = await request(`/api/builds?${query}`);
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.builds.map(item => item.title).sort(), titles.sort());
  }
});

test('P3.3 newest/rating/likes sorting and safe query rejection work on seed data', async () => {
  for (const sort of ['newest', 'rating', 'likes']) {
    const result = await request(`/api/builds?sort=${sort}`);
    assert.equal(result.status, 200);
    const builds = result.data.builds;
    for (let i = 1; i < builds.length; i++) {
      const key = sort === 'newest' ? 'created_at' : sort === 'rating' ? 'avg_rating' : 'like_count';
      assert.ok(sort === 'newest' ? Date.parse(builds[i - 1][key]) >= Date.parse(builds[i][key]) : builds[i - 1][key] >= builds[i][key]);
    }
    if (sort === 'rating') assert.equal(builds[0].title, 'Tiny Town Rowhome');
    if (sort === 'likes') assert.equal(builds[0].title, 'Sunset Manor');
  }
  for (const query of ['q=x&q=y', 'q=%00', `q=${'x'.repeat(121)}`, 'build_type=invalid', 'budget_tier=invalid',
    'sort=constructor', 'sort=likes%3BDROP%20TABLE%20builds', 'tag=a&tag=b', 'game=a&game=b']) {
    assert.equal((await request(`/api/builds?${query}`)).status, 400);
  }
});

test('P3.4 public profiles resolve case-insensitively, expose only their builds pinned first, and return 404 for unknown users', async () => {
  const result = await request('/api/stats/profile/ABDUL_BUILDS');
  assert.equal(result.status, 200);
  assert.equal(result.data.profile.build_count, 3);
  assert.equal(result.data.profile.pinned_count, 3);
  assert.ok(result.data.builds.every(item => item.owner === 'abdul_builds' && item.is_pinned));
  assert.doesNotMatch(result.text, /password_hash|"email"|"sess"|"role"/);
  assert.equal((await request('/api/stats/profile/unknown-qa-profile')).status, 404);
});

test('P3.5 anonymous create/edit/delete/pin are denied and two real authenticated sessions are established', async () => {
  for (const [path, method] of [['/api/builds', 'POST'], [`/api/builds/${randomUUID()}`, 'PUT'],
    [`/api/builds/${randomUUID()}`, 'DELETE'], [`/api/builds/${randomUUID()}/pin`, 'POST']]) {
    assert.equal((await request(path, { method, body: {} })).status, 401);
  }
  for (const [name, assign] of [['P3Owner', data => { owner = data; }], ['P3Other', data => { other = data; }]]) {
    const result = await request('/api/auth/register', { method: 'POST',
      body: { username: name, email: `${name.toLowerCase()}@example.test`, password, displayName: name } });
    assert.equal(result.status, 201);
    assign({ user: result.data.user, cookie: result.cookie });
  }
  assert.equal((await profile()).data.profile.build_count, 0);
});

test('P3.6 create persists the full build and tags, ignores spoofed owner, and is visible in showcase/game/profile/read', async () => {
  const result = await create({ title: '  QA Created Home  ', owner_id: other.user.id });
  assert.equal(result.status, 201);
  build = result.data.build;
  assert.equal(build.title, 'QA Created Home');
  assert.equal(build.owner_id, owner.user.id);
  assert.deepEqual(build.image_urls, payload().image_urls);
  assert.deepEqual(build.tags, ['Modern Villa']);
  assert.equal((await request(`/api/builds/${build.id}`)).data.build.owner_id, owner.user.id);
  assert.equal((await profile()).data.builds.length, 1);
  assert.ok((await request('/api/games/bloxburg')).data.builds.some(row => row.id === build.id));
  assert.equal((await request('/api/builds?q=QA%20Created')).data.builds[0].id, build.id);
});

test('P3.7 invalid fields, unsafe URLs, wrong-game tags and duplicate tags fail atomically', async () => {
  const before = (await profile()).data.profile.build_count;
  for (const extra of [{ title: ' ' }, { game_id: '1' }, { game_id: 2147483647 },
    { budget_tier: 'cheap' }, { build_type: 'house' }, { description: {} },
    { image_urls: ['javascript:alert(1)'] }, { image_urls: ['data:image/png;base64,eA=='] },
    { image_urls: ['file:///etc/passwd'] }, { image_urls: ['https://user:private@example.test/a'] },
    { image_urls: ['not a url'] }, { image_urls: null }, { tags: null },
    { tags: ['Cottagecore'] }, { tags: ['Modern Villa', 'Modern Villa'] },
    { is_pinned: 'true' }, { title: 'bad\0title' }]) {
    const result = await create(extra);
    assert.equal(result.status, 400);
    assert.ok(result.data.errors);
  }
  assert.equal((await profile()).data.profile.build_count, before);
});

test('P3.8 non-owner edit/delete/pin are 403 without changing any build data', async () => {
  const before = (await request(`/api/builds/${build.id}`)).data;
  for (const [path, method, body] of [[`/api/builds/${build.id}`, 'PUT', payload({ title: 'Stolen' })],
    [`/api/builds/${build.id}`, 'DELETE', undefined], [`/api/builds/${build.id}/pin`, 'POST', { is_pinned: true }]]) {
    assert.equal((await request(path, { method, body, cookie: other.cookie })).status, 403);
  }
  assert.deepEqual((await request(`/api/builds/${build.id}`)).data, before);
});

test('P3.9 owner edit changes game, text, images, budget, type and vocabulary atomically; old tags disappear', async () => {
  const sims = (await request('/api/games/the-sims-4')).data.game.id;
  const result = await request(`/api/builds/${build.id}`, { method: 'PUT', cookie: owner.cookie,
    body: payload({ title: 'QA Edited Cottage', game_id: sims, image_urls: [], tags: ['Cottagecore'], build_type: 'interior', budget_tier: 'starter' }) });
  assert.equal(result.status, 200);
  build = result.data.build;
  assert.equal(build.game_slug, 'the-sims-4');
  assert.deepEqual(build.tags, ['Cottagecore']);
  assert.deepEqual(build.image_urls, []);
  assert.ok(!(await request('/api/games/bloxburg')).data.builds.some(row => row.id === build.id));
  const before = (await request(`/api/builds/${build.id}`)).data;
  const bad = await request(`/api/builds/${build.id}`, { method: 'PUT', cookie: owner.cookie, body: payload({ tags: ['Cottagecore'] }) });
  assert.equal(bad.status, 400);
  assert.deepEqual((await request(`/api/builds/${build.id}`)).data, before);
});

test('P3.10 three pins allowed; fourth rejected on pin, create and update without partial writes; unpin frees a slot', async () => {
  for (let i = 0; i < 4; i++) {
    const result = await create({ title: `QA Pin Fixture ${i}`, is_pinned: i < 3 });
    assert.equal(result.status, 201);
    newIds.push(result.data.build.id);
  }
  unpinned = newIds[3];
  assert.equal((await profile()).data.profile.pinned_count, 3);
  assert.equal((await request(`/api/builds/${unpinned}/pin`, { method: 'POST', cookie: owner.cookie, body: { is_pinned: true } })).status, 409);
  assert.equal((await create({ title: 'QA Rejected Fourth Pin', is_pinned: true })).status, 409);
  assert.equal((await request(`/api/builds/${unpinned}`, { method: 'PUT', cookie: owner.cookie, body: payload({ title: 'Must not overwrite', is_pinned: true }) })).status, 409);
  assert.equal((await request(`/api/builds/${unpinned}`)).data.build.title, 'QA Pin Fixture 3');
  // Idempotently keeping an existing pin is allowed even at the cap.
  assert.equal((await request(`/api/builds/${newIds[0]}/pin`, { method: 'POST', cookie: owner.cookie, body: { is_pinned: true } })).status, 200);
  assert.equal((await request(`/api/builds/${newIds[0]}`, { method: 'PUT', cookie: owner.cookie, body: payload({ is_pinned: true }) })).status, 200);
  assert.equal((await request(`/api/builds/${newIds[0]}/pin`, { method: 'POST', cookie: owner.cookie, body: { is_pinned: false } })).status, 200);
  assert.equal((await request(`/api/builds/${unpinned}/pin`, { method: 'POST', cookie: owner.cookie, body: { is_pinned: true } })).status, 200);
  const result = await profile();
  assert.equal(result.data.profile.pinned_count, 3);
  assert.ok(result.data.builds.slice(0, 3).every(row => row.is_pinned));
  assert.ok(result.data.builds.slice(3).every(row => !row.is_pinned));
});

test('P3.11 concurrent create/edit/pin requests serialize on owner and cannot exceed three pins', async () => {
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const result = await create({ title: `QA Race ${i}` }, other);
    ids.push(result.data.build.id);
  }
  const result = await Promise.all([
    create({ title: 'QA Race create1', is_pinned: true }, other),
    create({ title: 'QA Race create2', is_pinned: true }, other),
    request(`/api/builds/${ids[0]}`, { method: 'PUT', cookie: other.cookie, body: payload({ is_pinned: true }) }),
    request(`/api/builds/${ids[1]}/pin`, { method: 'POST', cookie: other.cookie, body: { is_pinned: true } }),
    request(`/api/builds/${ids[2]}/pin`, { method: 'POST', cookie: other.cookie, body: { is_pinned: true } }),
  ]);
  assert.equal(result.filter(row => row.status === 200 || row.status === 201).length, 3);
  assert.equal(result.filter(row => row.status === 409).length, 2);
  assert.equal((await profile(other)).data.profile.pinned_count, 3);
});

test('P3.12 injected tag insertion failure rolls back edited fields and the previous tags', async () => {
  const before = (await request(`/api/builds/${build.id}`)).data;
  const failing = {
    query: (...args) => database.query(...args),
    async connect() {
      const client = await database.connect();
      return { release: () => client.release(), query(sql, values) {
        if (sql.includes('INSERT INTO build_tags')) throw new Error('Injected private fixture failure');
        return client.query(sql, values);
      } };
    },
  };
  const instance = await serve(failing);
  try {
    const result = await request(`/api/builds/${build.id}`, { method: 'PUT', cookie: owner.cookie, body: payload({ title: 'Rollback me' }) }, instance.base);
    assert.equal(result.status, 500);
    assert.doesNotMatch(result.text, /Injected|private|INSERT|password/);
    assert.deepEqual((await request(`/api/builds/${build.id}`)).data, before);
  } finally { await close(instance.server); }
});

test('P3.13 create/edit/pin and authenticated sessions persist across restart', async () => {
  const before = (await profile()).data;
  await close(server);
  ({ server, base } = await serve());
  assert.deepEqual((await profile()).data, before);
  assert.equal((await request('/api/auth/me', { cookie: owner.cookie })).data.user.id, owner.user.id);
  assert.equal((await request(`/api/builds/${build.id}`)).data.build.title, 'QA Edited Cottage');
});

test('P3.14 confirmed owner deletion removes only the chosen build and related tags; remains deleted after restart', async () => {
  const before = (await profile()).data.profile.build_count;
  const result = await request(`/api/builds/${build.id}`, { method: 'DELETE', cookie: owner.cookie });
  assert.equal(result.status, 200);
  assert.equal(result.data.deleted, true);
  assert.equal((await profile()).data.profile.build_count, before - 1);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM build_tags WHERE build_id=$1', [build.id])).rows[0].n, 0);
  await close(server);
  ({ server, base } = await serve());
  assert.equal((await request(`/api/builds/${build.id}`)).status, 404);
  assert.equal((await request(`/api/builds/${build.id}`, { method: 'DELETE', cookie: owner.cookie })).status, 404);
  assert.ok((await request(`/api/builds/${newIds[0]}`)).data.build);
});

test('P3.15 malformed/missing IDs and invalid pin payloads fail explicitly without leaking SQL', async () => {
  for (const [path, method, body] of [['/api/builds/not-a-uuid', 'GET'],
    ['/api/builds/not-a-uuid', 'PUT', payload()], ['/api/builds/not-a-uuid', 'DELETE'],
    [`/api/builds/${newIds[0]}/pin`, 'POST', { is_pinned: 'true' }]]) {
    const result = await request(path, { method, body, cookie: owner.cookie });
    assert.equal(result.status, 400);
    assert.doesNotMatch(result.text, /SELECT|password_hash|stack/);
  }
  for (const [method, suffix, body] of [['GET', '', undefined], ['PUT', '', payload()], ['DELETE', '', undefined], ['POST', '/pin', { is_pinned: true }]]) {
    assert.equal((await request(`/api/builds/${randomUUID()}${suffix}`, { method, body, cookie: owner.cookie })).status, 404);
  }
});
