// Creates all tables from db/schema.sql.
// Usage: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');
const { uploadSchema } = require('./migrate-uploads');

async function initialize(database = pool) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query(uploadSchema);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const run = process.env.NODE_ENV === 'production'
    ? Promise.reject(new Error('Schema initialization is QA-only.'))
    : initialize();
  run
    .then(() => console.info('Schema ready (existing data preserved).'))
    .catch(() => {
      console.error('db:init failed. Check schema compatibility and database configuration.');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { initialize };
