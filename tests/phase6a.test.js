// Phase 6A notifications, password reset and About-page acceptance in QA.
require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { createApp } = require('../server');

const schema = `qa_p6a_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
const qaLog = [];
let database, server, base, owner, actor, build;

async function serve(db = database, env = { SESSION_SECRET: secret, NODE_ENV: 'test' }, logger = { info: message => qaLog.push(message) }) {
  const listener = createApp({ database: db, env, logger }).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { server: listener, base: `http://127.0.0.1:${listener.address().port}` };
}

async function close(listener) {
  listener.closeIdleConnections();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}

async function request(url, { method = 'GET', body, cookie } = {}, target = base) {
  const response = await fetch(`${target}${url}`, {
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

async function register(username, email) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email, password, displayName: username },
  });
  assert.equal(result.status, 201);
  return { user: result.data.user, email, cookie: result.cookie };
}

async function social(action, body, user = actor) {
  return request(`/api/social/builds/${build.id}/${action}`, {
    method: 'POST', body, cookie: user.cookie,
  });
}

function tokenFromLog(log) {
  const match = log.match(/\/reset-password\.html\?token=([A-Za-z0-9_-]+)/);
  assert.ok(match, 'QA log should contain a reset URL');
  return decodeURIComponent(match[1]);
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Phase 6A tests must run in QA.');
  assert.ok(process.env.DATABASE_URL, 'QA database is required.');
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, randomBytes(24).toString('base64url'));
  ({ server, base } = await serve());

  owner = await register('NotifyOwner', 'notify-owner@example.test');
  actor = await register('NotifyActor', 'notify-actor@example.test');
  const gameId = (await request('/api/games')).data.games[0].id;
  const created = await request('/api/builds', {
    method: 'POST',
    cookie: owner.cookie,
    body: {
      title: 'Notification test build',
      game_id: gameId,
      description: 'Build for isolated notification checks.',
      image_urls: [],
      budget_tier: 'starter',
      build_type: 'freeform',
      tags: [],
    },
  });
  assert.equal(created.status, 201);
  build = created.data.build;
});

after(async () => {
  if (server?.listening) await close(server);
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('6A notifications are private, count unread items, order newest first and mark all read on open', async () => {
  assert.equal((await request('/api/notifications/unread-count')).status, 401);
  assert.equal((await request('/api/notifications/open', { method: 'POST' })).status, 401);

  assert.equal((await social('like')).status, 200);
  assert.equal((await social('rating', { stars: 4 })).status, 200);
  assert.equal((await social('comments', { body: 'New comment on your build.' })).status, 201);
  assert.equal((await social('repost')).status, 200);

  for (const [action, body] of [
    ['like', undefined],
    ['rating', { stars: 5 }],
    ['comments', { body: 'Owner action should not notify the owner.' }],
  ]) assert.ok([200, 201].includes((await social(action, body, owner)).status));
  assert.equal((await social('repost', undefined, owner)).status, 403);

  const unread = await request('/api/notifications/unread-count', { cookie: owner.cookie });
  assert.equal(unread.status, 200);
  assert.equal(unread.data.unread_count, 4);
  assert.equal((await request('/api/notifications/unread-count', { cookie: actor.cookie })).data.unread_count, 0);

  const opened = await request('/api/notifications/open', { method: 'POST', cookie: owner.cookie });
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.data.notifications.map(item => item.eventType), ['repost', 'comment', 'rating', 'like']);
  assert.ok(opened.data.notifications.every(item => item.buildId === build.id && item.readAt));
  assert.ok(opened.data.notifications.every(item => item.actor === actor.user.displayName));
  assert.equal(opened.data.unread_count, 0);
  assert.equal((await request('/api/notifications/unread-count', { cookie: owner.cookie })).data.unread_count, 0);
  assert.deepEqual((await request('/api/notifications/open', { method: 'POST', cookie: actor.cookie })).data.notifications, []);

  const exported = await request('/api/auth/me/data', { cookie: owner.cookie });
  assert.equal(exported.status, 200);
  assert.deepEqual(exported.data.notifications.map(item => item.eventType), ['like', 'rating', 'comment', 'repost']);
  assert.ok(exported.data.notifications.every(item => item.buildId === build.id));
  assert.equal(Object.hasOwn(exported.data.notifications[0], 'actorId'), false);
});

test('6A likes, ratings, comments and reposts each create only the recipient notification', async () => {
  const rows = await database.query(
    `SELECT event_type,recipient_id,actor_id,build_id FROM notifications
     WHERE recipient_id=$1 ORDER BY id`,
    [owner.user.id],
  );
  assert.deepEqual(rows.rows.map(row => row.event_type), ['like', 'rating', 'comment', 'repost']);
  assert.ok(rows.rows.every(row => row.actor_id === actor.user.id && row.build_id === build.id));
  assert.equal((await database.query('SELECT count(*)::int AS count FROM notifications WHERE recipient_id=$1', [actor.user.id])).rows[0].count, 0);
});

test('6A reset requests do not reveal whether an email is registered and log QA links only for matches', async () => {
  const known = await request('/api/auth/password-reset/request', {
    method: 'POST', body: { email: owner.email.toUpperCase() },
  });
  assert.equal(known.status, 202);
  assert.equal(Object.hasOwn(known.data, 'resetUrl'), false);
  assert.equal(known.text.includes(owner.email), false);
  assert.equal(qaLog.length, 1);

  const unknown = await request('/api/auth/password-reset/request', {
    method: 'POST', body: { email: 'not-registered@example.test' },
  });
  assert.equal(unknown.status, known.status);
  assert.deepEqual(unknown.data, known.data);
  assert.equal(qaLog.length, 1);

  const token = tokenFromLog(qaLog[0]);
  const stored = await database.query(
    'SELECT token_hash,expires_at,used_at FROM password_reset_tokens WHERE user_id=$1',
    [owner.user.id],
  );
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].token_hash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(stored.rows[0].token_hash, token);
  assert.equal(stored.rows[0].used_at, null);
  const remainingMs = new Date(stored.rows[0].expires_at).getTime() - Date.now();
  assert.ok(59 * 60 * 1000 < remainingMs && remainingMs <= 60 * 60 * 1000);

  const productionLogs = [];
  const production = await serve(database, { SESSION_SECRET: secret, NODE_ENV: 'production' }, {
    info: message => productionLogs.push(message),
  });
  try {
    const response = await request('/api/auth/password-reset/request', {
      method: 'POST', body: { email: owner.email },
    }, production.base);
    assert.equal(response.status, known.status);
    assert.deepEqual(response.data, known.data);
    assert.deepEqual(productionLogs, []);
    assert.equal((await database.query('SELECT count(*)::int AS count FROM password_reset_tokens WHERE user_id=$1', [owner.user.id])).rows[0].count, 1);
  } finally { await close(production.server); }
});

