// Phase 5C account deletion and private uploaded-image checks use an isolated QA schema.
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

const schema = `qa_p5c_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('hex');
let database, server, base, owner, other, ownerBuild, otherBuild;
const deletedObjects = [];
const imageStorage = {
  serve(_row, res) {
    res.type('webp').set('X-Content-Type-Options', 'nosniff').send(Buffer.from('qa-image'));
  },
  async deleteObjects(rows) {
    deletedObjects.push(...rows.flatMap(row => [row.staging_key, row.object_key]));
  },
};

async function start() {
  const listener = createApp({
    database,
    env: { SESSION_SECRET: secret },
    storage: imageStorage,
  }).listen(0, '127.0.0.1');
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

function imagePath(id) {
  return `/media/uploads/${id}.webp`;
}

async function addUpload(id, userId, { ready = true, recent = false } = {}) {
  await database.query(
    `INSERT INTO image_uploads
      (id,owner_id,staging_key,object_key,expected_size,content_type,public_consent,ready,created_at)
     VALUES ($1,$2,$3,$4,10,'image/webp',true,$5,
       CASE WHEN $6 THEN now() ELSE now() - interval '11 minutes' END)`,
    [id, userId, `/qa/staging/${id}`, `/qa/build-images/${id}.webp`, ready, recent],
  );
}

async function addBuild(user, title, imageUrls = []) {
  const { rows: [build] } = await database.query(
    `INSERT INTO builds (owner_id,game_id,title,description,image_urls,budget_tier,build_type)
     VALUES ($1,1,$2,'QA settings build',$3,'mid','freeform') RETURNING id`,
    [user.user.id, title, imageUrls],
  );
  return build;
}

async function register(username, email) {
  const response = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email, password, displayName: username },
  });
  assert.equal(response.status, 201);
  return { user: response.data.user, cookie: response.cookie };
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Phase 5C tests must run in QA.');
  assert.ok(process.env.DATABASE_URL, 'QA database is required.');
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  await initialize(database);
  await seedDatabase(database, randomBytes(24).toString('base64url'));
  ({ server, base } = await start());

  owner = await register('SettingsOwner', 'settings-owner@example.test');
  other = await register('SettingsOther', 'settings-other@example.test');
  const ownerImage = randomUUID();
  const ownerPrivateImage = randomUUID();
  const ownerUnreadyImage = randomUUID();
  const otherImage = randomUUID();
  await addUpload(ownerImage, owner.user.id);
  await addUpload(ownerPrivateImage, owner.user.id);
  await addUpload(ownerUnreadyImage, owner.user.id, { ready: false });
  await addUpload(otherImage, other.user.id);
  ownerBuild = await addBuild(owner, 'Settings owner build', [imagePath(ownerImage)]);
  otherBuild = await addBuild(other, 'Settings other build', [imagePath(otherImage)]);
  owner.imageUrl = imagePath(ownerImage);
  owner.privateImageUrl = imagePath(ownerPrivateImage);
  owner.unreadyImageUrl = imagePath(ownerUnreadyImage);
  owner.uploadIds = [ownerImage, ownerPrivateImage, ownerUnreadyImage];
  other.imageUrl = imagePath(otherImage);

  await database.query(
    'INSERT INTO comments (build_id,user_id,body) VALUES ($1,$2,$3),($4,$5,$6)',
    [otherBuild.id, owner.user.id, 'Owner comment on another build', ownerBuild.id, other.user.id, 'Other comment on owner build'],
  );
  await database.query(
    'INSERT INTO ratings (build_id,user_id,stars) VALUES ($1,$2,4),($3,$4,3)',
    [otherBuild.id, owner.user.id, ownerBuild.id, other.user.id],
  );
  await database.query(
    'INSERT INTO likes (build_id,user_id) VALUES ($1,$2),($3,$4)',
    [otherBuild.id, owner.user.id, ownerBuild.id, other.user.id],
  );
  await database.query(
    'INSERT INTO favorites (build_id,user_id) VALUES ($1,$2),($3,$4)',
    [otherBuild.id, owner.user.id, ownerBuild.id, other.user.id],
  );
});

after(async () => {
  if (server?.listening) await close(server);
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('5C. validated uploaded images load only when owner-previewed or attached to a saved build', async () => {
  const publicImage = await request(owner.imageUrl);
  assert.equal(publicImage.status, 200);
  assert.match(publicImage.headers.get('content-type'), /image\/webp/);
  assert.equal(publicImage.headers.get('cache-control'), 'private, no-store');
  assert.equal(publicImage.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(publicImage.text, 'qa-image');

  assert.equal((await request(owner.privateImageUrl)).status, 404);
  assert.equal((await request(owner.privateImageUrl, { cookie: owner.cookie })).status, 200);
  assert.equal((await request(owner.privateImageUrl, { cookie: other.cookie })).status, 404);
  assert.equal((await request(owner.unreadyImageUrl, { cookie: owner.cookie })).status, 404);
  assert.equal((await request('/media/uploads/not-an-image.webp')).status, 404);
});

test('5C. uploaded image paths can only be attached by their owner', async () => {
  const payload = {
    title: 'Foreign image attempt',
    game_id: 1,
    description: '',
    image_urls: [owner.imageUrl],
    budget_tier: 'mid',
    build_type: 'freeform',
    tags: [],
  };
  const rejected = await request('/api/builds', { method: 'POST', cookie: other.cookie, body: payload });
  assert.equal(rejected.status, 403);
  assert.match(rejected.data.errors.image_urls, /your own/);

  const accepted = await request('/api/builds', { method: 'POST', cookie: owner.cookie, body: payload });
  assert.equal(accepted.status, 201);
  assert.deepEqual(accepted.data.build.image_urls, [owner.imageUrl]);
});

test('5C. account deletion requires login, password, typed confirmation, and no shared owned images', async () => {
  assert.equal((await request('/api/auth/me', { method: 'DELETE', body: { password, confirmation: 'DELETE' } })).status, 401);
  assert.equal((await request('/api/auth/me', {
    method: 'DELETE',
    cookie: owner.cookie,
    body: { password },
  })).status, 400);
  assert.equal((await request('/api/auth/me', {
    method: 'DELETE',
    cookie: owner.cookie,
    body: { password: 'incorrect-password', confirmation: 'DELETE' },
  })).status, 401);
  assert.deepEqual(deletedObjects, []);

  const recentUploadId = randomUUID();
  await addUpload(recentUploadId, owner.user.id, { recent: true });
  const activeTransfer = await request('/api/auth/me', {
    method: 'DELETE',
    cookie: owner.cookie,
    body: { password, confirmation: 'DELETE' },
  });
  assert.equal(activeTransfer.status, 409);
  assert.match(activeTransfer.data.errors._general, /wait 11 minutes/i);
  assert.deepEqual(deletedObjects, []);
  await database.query('DELETE FROM image_uploads WHERE id=$1', [recentUploadId]);

  await database.query('UPDATE builds SET image_urls=array_append(image_urls,$1) WHERE id=$2', [owner.imageUrl, otherBuild.id]);
  const shared = await request('/api/auth/me', {
    method: 'DELETE',
    cookie: owner.cookie,
    body: { password, confirmation: 'DELETE' },
  });
  assert.equal(shared.status, 409);
  assert.equal((await database.query('SELECT id FROM users WHERE id=$1', [owner.user.id])).rows.length, 1);
  assert.deepEqual(deletedObjects, []);
  await database.query('UPDATE builds SET image_urls=array_remove(image_urls,$1) WHERE id=$2', [owner.imageUrl, otherBuild.id]);
});

test('5C. confirmed account deletion removes only the session owner and their data', async () => {
  const secondOwnerSession = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'SettingsOwner', password },
  });
  assert.equal(secondOwnerSession.status, 200);
  const result = await request('/api/auth/me?userId=' + encodeURIComponent(other.user.id), {
    method: 'DELETE',
    cookie: owner.cookie,
    body: { password, confirmation: 'DELETE' },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { deleted: true });
  assert.match(result.headers.get('set-cookie') || '', /Expires=Thu, 01 Jan 1970/i);

  assert.equal((await database.query('SELECT id FROM users WHERE id=$1', [owner.user.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM users WHERE id=$1', [other.user.id])).rows.length, 1);
  assert.equal((await database.query('SELECT user_id FROM profiles WHERE user_id=$1', [owner.user.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM builds WHERE id=$1', [ownerBuild.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM builds WHERE id=$1', [otherBuild.id])).rows.length, 1);
  assert.equal((await database.query('SELECT id FROM comments WHERE user_id=$1 OR build_id=$2', [owner.user.id, ownerBuild.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM ratings WHERE user_id=$1 OR build_id=$2', [owner.user.id, ownerBuild.id])).rows.length, 0);
  assert.equal((await database.query('SELECT user_id FROM likes WHERE user_id=$1 OR build_id=$2', [owner.user.id, ownerBuild.id])).rows.length, 0);
  assert.equal((await database.query('SELECT user_id FROM favorites WHERE user_id=$1 OR build_id=$2', [owner.user.id, ownerBuild.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM image_uploads WHERE owner_id=$1', [owner.user.id])).rows.length, 0);
  assert.equal((await database.query('SELECT id FROM image_uploads WHERE owner_id=$1', [other.user.id])).rows.length, 1);
  assert.equal((await database.query(`SELECT count(*)::int AS n FROM "session" WHERE sess->>'userId'=$1`, [owner.user.id])).rows[0].n, 0);
  assert.equal((await database.query(`SELECT count(*)::int AS n FROM "session" WHERE sess->>'userId'=$1`, [other.user.id])).rows[0].n, 1);
  const expectedObjects = new Set(owner.uploadIds.flatMap(id => [
    `/qa/staging/${id}`,
    `/qa/build-images/${id}.webp`,
  ]));
  assert.deepEqual(new Set(deletedObjects), expectedObjects);
  assert.equal((await request('/api/auth/me', { cookie: secondOwnerSession.cookie })).data.user, null);
  assert.equal((await request(owner.imageUrl)).status, 404);
});

test('5C. Settings asks for a second confirmation before sending deletion', async () => {
  const source = readFileSync(path.join(__dirname, '../public/js/settings.js'), 'utf8');
  const elements = new Map();
  const handlers = {};
  let apiCalls = 0;
  let confirmMessage = '';
  const element = () => ({
    hidden: true,
    disabled: false,
    value: '',
    textContent: '',
    href: '',
    replaceChildren() {},
    append() {},
    focus() {},
    addEventListener(event, callback) { handlers[`element:${event}`] = callback; },
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    addEventListener(event, callback) { handlers[event] = callback; },
  };
  const context = {
    document,
    getMe: async () => ({ user: { id: 'owner', username: 'SettingsOwner' } }),
    api: async () => { apiCalls += 1; return { deleted: true }; },
    window: { confirm(message) { confirmMessage = message; return false; } },
    BuildsUI: {
      node(_tag, _className, text) { return { textContent: text, append() {}, setAttribute() {} }; },
      statePanel() {},
      apiMessage() { return 'Request failed.'; },
    },
  };
  vm.runInNewContext(source, context);
  await handlers.DOMContentLoaded();
  elements.get('delete-account-password').value = 'current-password';
  elements.get('delete-account-confirmation').value = 'DELETE';
  await handlers['element:submit']({ preventDefault() {} });
  assert.equal(elements.get('settings-content').hidden, false);
  assert.match(confirmMessage, /cannot be undone/i);
  assert.equal(apiCalls, 0);
});
