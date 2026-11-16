// Integration checks against the QA database only. Fixture schemas retain test
// data separately from public; no existing QA rows are deleted or overwritten.
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { createApp } = require('../server');
const { initialize } = require('../db/init');
const { seedDatabase, inspectSeed } = require('../db/seed');
const { pool: publicPool } = require('../db/pool');
const content = require('../db/content');

const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('base64url');
let database;
let schema;
let server;
let base;
let user;
let cookie;
const fixturePools = [];
const fixtureSchemas = [];

async function fixture(label) {
  const name = `qa_p1_${runId}_${label}`;
  assert.match(name, /^[a-z0-9_]+$/);
  await publicPool.query(`CREATE SCHEMA "${name}"`);
  fixtureSchemas.push(name);
  const db = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${name}` });
  fixturePools.push(db);
  await initialize(db);
  return { database: db, schema: name };
}
async function serve(db = database, extra = {}) {
  const listener = createApp({ database: db, env: { SESSION_SECRET: secret }, ...extra }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}
async function close(listener) {
  listener.closeIdleConnections();
  await new Promise((resolve, reject) => listener.close(err => err ? reject(err) : resolve()));
}
async function request(path, { method = 'GET', body, auth, raw } = {}, target = base) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Cookie = auth;
  const res = await fetch(target + path, {
    method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return {
    status: res.status, data, text, headers: res.headers,
    cookie: res.headers.get('set-cookie')?.split(';')[0],
  };
}
function wrappedDatabase(db, wrap) {
  return {
    query: (...args) => db.query(...args),
    async connect() {
      const client = await db.connect();
      return { query: (...args) => wrap(client, ...args), release: () => client.release() };
    },
  };
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Tests must never run against production.');
  assert.ok(process.env.DATABASE_URL, 'QA database is required.');
  ({ database, schema } = await fixture('auth'));
  ({ server, base } = await serve());
});
after(async () => {
  if (server?.listening) await close(server);
  await Promise.all(fixturePools.map(db => db.end()));
  for (const name of fixtureSchemas) await publicPool.query(`DROP SCHEMA "${name}" CASCADE`);
  await publicPool.end();
});

test('1. Node 24, healthy database, static pages, and SQL-backed session schema', async () => {
  assert.equal(process.versions.node.split('.')[0], '24');
  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.db, 'connected');
  const tables = await database.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [schema]);
  assert.equal(tables.rows[0].n, 15);
  for (const page of ['/', '/login.html', '/register.html', '/games.html', '/game.html', '/compare.html', '/top10.html', '/post.html', '/profile.html', '/settings.html', '/build.html', '/notifications.html', '/forgot-password.html', '/reset-password.html', '/about.html']) {
    const result = await request(page);
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-type'), /text\/html/);
  }
});

test('2. complete demo seed and repeated schema/seed initialization preserve all rows', async () => {
  assert.equal((await seedDatabase(database, password)).status, 'seeded');
  const before = await database.query('SELECT row_to_json(u) AS data FROM users u ORDER BY id');
  const games = await database.query('SELECT slug FROM games ORDER BY slug');
  assert.deepEqual(games.rows.map(g => g.slug), content.games.map(g => g.slug).sort());
  assert.equal((await database.query('SELECT count(*)::int AS n FROM builds')).rows[0].n, 10);
  assert.equal((await inspectSeed(database)).missing.length, 0);
  await initialize(database);
  assert.equal((await seedDatabase(database, password)).status, 'verified');
  assert.deepEqual((await database.query('SELECT row_to_json(u) AS data FROM users u ORDER BY id')).rows, before.rows);
  const hashes = (await database.query('SELECT password_hash FROM users')).rows;
  assert.equal(hashes.length, 5);
  for (const row of hashes) {
    assert.notEqual(row.password_hash, password);
    assert.equal(await bcrypt.compare(password, row.password_hash), true);
  }
});

test('3. seed failure rolls back every insert and missing credentials are rejected', async () => {
  const other = (await fixture('seedrollback')).database;
  const failing = wrappedDatabase(other, (client, sql, values) => {
    if (sql.includes('INSERT INTO builds')) throw new Error('Deliberately injected fixture failure');
    return client.query(sql, values);
  });
  await assert.rejects(seedDatabase(failing, password), /fixture failure/);
  for (const table of ['games', 'game_tags', 'users', 'profiles', 'builds']) {
    assert.equal((await other.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0);
  }
  await assert.rejects(seedDatabase(other, ''), /SEED_PASSWORD/);
});

test('4. incomplete seed is reported without overwriting or deleting data', async () => {
  const other = (await fixture('incomplete')).database;
  await other.query('INSERT INTO games (slug, name, genre) VALUES ($1,$2,$3)', ['bloxburg', 'Existing QA entry', 'Fixture']);
  await assert.rejects(seedDatabase(other, password), /Incomplete demo seed/);
  const rows = (await other.query('SELECT name FROM games')).rows;
  assert.deepEqual(rows, [{ name: 'Existing QA entry' }]);
  assert.equal((await other.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 0);
});

test('5. registration preserves username case, normalizes email, hashes password, creates profile and session', async () => {
  const result = await request('/api/auth/register', {
    method: 'POST', body: { username: 'CaseBuilder', email: 'SAMPLE@Example.Test', password, displayName: 'QA Builder' },
  });
  assert.equal(result.status, 201);
  user = result.data.user;
  cookie = result.cookie;
  assert.equal(user.username, 'CaseBuilder');
  assert.equal(user.displayName, 'QA Builder');
  assert.equal(user.role, 'member');
  assert.deepEqual(Object.keys(user).sort(), ['displayName', 'id', 'role', 'username']);
  assert.match(result.headers.get('set-cookie'), /HttpOnly/);
  assert.match(result.headers.get('set-cookie'), /SameSite=Lax/);
  const stored = (await database.query(
    'SELECT u.email, u.password_hash, p.display_name FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = $1', [user.id])).rows[0];
  assert.equal(stored.email, 'sample@example.test');
  assert.equal(await bcrypt.compare(password, stored.password_hash), true);
  assert.notEqual(stored.password_hash, password);
  assert.equal(stored.display_name, 'QA Builder');
  assert.equal((await request('/api/auth/me', { auth: cookie })).data.user.id, user.id);
  assert.equal((await request('/api/auth/me')).data.user, null);
});

test('6. malformed fields, email whitespace/missing dot, password lengths, and duplicates fail safely', async () => {
  for (const bad of [
    { username: 'x' }, { username: 'bad name' }, { email: 'space here@example.test' },
    { email: 'x@example' }, { email: 'x@@example.test' }, { password: 'short' },
    { password: 'x'.repeat(73) }, { password: 'é'.repeat(37) },
    { password: null }, { username: null }, { displayName: 'x'.repeat(81) },
  ]) {
    const result = await request('/api/auth/register', {
      method: 'POST', body: { username: 'ValidUser', email: 'valid@example.test', password, ...bad },
    });
    assert.equal(result.status, 400);
    assert.ok(result.data.errors);
  }
  for (const body of [
    { username: 'casebuilder', email: 'other@example.test', password },
    { username: 'AnotherUser', email: 'SAMPLE@example.test', password },
  ]) {
    assert.equal((await request('/api/auth/register', { method: 'POST', body })).status, 409);
  }
  assert.equal((await database.query('SELECT count(*)::int AS n FROM users')).rows[0].n, 6);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM profiles')).rows[0].n, 6);
});

test('7. profile insertion failure rolls back the newly created user', async () => {
  const failing = wrappedDatabase(database, (client, sql, values) => {
    if (sql.includes('INSERT INTO profiles')) throw new Error('Injected profile error containing private detail');
    return client.query(sql, values);
  });
  const instance = await serve(failing);
  try {
    const result = await request('/api/auth/register', {
      method: 'POST', body: { username: 'RollbackUser', email: 'rollback@example.test', password },
    }, instance.base);
    assert.equal(result.status, 500);
    assert.doesNotMatch(result.text, /private detail|password_hash|SELECT|INSERT/);
    assert.equal((await database.query('SELECT count(*)::int AS n FROM users WHERE username = $1', ['RollbackUser'])).rows[0].n, 0);
  } finally { await close(instance.server); }
});

test('8. invalid/missing logins and SQL injection are rejected without a session', async () => {
  for (const body of [
    { username: 'casebuilder', password: randomBytes(16).toString('hex') },
    { username: 'UnknownUser', password },
    { username: "' OR 1=1 --", password },
    { username: 'casebuilder', password: 'x'.repeat(73) },
  ]) {
    const result = await request('/api/auth/login', { method: 'POST', body });
    assert.equal(result.status, 401);
    assert.equal(result.cookie, undefined);
  }
  assert.equal((await request('/api/auth/login', { method: 'POST', body: {} })).status, 400);
});

test('9. case-insensitive username/email login rotates the session; two browsers stay isolated', async () => {
  const first = await request('/api/auth/login', { method: 'POST', auth: cookie, body: { username: 'CASEBUILDER', password } });
  assert.equal(first.status, 200);
  assert.equal(first.data.user.username, 'CaseBuilder');
  assert.notEqual(first.cookie, cookie);
  assert.equal((await request('/api/auth/me', { auth: cookie })).data.user, null);
  cookie = first.cookie;
  const second = await request('/api/auth/login', {
    method: 'POST', body: { username: 'SAMPLE@EXAMPLE.TEST', password },
  });
  assert.equal(second.status, 200);
  assert.notEqual(second.cookie, cookie);
  assert.equal((await request('/api/auth/logout', { method: 'POST', auth: second.cookie })).status, 200);
  assert.equal((await request('/api/auth/me', { auth: second.cookie })).data.user, null);
  assert.equal((await request('/api/auth/me', { auth: cookie })).data.user.id, user.id);
});

test('10. app restart retains the user, complete seed, and PostgreSQL-backed session', async () => {
  await close(server);
  ({ server, base } = await serve());
  assert.equal((await request('/api/auth/me', { auth: cookie })).data.user.id, user.id);
  assert.equal((await inspectSeed(database)).missing.length, 0);
  assert.equal((await database.query('SELECT count(*)::int AS n FROM users WHERE id = $1', [user.id])).rows[0].n, 1);
});

test('11. logout expires the cookie and invalidates the stored session, including replay', async () => {
  const result = await request('/api/auth/logout', { method: 'POST', auth: cookie });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request('/api/auth/me', { auth: cookie })).data.user, null);
  assert.equal((await request('/api/auth/logout', { method: 'POST' })).status, 200);
});

test('12. existing anonymous write guards still return 401; later-phase public scaffolds respond', async () => {
  const id = randomUUID();
  for (const [path, method] of [
    ['/api/builds', 'POST'], [`/api/builds/${id}`, 'PUT'], [`/api/builds/${id}`, 'DELETE'],
    [`/api/builds/${id}/pin`, 'POST'], [`/api/social/builds/${id}/like`, 'POST'],
    [`/api/social/builds/${id}/rating`, 'POST'], [`/api/social/builds/${id}/comments`, 'POST'],
    [`/api/social/builds/${id}/favorite`, 'POST'],
  ]) assert.equal((await request(path, { method, body: {} })).status, 401);
  assert.equal((await request('/api/social/favorites')).status, 401);
  for (const path of ['/api/games', '/api/builds', '/api/stats/top10']) {
    assert.equal((await request(path)).status, 200);
  }
});

test('13. API errors are JSON, unknown API routes are 404, database health failures are 503', async () => {
  assert.equal((await request('/api/auth/login', { method: 'POST', raw: '{bad' })).status, 400);
  assert.equal((await request('/api/auth/login', { method: 'POST', raw: 'x'.repeat(33000) })).status, 413);
  assert.equal((await request('/api/unknown')).status, 404);
  const failing = { query: async () => { throw new Error('Sensitive fixture database detail'); } };
  const instance = await serve(failing);
  try {
    const health = await request('/api/health', {}, instance.base);
    assert.equal(health.status, 503);
    assert.equal(health.data.status, 'error');
    assert.equal(health.data.db, 'unavailable');
    assert.doesNotMatch(health.text, /Sensitive/);
  } finally { await close(instance.server); }
});

test('14. missing session secret fails loudly, and production cookies require HTTPS behind the proxy', async () => {
  assert.throws(() => createApp({ env: { NODE_ENV: 'production' } }), /SESSION_SECRET/);
  assert.throws(() => createApp({ env: {} }), /SESSION_SECRET/);
  const instance = await serve(database, { env: { NODE_ENV: 'production', SESSION_SECRET: secret } });
  try {
    const res = await fetch(instance.base + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https' },
      body: JSON.stringify({ username: 'CASEBUILDER', password }),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /; Secure/);
    await res.text();
  } finally { await close(instance.server); }
});

test('15. forms load shared handlers, expose accessible errors, and shared top bars have logout wiring', async () => {
  for (const mode of ['login', 'register']) {
    const page = await request(`/${mode}.html`);
    assert.match(page.text, new RegExp(`data-auth="${mode}"`));
    assert.match(page.text, /role="alert"/);
    assert.match(page.text, /src="\/js\/auth-form.js"/);
  }
  const forms = await request('/js/auth-form.js');
  assert.match(forms.text, /Object\.fromEntries\(new FormData\(form\)\)/);
  assert.match(forms.text, /location\.assign\('\/'\)/);
  const shared = await request('/js/app.js');
  assert.match(shared.text, /await getMe\(\)/);
  assert.match(shared.text, /await logout\(\)/);
  assert.match(shared.text, /button\.textContent = 'Logout'/);
  const schemaText = readFileSync(require.resolve('../db/schema.sql'), 'utf8');
  assert.doesNotMatch(schemaText, /DROP TABLE|TRUNCATE/i);
  assert.doesNotMatch(readFileSync(require.resolve('../server'), 'utf8'), /OIDS|dev-only-secret/);
});
