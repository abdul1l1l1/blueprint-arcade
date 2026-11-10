require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const sharp = require('sharp');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { createApp } = require('../server');
const { validateImage } = require('../db/image-storage');
const { imagePath, maxBytes, uploadId } = require('../public/js/upload-path');
const schema = `qa_upload_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
let database, server, base, owner, other, gameId;
let failUpload = false;
let finalized = 0;
const fakeStorage = {
  privatePrefix: () => '/qa-bucket/private',
  signUpload: async () => 'https://storage.example.test/signed-put',
  async finalize() {
    if (failUpload) throw Object.assign(new Error('Invalid image bytes.'), { imageValidation: true });
    finalized++;
  },
  serve(row, res) { res.type('webp').send('validated-image'); },
};
async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const upload = (body = {}, actor = owner) => request('/api/uploads/request-url', {
  method: 'POST', cookie: actor?.cookie,
  body: { size: 200, contentType: 'image/png', publicConsent: true, ...body },
});
const complete = (id, actor = owner) => request(`/api/uploads/${id}/complete`, { method: 'POST', cookie: actor?.cookie, body: {} });
const buildPayload = images => ({
  title: 'Upload QA', game_id: gameId, description: 'Preserved description',
  image_urls: images, budget_tier: 'starter', build_type: 'freeform', tags: [], is_pinned: false,
});
before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  gameId = (await database.query(`INSERT INTO games(slug,name,genre) VALUES ('upload-qa','Upload QA','building') RETURNING id`)).rows[0].id;
  server = createApp({ database, env: { SESSION_SECRET: randomBytes(32).toString('hex') }, imageStorage: fakeStorage }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  for (const username of ['upload_owner', 'upload_other']) {
    const result = await request('/api/auth/register', { method: 'POST', body: { username, email: `${username}@example.test`, password } });
    assert.equal(result.status, 201);
    if (!owner) owner = result; else other = result;
  }
});
after(async () => {
  if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('uploads require the existing session, JSON, same-site request, consent and valid metadata', async () => {
  assert.equal((await upload({}, null)).status, 401);
  for (const body of [{ publicConsent: false }, { publicConsent: 'true' }, { size: maxBytes + 1 }, { size: 0 },
    { size: 1.2 }, { size: '20' }, { contentType: 'image/svg+xml' }, { contentType: 'text/html' }]) {
    assert.equal((await upload(body)).status, 400);
  }
  assert.equal((await request('/api/uploads/request-url', {
    method: 'POST', cookie: owner.cookie, headers: { 'Sec-Fetch-Site': 'cross-site' }, body: {},
  })).status, 403);
});

test('only uploader can complete; unready/unknown/non-owner images cannot be attached or read', async () => {
  const result = await upload();
  assert.equal(result.status, 201);
  assert.equal(result.data.uploadURL, 'https://storage.example.test/signed-put');
  assert.equal(result.data.object_key, undefined);
  const id = result.data.id;
  const path = imagePath(id);
  assert.equal((await request(path)).status, 404);
  assert.equal((await request(path, { cookie: owner.cookie })).status, 404);
  assert.equal((await complete(id, null)).status, 401);
  assert.equal((await complete(id, other)).status, 403);
  assert.equal((await complete(randomUUID())).status, 404);
  assert.equal((await complete('bad')).status, 400);
  assert.equal((await request('/api/builds', { method: 'POST', cookie: owner.cookie, body: buildPayload([path]) })).status, 403);
  failUpload = true;
  assert.equal((await complete(id)).status, 400);
  assert.equal((await database.query('SELECT ready FROM image_uploads WHERE id=$1', [id])).rows[0].ready, false);
  failUpload = false;
  const done = await complete(id);
  assert.equal(done.status, 200);
  assert.equal(done.data.imageUrl, path);
  const beforeCount = finalized;
  assert.equal((await complete(id)).status, 200);
  assert.equal(finalized, beforeCount, 'Completion is idempotent.');
  assert.equal((await request(path, { cookie: owner.cookie })).status, 200);
  assert.equal((await request(path, { cookie: other.cookie })).status, 404);
  assert.equal((await request('/api/builds', { method: 'POST', cookie: other.cookie,
    body: { ...buildPayload([path]), owner_id: owner.data.user.id } })).status, 403);
  assert.equal((await request('/api/builds', { method: 'POST', cookie: owner.cookie, body: buildPayload([imagePath(randomUUID())]) })).status, 403);
});

test('uploaded cover + external URLs survive save/edit/restart; owner-only edit/delete revoke public serving', async () => {
  const { data: { id } } = await upload();
  const path = (await complete(id)).data.imageUrl;
  const images = [path, 'https://example.test/second.jpg'];
  const saved = await request('/api/builds', { method: 'POST', cookie: owner.cookie, body: buildPayload(images) });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.data.build.image_urls, images);
  const buildId = saved.data.build.id;
  assert.equal((await request(path)).status, 200);
  assert.deepEqual((await request(`/api/builds/${buildId}`)).data.build.image_urls, images);
  assert.equal((await request(`/api/builds/${buildId}`, { method: 'PUT', cookie: other.cookie, body: buildPayload([]) })).status, 403);
  assert.equal((await request(`/api/builds/${buildId}`, { method: 'DELETE', cookie: other.cookie })).status, 403);
  const edited = await request(`/api/builds/${buildId}`, { method: 'PUT', cookie: owner.cookie, body: buildPayload(images.toReversed()) });
  assert.deepEqual(edited.data.build.image_urls, images.toReversed());
  await request(`/api/builds/${buildId}`, { method: 'PUT', cookie: owner.cookie, body: buildPayload([]) });
  assert.equal((await request(path)).status, 404);
  await request(`/api/builds/${buildId}`, { method: 'PUT', cookie: owner.cookie, body: buildPayload(images) });
  server.closeIdleConnections();
  await new Promise(resolve => server.close(resolve));
  server = createApp({ database, env: { SESSION_SECRET: randomBytes(32).toString('hex') }, imageStorage: fakeStorage }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await request(path)).status, 200);
  assert.deepEqual((await request(`/api/builds/${buildId}`)).data.build.image_urls, images);
  // Reauthenticate after restarting with a deliberately new test session secret.
  owner = await request('/api/auth/login', { method: 'POST', body: { username: 'upload_owner', password } });
  assert.equal((await request(`/api/builds/${buildId}`, { method: 'DELETE', cookie: owner.cookie })).status, 200);
  assert.equal((await request(path)).status, 404);
});

test('expiry, rate limit, traversal and unknown media paths are rejected', async () => {
  const { data: { id } } = await upload();
  await database.query("UPDATE image_uploads SET created_at=now()-interval '16 minutes' WHERE id=$1", [id]);
  assert.equal((await complete(id)).status, 410);
  assert.equal(uploadId('/media/uploads/../secret.webp'), null);
  assert.equal(uploadId('/media/uploads/x.webp?path=/secret'), null);
  assert.equal((await request('/media/uploads/not-an-id.webp')).status, 404);
  assert.equal((await request('/media/private/unknown')).status, 404);
  for (let i = 0; i < 35; i++) {
    if ((await upload()).status === 429) return;
  }
  assert.fail('Expected per-owner hourly upload limit');
});

test('real image decoder rejects scripts, corrupt, mismatched, oversized and excessive-pixel files', async () => {
  for (const type of ['jpeg', 'png', 'webp']) {
    const bytes = await sharp({ create: { width: 30, height: 20, channels: 3, background: '#89cff0' } }).toFormat(type).toBuffer();
    const output = await validateImage(bytes, `image/${type}`);
    const meta = await sharp(output).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 30);
    assert.equal(meta.exif, undefined);
  }
  const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
  for (const [bytes, type] of [
    [Buffer.from('<svg onload="alert(1)"/>'), 'image/png'],
    [Buffer.from('<html>not an image</html>'), 'image/jpeg'],
    [png, 'image/jpeg'], [png.subarray(0, 30), 'image/png'],
    [Buffer.alloc(maxBytes + 1), 'image/png'],
  ]) await assert.rejects(validateImage(bytes, type), error => error.imageValidation);
  const huge = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: 'red' } }).png().toBuffer();
  await assert.rejects(validateImage(huge, 'image/png'), error => error.imageValidation);
});
