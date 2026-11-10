// Explicit owner-requested QA cleanup. Dry run unless --apply; never a startup hook.
require('dotenv').config();
const assert = require('node:assert/strict');
const { pool } = require('./pool');
const content = require('./content');
const { inspectSeed } = require('./seed');
const schemaPattern = /^(?:qa_p1_[a-f0-9]{12}_(?:auth|incomplete|seedrollback)|qa_p[2-5]_[a-f0-9]{32}|qa_demo_images_[a-f0-9]{32})$/;
const knownAccount = name => ['p3qa_ot63ba', 'p3qa_ot63bb'].includes(name) || /^p5qa_[a-z0-9_]{3,14}$/.test(name);

async function cleanQA(apply = false, database = pool) {
  assert.notEqual(process.env.NODE_ENV, 'production', 'QA only.');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(847216005)');
    assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'heliumdb', 'Unconfirmed QA database.');
    assert.deepEqual((await inspectSeed(client)).missing, [], 'Intended seed must be complete.');
    const users = (await client.query('SELECT id, username, email FROM public.users ORDER BY id FOR UPDATE')).rows;
    const synthetic = users.filter(u => !content.users.some(seed => seed.username === u.username));
    assert.ok(synthetic.every(u => knownAccount(u.username) && /^[^@]+@example\.test$/.test(u.email)), 'Unknown account: stop for review.');
    const seedUserIds = users.filter(u => !synthetic.includes(u)).map(u => u.id);
    const keepBuilds = (await client.query(
      'SELECT b.*, u.username FROM public.builds b JOIN public.users u ON u.id=b.owner_id WHERE owner_id=ANY($1::uuid[]) ORDER BY b.id', [seedUserIds])).rows;
    assert.equal(keepBuilds.length, 11, 'Expected original ten and approved Construction Site.');
    assert.ok(keepBuilds.every(b => content.builds.some(seed => seed.title === b.title && seed.owner === b.username)
      || (b.title === 'Construction Site' && b.username === 'abdul_builds')), 'Unknown content: stop for review.');
    const schemas = (await client.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'qa\\_%' ESCAPE '\\' ORDER BY nspname")).rows.map(r => r.nspname);
    assert.ok(schemas.every(name => schemaPattern.test(name)), 'Unknown QA schema: stop for review.');
    const summary = { database: 'heliumdb', syntheticAccounts: synthetic.map(u => u.username), isolatedSchemas: schemas.length, intendedBuilds: 11, applied: apply };
    if (apply) {
      const ids = synthetic.map(u => u.id);
      // Auth stores userId as a JSON string; no session values are logged.
      await client.query('DELETE FROM public.session WHERE sess->>\'userId\' = ANY($1::text[])', [ids]);
      await client.query('DELETE FROM public.users WHERE id=ANY($1::uuid[])', [ids]);
      for (const schema of schemas) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
      const after = (await client.query(
        'SELECT b.*, u.username FROM public.builds b JOIN public.users u ON u.id=b.owner_id WHERE owner_id=ANY($1::uuid[]) ORDER BY b.id', [seedUserIds])).rows;
      assert.deepEqual(after, keepBuilds, 'Intended builds must be unchanged.');
      assert.deepEqual((await inspectSeed(client)).missing, []);
      assert.equal(Number((await client.query('SELECT count(*) FROM public.users')).rows[0].count), 5);
      await client.query('COMMIT');
    } else { await client.query('ROLLBACK'); }
    return summary;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
if (require.main === module) {
  cleanQA(process.argv.includes('--apply'))
    .then(result => console.info(JSON.stringify(result)))
    .catch(error => { console.error('QA cleanup stopped; transaction rolled back.', error.code ? 'Database error.' : error.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { cleanQA, schemaPattern, knownAccount };
