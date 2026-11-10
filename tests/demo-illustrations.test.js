require('dotenv').config();
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { once } = require('node:events');
const express = require('express');
const { Pool } = require('pg');
const { pool } = require('../db/pool');
const { initialize } = require('../db/init');
const { seedDatabase } = require('../db/seed');
const { addDemoIllustrations } = require('../db/add-demo-illustrations');
const { createApprovedAssetsRouter } = require('../routes/approved-assets');
const { entries, isApprovedUrl } = require('../public/js/approved-images');
const { validateBuild } = require('../routes/build-data');
const content = require('../db/content');
let database;
let schema;
const verifyAssets = async () => {};
const snapshot = async () => (await database.query('SELECT * FROM builds ORDER BY id')).rows;
const withoutImages = rows => rows.map(({ image_urls, ...row }) => row);
before(async () => {
  assert.notEqual(process.env.NODE_ENV, 'production');
  schema = `qa_demo_images_${randomUUID().replaceAll('-', '')}`;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  database = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
  await initialize(database);
  await seedDatabase(database, randomBytes(24).toString('base64url'));
});
after(async () => {
  await database?.end();
  try {
    // Only this run's generated schema; never public QA or other fixtures.
    if (schema && /^qa_demo_images_[a-f0-9]{32}$/.test(schema)) {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
  } finally { await pool.end(); }
});

test('demo mapping covers precisely the original ten identities, not Construction Site', () => {
  assert.equal(entries.length, 10);
  assert.deepEqual(entries.map(({ title, owner, game }) => ({ title, owner, game })),
    content.builds.map(({ title, owner, game }) => ({ title, owner, game })));
  for (const entry of entries) {
    assert.equal(isApprovedUrl(entry.path), true);
    for (const value of [entry.path + '?x=1', entry.path + '#x', '//evil.test/a.jpg', '/media/other.jpg', '/media/builds/construction-site-c40bfeba.png']) {
      assert.equal(isApprovedUrl(value), false);
    }
  }
});

test('dry run changes nothing; apply fills only empty images; repeat and original seed verification are unchanged', async () => {
  const before = await snapshot();
  const relatedBefore = {};
  for (const table of ['users', 'profiles', 'games', 'game_tags', 'build_tags', 'ratings', 'likes', 'comments', 'favorites']) {
    relatedBefore[table] = (await database.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows;
  }
  assert.equal((await addDemoIllustrations(database)).pending, 10);
  assert.deepEqual(await snapshot(), before);
  assert.equal((await addDemoIllustrations(database, { apply: true, verifyAssets })).changed, 10);
  const filled = await snapshot();
  assert.deepEqual(withoutImages(filled), withoutImages(before));
  for (const row of filled) assert.deepEqual(row.image_urls, [entries.find(e => e.title === row.title).path]);
  assert.equal((await addDemoIllustrations(database, { apply: true, verifyAssets })).changed, 0);
  assert.equal((await seedDatabase(database, randomBytes(24).toString('base64url'))).status, 'verified');
  assert.deepEqual(await snapshot(), filled);
  for (const table of Object.keys(relatedBefore)) {
    assert.deepEqual((await database.query(`SELECT row_to_json(t) AS row FROM ${table} t ORDER BY row_to_json(t)::text`)).rows, relatedBefore[table]);
  }
});

test('image conflict, missing identity, duplicate identity, and failed storage verification never commit partial changes', async () => {
  const original = await snapshot();
  const target = original.find(row => row.title === entries[9].title);
  const first = original.find(row => row.title === entries[0].title);
  await database.query('UPDATE builds SET image_urls=$1 WHERE id=$2', [[], first.id]);
  await database.query('UPDATE builds SET image_urls=$1 WHERE id=$2', [['https://example.test/owner-image.jpg'], target.id]);
  const conflict = await snapshot();
  await assert.rejects(addDemoIllustrations(database, { apply: true, verifyAssets }), /Image conflict/);
  assert.deepEqual(await snapshot(), conflict);
  await database.query('UPDATE builds SET image_urls=$1, title=$2 WHERE id=$3', [target.image_urls, 'Owner renamed demo', target.id]);
  const missing = await snapshot();
  await assert.rejects(addDemoIllustrations(database, { apply: true, verifyAssets }), /Missing or ambiguous/);
  assert.deepEqual(await snapshot(), missing);
  await database.query('UPDATE builds SET title=$1 WHERE id=$2', [target.title, target.id]);
  const inserted = await database.query(
    `INSERT INTO builds (owner_id,game_id,title,description,budget_tier,build_type)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [target.owner_id, target.game_id, target.title, target.description, target.budget_tier, target.build_type]);
  const duplicate = await snapshot();
  await assert.rejects(addDemoIllustrations(database, { apply: true, verifyAssets }), /Missing or ambiguous/);
  assert.deepEqual(await snapshot(), duplicate);
  // Retain isolated fixture data rather than delete it.
  await database.query('UPDATE builds SET title=$1 WHERE id=$2', ['Duplicate fixture retained', inserted.rows[0].id]);
  const beforeFailedAssets = await snapshot();
  await assert.rejects(addDemoIllustrations(database, {
    apply: true, verifyAssets: async () => { throw new Error('Storage verification failed'); },
  }), /Storage verification failed/);
  assert.deepEqual(await snapshot(), beforeFailedAssets);
});

test('concurrent empty-image guard failure rolls back instead of silently succeeding', async () => {
  const calls = [];
  let index = 0;
  let released = false;
  const database = { connect: async () => ({
    query: async sql => {
      calls.push(sql);
      if (sql.startsWith('SELECT b.id')) return { rows: [{ id: String(index++), image_urls: [] }] };
      if (sql.startsWith('UPDATE')) return { rowCount: 0 };
      return { rows: [] };
    },
    release() { released = true; },
  }) };
  await assert.rejects(addDemoIllustrations(database, { apply: true, verifyAssets }), /Concurrent image change/);
  assert.equal(calls.at(-1), 'ROLLBACK');
  assert.equal(calls.includes('COMMIT'), false);
  assert.equal(released, true);
});

test('only approved local illustrations round-trip build edit validation; unsafe URLs stay rejected', async () => {
  const client = { query: async sql => ({ rows: sql.includes('game_tags') ? [] : [{ id: 1 }] }) };
  const body = { title: 'Demo', game_id: 1, budget_tier: 'starter', build_type: 'freeform', image_urls: entries.map(e => e.path) };
  assert.deepEqual((await validateBuild(client, body)).image_urls, body.image_urls);
  for (const value of ['/media/other.jpg', entries[0].path + '?x=1', 'javascript:alert(1)', 'https://name:secret@example.test/a.jpg']) {
    await assert.rejects(validateBuild(client, { ...body, image_urls: [value] }), error => error.status === 400);
  }
});

test('fixed asset routes serve all ten JPGs, hide storage failures, and reject unapproved paths', async () => {
  for (const fails of [false, true]) {
    const app = express();
    const bytes = Buffer.from([255, 216, 255, 217]);
    app.use(createApprovedAssetsRouter({ load: async () => {
      if (fails) throw new Error('Internal storage details');
      return bytes;
    } }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      for (const entry of entries) {
        const response = await fetch(base + entry.path);
        assert.equal(response.status, fails ? 503 : 200);
        if (fails) {
          assert.equal(response.headers.get('cache-control'), 'no-store');
          assert.doesNotMatch(await response.text(), /Internal storage/);
        } else {
          assert.match(response.headers.get('content-type'), /image\/jpeg/);
          assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
        }
      }
      assert.equal((await fetch(base + '/media/demo-illustrations/unknown.jpg')).status, 404);
      const construction = await fetch(base + '/media/builds/construction-site-c40bfeba.png');
      assert.equal(construction.status, fails ? 503 : 200);
      if (!fails) assert.match(construction.headers.get('content-type'), /image\/png/);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});