test('6A reset tokens validate passwords, expire, and work only once', async () => {
  const token = tokenFromLog(qaLog[0]);
  const invalidToken = await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token: 'not-a-valid-token', password: 'LongEnoughPassword1!' },
  });
  assert.equal(invalidToken.status, 400);

  const shortPassword = await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token, password: 'short' },
  });
  assert.equal(shortPassword.status, 400);
  assert.match(shortPassword.data.errors.password, /8 characters/);
  const longPassword = await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token, password: 'é'.repeat(37) },
  });
  assert.equal(longPassword.status, 400);
  assert.match(longPassword.data.errors.password, /72 bytes/);

  const newPassword = 'NewSecurePassword1!';
  const updated = await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token, password: newPassword },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.ok, true);
  assert.equal((await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token, password: 'AnotherSecurePassword2!' },
  })).status, 400);
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: { username: owner.email, password },
  })).status, 401);
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: { username: owner.email, password: newPassword },
  })).status, 200);

  const secondRequest = await request('/api/auth/password-reset/request', {
    method: 'POST', body: { email: owner.email },
  });
  assert.equal(secondRequest.status, 202);
  const expiredToken = tokenFromLog(qaLog.at(-1));
  await database.query(
    `UPDATE password_reset_tokens SET expires_at=now()-interval '1 second'
     WHERE token_hash=$1`,
    [createHash('sha256').update(expiredToken).digest('hex')],
  );
  const expired = await request('/api/auth/password-reset/complete', {
    method: 'POST', body: { token: expiredToken, password: 'NewSecurePassword2!' },
  });
  assert.equal(expired.status, 400);
  assert.match(expired.data.errors.token, /invalid or expired/i);

  await request('/api/auth/password-reset/request', {
    method: 'POST', body: { email: owner.email },
  });
  const concurrentToken = tokenFromLog(qaLog.at(-1));
  const simultaneous = await Promise.all([
    request('/api/auth/password-reset/complete', {
      method: 'POST', body: { token: concurrentToken, password: 'ConcurrentPasswordA1!' },
    }),
    request('/api/auth/password-reset/complete', {
      method: 'POST', body: { token: concurrentToken, password: 'ConcurrentPasswordB2!' },
    }),
  ]);
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [200, 400]);
});

test('6A login, reset and About pages document the safe reset flow and required credits', async () => {
  const login = readFileSync(path.join(__dirname, '../public/login.html'), 'utf8');
  const about = readFileSync(path.join(__dirname, '../public/about.html'), 'utf8');
  const reset = readFileSync(path.join(__dirname, '../public/forgot-password.html'), 'utf8');
  const resetPage = readFileSync(path.join(__dirname, '../public/reset-password.html'), 'utf8');
  const app = readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert.match(login, /href="\/forgot-password\.html"[^>]*>Forgot password\?/);
  assert.match(reset, /id="forgot-password-form"/);
  assert.match(resetPage, /id="reset-password-form"/);
  assert.match(about, /Blueprint Arcade is for architecture and build-game players/);
  for (const credit of [
    'FroggyHopz', 'Game Director, Welcome to Bloxburg',
    'Phil / City Planner Plays', 'Professional urban planner',
    'James Turner / The Sim Supply', 'EA-commissioned Sims builder',
    'Simone', 'UX / full-stack product designer',
  ]) assert.ok(about.includes(credit), `About page is missing ${credit}`);
  assert.match(about, /does not have an email delivery service/i);
  assert.match(about, /workflow logs/i);
  assert.match(about, /production email delivery must be configured/i);
  assert.match(app, /href = '\/about\.html'/);
  assert.match(app, /href = '\/notifications\.html'/);
  assert.match(app, /\/api\/notifications\/unread-count/);
  for (const html of [login, about, reset, resetPage]) {
    assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
  }
});
