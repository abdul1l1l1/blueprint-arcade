require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { createApp } = require('../server');
const { imagePath, maxBytes } = require('../public/js/upload-path');

const schema = `qa_phase6b_${randomUUID().replaceAll('-', '')}`;
const password = randomBytes(24).toString('base64url');
const storage = {
  privatePrefix: () => '/qa/private',
  signUpload: async () => 'https://storage.example.test/signed-put',
  async finalize() {},
  serve(_row, res) { res.type('webp').send(Buffer.from('validated-avatar')); },
};
let database;
let server;
let base;
let gameId;
let owner;
let other;
let viewer;
let admin;
let ownerBuilds = [];
let otherBuilds = [];

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

async function register(username) {
  const result = await request('/api/auth/register', {
    method: 'POST',
    body: { username, email: `${username}@example.test`, password },
  });
  assert.equal(result.status, 201);
  return result;
}

async function addBuild(actor, index) {
  const result = await request('/api/builds', {
    method: 'POST',
    cookie: actor.cookie,
    body: {
      title: `${actor.data.user.username} build ${index}`,
      game_id: gameId,
      description: `Pagination build ${index}`,
      image_urls: [],
      budget_tier: 'starter',
      build_type: 'freeform',
      tags: [],
      is_pinned: false,
    },
  });
  assert.equal(result.status, 201);
  return result.data.build;
}

before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  gameId = (await database.query(
    `INSERT INTO games(slug,name,genre) VALUES ('phase6b-qa','Phase 6B QA','building') RETURNING id`,
  )).rows[0].id;
  server = createApp({ database, env: { SESSION_SECRET: randomBytes(32).toString('hex') }, storage })
    .listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
  owner = await register('phase6b_owner');
  other = await register('phase6b_other');
  viewer = await register('phase6b_viewer');
  admin = await register('phase6b_admin');
  await database.query("UPDATE users SET role='admin' WHERE id=$1", [admin.data.user.id]);
  admin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'phase6b_admin', password },
  });
  assert.equal(admin.status, 200);
  for (let i = 1; i <= 13; i += 1) {
    ownerBuilds.push(await addBuild(owner, i));
    otherBuilds.push(await addBuild(other, i));
  }
});

after(async () => {
  if (server) { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); }
  await database?.end();
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test('follows reject signed-out, self and duplicate requests; counts and followed feed are accurate', async () => {
  assert.equal((await request('/api/follows/phase6b_owner', { method: 'POST' })).status, 401);
  assert.equal((await request('/api/follows/phase6b_viewer', { method: 'POST', cookie: viewer.cookie })).status, 400);
  assert.equal((await request('/api/follows/phase6b_owner', { method: 'POST', cookie: viewer.cookie })).status, 201);
  assert.equal((await request('/api/follows/phase6b_owner', { method: 'POST', cookie: viewer.cookie })).status, 409);

  const profile = await request('/api/stats/profile/phase6b_owner', { cookie: viewer.cookie });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.profile.follower_count, 1);
  assert.equal(profile.data.profile.is_following, true);
  const viewerProfile = await request('/api/stats/profile/phase6b_viewer', { cookie: viewer.cookie });
  assert.equal(viewerProfile.data.profile.following_count, 1);

  const feed = await request('/api/builds?following=1', { cookie: viewer.cookie });
  assert.equal(feed.status, 200);
  assert.ok(feed.data.builds.length > 0);
  assert.ok(feed.data.builds.every(build => build.owner_id === owner.data.user.id));
  assert.equal((await request('/api/builds?following=1')).status, 401);

  const unfollow = await request('/api/follows/phase6b_owner', { method: 'DELETE', cookie: viewer.cookie });
  assert.equal(unfollow.status, 200);
  assert.equal(unfollow.data.following, false);
  assert.equal(unfollow.data.follower_count, 0);
});

test('showcase pages contain 12 items without gaps and preserve mixed original/repost order', async () => {
  for (const build of otherBuilds) {
    const result = await request(`/api/social/builds/${build.id}/repost`, { method: 'POST', cookie: viewer.cookie });
    assert.equal(result.status, 200);
    assert.equal(result.data.reposted, true);
  }
  const pages = [];
  let offset = 0;
  let page;
  do {
    page = await request(`/api/builds?offset=${offset}`);
    assert.equal(page.status, 200);
    assert.ok(page.data.builds.length <= 12);
    pages.push(...page.data.builds.map(build => `${build.id}:${build.is_repost ? build.reposted_by_id : 'original'}`));
    offset = page.data.page.next_offset ?? offset + page.data.builds.length;
  } while (page.data.page.has_more);
  assert.equal(pages.length, 39);
  assert.equal(new Set(pages).size, pages.length);
  assert.equal((await request('/api/builds?offset=1')).status, 400);
  const firstPageAgain = await request('/api/builds?offset=0');
  assert.deepEqual(
    firstPageAgain.data.builds.map(build => `${build.id}:${build.is_repost ? build.reposted_by_id : 'original'}`),
    pages.slice(0, 12),
  );

  const firstProfilePage = await request('/api/stats/profile/phase6b_owner');
  assert.equal(firstProfilePage.data.builds.length, 12);
  assert.equal(firstProfilePage.data.page.builds.has_more, true);
  const nextBuilds = await request('/api/stats/profile/phase6b_owner?list=builds&offset=12');
  assert.equal(nextBuilds.data.builds.length, 1);
  assert.equal(nextBuilds.data.page.builds.has_more, false);

  const firstRepostPage = await request('/api/stats/profile/phase6b_viewer');
  assert.equal(firstRepostPage.data.reposts.length, 12);
  assert.equal(firstRepostPage.data.page.reposts.has_more, true);
  const nextReposts = await request('/api/stats/profile/phase6b_viewer?list=reposts&offset=12');
  assert.equal(nextReposts.data.reposts.length, 1);
  assert.equal(nextReposts.data.page.reposts.has_more, false);
  assert.equal((await request('/api/stats/profile/phase6b_owner?list=builds&offset=1')).status, 400);
});

