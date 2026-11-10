// Explicit operator command, not startup or seed behavior.
require('dotenv').config();
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { entries } = require('../public/js/approved-images');
const { assetFile } = require('./asset-storage');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = () => require('../docs/demo-illustration-manifest.json');

async function verifyStoredAssets() {
  for (const entry of entries) {
    const [bytes] = await assetFile(entry).download();
    if (digest(bytes) !== manifest()[entry.slug]) throw new Error(`Asset mismatch: ${entry.slug}`);
  }
}

async function uploadAssets() {
  if (process.env.NODE_ENV === 'production') throw new Error('QA-only asset preparation.');
  for (const entry of entries) {
    const bytes = await readFile(path.resolve(__dirname, '../../images/demo-illustrations', `${entry.slug}.jpg`));
    if (digest(bytes) !== manifest()[entry.slug]) throw new Error(`Local asset mismatch: ${entry.slug}`);
    const file = assetFile(entry);
    const [exists] = await file.exists();
    if (exists) {
      const [existing] = await file.download();
      if (digest(existing) !== digest(bytes)) throw new Error(`Existing asset conflict: ${entry.slug}`);
      continue;
    }
    await file.save(bytes, {
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=86400' },
    });
  }
  await verifyStoredAssets();
  return { verified: entries.length };
}

if (require.main === module) {
  uploadAssets().then(result => console.info('Demo illustration assets:', result))
    .catch(() => { console.error('Asset preparation failed. Check local files, storage access, and object conflicts.'); process.exitCode = 1; });
}
module.exports = { verifyStoredAssets, uploadAssets, digest };
