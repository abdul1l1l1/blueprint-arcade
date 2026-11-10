const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { createApprovedAssetsRouter, COVER_PATH } = require('../routes/approved-assets');
const { validateBuild } = require('../routes/build-data');
const { addConstructionSite } = require('../db/add-construction-site');

test('Approved cover serves PNG bytes; storage errors stay safe and non-cacheable', async () => {
  for (const fails of [false, true]) {
    const app = express();
    const bytes = Buffer.from([137, 80, 78, 71]);
    app.use(createApprovedAssetsRouter({ load: async () => {
      if (fails) throw new Error('private storage error');
      return bytes;
    } }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const response = await fetch(base + COVER_PATH);
      assert.equal(response.status, fails ? 503 : 200);
      if (fails) {
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.doesNotMatch(await response.text(), /private storage error/);
      } else {
        assert.match(response.headers.get('content-type'), /image\/png/);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      }
      assert.equal((await fetch(base + '/media/builds/other.png')).status, 404);
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  }
});

test('Only approved local image accepted; arbitrary paths and credential URLs rejected', async () => {
  const client = { query: async sql => ({ rows: sql.includes('game_tags') ? [] : [{ id: 1 }] }) };
  const body = { title: 'Construction Site', game_id: 1, budget_tier: 'starter', build_type: 'freeform', image_urls: [COVER_PATH] };
  assert.deepEqual((await validateBuild(client, body)).image_urls, [COVER_PATH]);
  for (const image of ['/private.png', '//evil.test/a.png', COVER_PATH + '?x=1', 'javascript:alert(1)', 'https://user:pass@example.test/a.png']) {
    await assert.rejects(validateBuild(client, { ...body, image_urls: [image] }), error => error.status === 400);
  }
});

test('Content import is additive, idempotent, and rolls back missing prerequisites', async () => {
  for (const mode of ['new', 'existing', 'missing']) {
    const calls = [];
    let released = false;
    const database = { connect: async () => ({
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.startsWith('SELECT id FROM users')) return { rows: mode === 'missing' ? [] : [{ id: 'owner' }] };
        if (sql.startsWith('SELECT id FROM games')) return { rows: [{ id: 1 }] };
        if (sql.startsWith('SELECT id FROM builds')) return { rows: mode === 'existing' ? [{ id: 'existing' }] : [] };
        if (sql.startsWith('INSERT')) return { rows: [{ id: 'new' }] };
        return { rows: [] };
      },
      release() { released = true; },
    }) };
    if (mode === 'missing') {
      await assert.rejects(addConstructionSite(database), /required/);
      assert.ok(calls.some(call => call.sql === 'ROLLBACK'));
    } else {
      assert.equal((await addConstructionSite(database)).status, mode === 'new' ? 'added' : 'unchanged');
      assert.equal(calls.filter(call => call.sql.startsWith('INSERT')).length, mode === 'new' ? 1 : 0);
    }
    assert.equal(calls.some(call => /\b(UPDATE|DELETE|TRUNCATE)\b/.test(call.sql.replace('FOR UPDATE', ''))), false);
    assert.ok(released);
  }
});
