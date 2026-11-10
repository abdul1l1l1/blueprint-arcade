// Explicit additive QA import, separate from the original ten-build seed.
require('dotenv').config();
const { pool } = require('./pool');
const { COVER_PATH } = require('../routes/approved-assets');

async function addConstructionSite(database = pool) {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(847216002)');
    const owner = await client.query('SELECT id FROM users WHERE username=$1 FOR UPDATE', ['abdul_builds']);
    const game = await client.query('SELECT id FROM games WHERE slug=$1', ['bloxburg']);
    if (owner.rows.length !== 1 || game.rows.length !== 1) throw new Error('Expected Abdul and Bloxburg records are required.');
    const existing = await client.query(
      'SELECT id FROM builds WHERE owner_id=$1 AND game_id=$2 AND title=$3',
      [owner.rows[0].id, game.rows[0].id, 'Construction Site']);
    if (existing.rows.length) {
      await client.query('COMMIT');
      return { status: 'unchanged', ids: existing.rows.map(row => row.id) };
    }
    const result = await client.query(
      `INSERT INTO builds (owner_id,game_id,title,description,image_urls,budget_tier,build_type,is_pinned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING id`,
      [owner.rows[0].id, game.rows[0].id, 'Construction Site',
        'Construction site in Welcome to Bloxburg. Original screenshot provided by Abdul. Budget not supplied; Starter is the form default.',
        [COVER_PATH], 'starter', 'freeform']);
    await client.query('COMMIT');
    return { status: 'added', ids: result.rows.map(row => row.id) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
if (require.main === module) {
  const run = process.env.NODE_ENV === 'production'
    ? Promise.reject(new Error('QA-only import.')) : addConstructionSite();
  run.then(result => console.info('Construction Site import:', result.status))
    .catch(() => { console.error('Content import failed; no rows overwritten.'); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { addConstructionSite };
