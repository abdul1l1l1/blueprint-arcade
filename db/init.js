// Creates all tables from db/schema.sql.
// Usage: npm run db:init
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Running schema.sql ...');
  await pool.query(schema);
  console.log('Schema ready.');
  await pool.end();
}

main().catch((err) => {
  console.error('db:init failed:', err.message);
  process.exit(1);
});