test('build and comment reports are private, reject owners, and appear only for admins', async () => {
  const ownBuildReport = await request(`/api/reports/builds/${ownerBuilds[0].id}`, {
    method: 'POST', cookie: owner.cookie, body: { reason: 'Own build' },
  });
  assert.equal(ownBuildReport.status, 403);
  assert.equal((await request(`/api/reports/builds/${ownerBuilds[0].id}`, {
    method: 'POST', body: { reason: 'Signed out' },
  })).status, 401);

  const buildReport = await request(`/api/reports/builds/${ownerBuilds[0].id}`, {
    method: 'POST', cookie: viewer.cookie, body: { reason: 'Please review this build.' },
  });
  assert.equal(buildReport.status, 201);
  const comment = await request(`/api/social/builds/${ownerBuilds[0].id}/comments`, {
    method: 'POST', cookie: other.cookie, body: { body: 'QA comment to report' },
  });
  assert.equal(comment.status, 201);
  assert.equal((await request(`/api/reports/comments/${comment.data.comment.id}`, {
    method: 'POST', cookie: other.cookie, body: { reason: 'Own comment' },
  })).status, 403);
  assert.equal((await request(`/api/reports/comments/${comment.data.comment.id}`, {
    method: 'POST', cookie: viewer.cookie, body: { reason: 'Please review this comment.' },
  })).status, 201);
  assert.equal((await request(`/api/reports/builds/${ownerBuilds[1].id}`, {
    method: 'POST', cookie: viewer.cookie, body: { reason: '   ' },
  })).status, 400);

  const publicBuild = await request(`/api/builds/${ownerBuilds[0].id}`);
  assert.equal(publicBuild.status, 200);
  assert.equal(JSON.stringify(publicBuild.data).includes('Please review this'), false);
  assert.equal(JSON.stringify(publicBuild.data).includes('reports'), false);
  const publicComments = await request(`/api/social/builds/${ownerBuilds[0].id}/comments`);
  assert.equal(JSON.stringify(publicComments.data).includes('Please review this'), false);
  assert.equal((await request('/api/reports/moderation')).status, 401);
  assert.equal((await request('/api/reports/moderation', { cookie: viewer.cookie })).status, 403);
  const adminReports = await request('/api/reports/moderation', { cookie: admin.cookie });
  assert.equal(adminReports.status, 200);
  assert.equal(adminReports.data.reports.length, 2);
  assert.deepEqual(new Set(adminReports.data.reports.map(report => report.target_type)), new Set(['build', 'comment']));
  assert.equal((await request(`/api/builds/${ownerBuilds[0].id}`)).status, 200);
});

test('avatars enforce upload size and ownership, render as public references, and stay in safe projections', async () => {
  assert.equal((await request('/api/uploads/request-url', {
    method: 'POST',
    cookie: owner.cookie,
    body: { size: maxBytes + 1, contentType: 'image/png', publicConsent: true },
  })).status, 400);

  const ownerImageId = randomUUID();
  const otherImageId = randomUUID();
  const uploadValues = (id, ownerId) => [
    id, ownerId, `/qa/private/build-upload-staging/${id}`, `/qa/private/build-images/${id}.webp`,
    512, 'image/png', true, true,
  ];
  await database.query(
    `INSERT INTO image_uploads (id,owner_id,staging_key,object_key,expected_size,content_type,public_consent,ready)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8),($9,$10,$11,$12,$13,$14,$15,$16)`,
    [...uploadValues(ownerImageId, owner.data.user.id), ...uploadValues(otherImageId, other.data.user.id)],
  );
  const ownerPath = imagePath(ownerImageId);
  assert.equal((await request('/api/profile/avatar', {
    method: 'POST', cookie: other.cookie, body: { imageUrl: ownerPath },
  })).status, 403);
  const saved = await request('/api/profile/avatar', {
    method: 'POST', cookie: owner.cookie, body: { imageUrl: ownerPath },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.avatar_url, ownerPath);
  assert.equal((await request(ownerPath)).status, 200);

  const profile = await request('/api/stats/profile/phase6b_owner');
  assert.equal(profile.data.profile.avatar_url, ownerPath);
  assert.equal(profile.data.builds[0].owner_avatar_url, ownerPath);
  assert.equal(JSON.stringify(profile.data).includes('password_hash'), false);
  assert.equal(JSON.stringify(profile.data).includes('@example.test'), false);
});
