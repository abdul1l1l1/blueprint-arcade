require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('./pool');
const uploadSchema = fs.readFileSync(path.join(__dirname, 'migrations/image-uploads.sql'), 'utf8');

if (require.main === module) {
  const run = process.env.NODE_ENV === 'production'
    ? Promise.reject(new Error('This migration command is QA-only.'))
    : pool.query(`BEGIN; ${uploadSchema} COMMIT;`);
  run.then(() => console.info('Image upload schema ready; existing content preserved.'))
    .catch(() => { console.error('Image upload migration failed. Check the QA database setup.'); process.exitCode = 1; })
    .finally(() => pool.end());
}
module.exports = { uploadSchema };
