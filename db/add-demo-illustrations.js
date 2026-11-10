// Empty-image-only QA operation. Never seed, reset, or repair demo content here.
require('dotenv').config();
const { pool } = require('./pool');
const { entries } = require('../public/js/approved-images');

async function addDemoIllustrations(database = pool, { apply = false, verifyAssets } = {}) {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo illustrations are QA-only.');
  if (apply) await (verifyAssets || require('./demo-illustration-assets').verifyStoredAssets)();
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(847216001)');
    const pending = [];
    for (const entry of entries) {
      const { rows } = await client.query(
        `SELECT b.id, b.image_urls FROM builds b
         JOIN users u ON u.id=b.owner_id JOIN games g ON g.id=b.game_id
         WHERE b.title=$1 AND lower(u.username)=$2 AND g.slug=$3 FOR UPDATE OF b`,
        [entry.title, entry.owner, entry.game]);
      if (rows.length !== 1) throw new Error(`Missing or ambiguous demo: ${entry.title}`);
      const row = rows[0];
      if (row.image_urls.length === 1 && row.image_urls[0] === entry.path) continue;
      if (row.image_urls.length !== 0) throw new Error(`Image conflict: ${entry.title}`);
      pending.push({ id: row.id, entry });
    }
    if (apply) {
      for (const { id, entry } of pending) {
        const result = await client.query(
          `UPDATE builds SET image_urls=$1 WHERE id=$2 AND cardinality(image_urls)=0`,
          [[entry.path], id]);
        if (result.rowCount !== 1) throw new Error(`Concurrent image change: ${entry.title}`);
      }
    }
    await client.query(apply ? 'COMMIT' : 'ROLLBACK');
    return { status: apply ? 'applied' : 'dry-run', changed: apply ? pending.length : 0, pending: pending.length, unchanged: entries.length - pending.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const valid = args.length === 0 || (args.length === 2 && args.includes('--apply') && args.includes('--qa'));
  const run = valid ? addDemoIllustrations(pool, { apply: args.includes('--apply') })
    : Promise.reject(new Error('Use no arguments for dry-run, or --apply --qa.'));
  run.then(result => console.info('Demo illustrations:', result))
    .catch(error => {
      const safe = /^(Missing or ambiguous demo:|Image conflict:|Concurrent image change:|Demo illustrations are QA-only|Use no arguments)/.test(error.message);
      console.error(safe ? error.message : 'Demo image operation failed; no build changes committed. Check storage and QA configuration.');
      process.exitCode = 1;
    }).finally(() => pool.end());
}
module.exports = { addDemoIllustrations };
