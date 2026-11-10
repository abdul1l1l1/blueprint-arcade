const sharp = require('sharp');
const { storage } = require('./asset-storage');
const { maxBytes } = require('../public/js/upload-path');
const badImage = message => Object.assign(new Error(message), { imageValidation: true });

function objectFile(key) {
  const match = /^\/([^/]+)\/(.+)$/.exec(key);
  if (!match) throw new Error('Invalid private object location.');
  return storage.bucket(match[1]).file(match[2]);
}

function privatePrefix() {
  const prefix = (process.env.PRIVATE_OBJECT_DIR || '').replace(/\/+$/, '');
  if (!/^\/[^/]+\/.+/.test(prefix)) throw new Error('Private App Storage is not configured.');
  return prefix;
}

async function signUpload(key) {
  const match = /^\/([^/]+)\/(.+)$/.exec(key);
  const response = await fetch('http://127.0.0.1:1106/object-storage/signed-object-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bucket_name: match[1], object_name: match[2], method: 'PUT',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Cannot authorize an App Storage upload.');
  return (await response.json()).signed_url;
}

async function validateImage(bytes, expectedType) {
  if (!bytes.length || bytes.length > maxBytes) throw badImage('Choose an image no larger than 8 MB.');
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
    const meta = await image.metadata();
    const formats = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
    if (meta.format !== formats[expectedType] || (meta.pages || 1) !== 1) throw new Error('Invalid format');
    // Decode, rotate and re-encode: rejects corrupt/disguised files and removes
    // metadata (including GPS). Signed PUT replay can only change staging.
    const output = await image.rotate().webp({ quality: 90 }).toBuffer();
    if (output.length > maxBytes) throw new Error('Output too large');
    return output;
  } catch {
    throw badImage('Use a valid, non-animated JPEG, PNG or WebP image under 40 megapixels and 8 MB.');
  }
}

async function finalize(row) {
  const staging = objectFile(row.staging_key);
  let meta;
  try { [meta] = await staging.getMetadata(); }
  catch (error) {
    if (error.code === 404) throw badImage('The upload is missing. Choose the file and retry.');
    throw error;
  }
  if (Number(meta.size) !== row.expected_size || Number(meta.size) > maxBytes || meta.contentType !== row.content_type) {
    throw badImage('The uploaded file size or type did not match. Choose the file and retry.');
  }
  // Pin to the inspected generation and bound the read even if the PUT is replayed.
  const file = staging.bucket.file(staging.name, { generation: meta.generation });
  const [bytes] = await file.download({ start: 0, end: maxBytes });
  if (bytes.length !== row.expected_size) throw badImage('The uploaded file size did not match.');
  const output = await validateImage(bytes, row.content_type);
  await objectFile(row.object_key).save(output, {
    resumable: false,
    metadata: { contentType: 'image/webp', cacheControl: 'private, no-store' },
  });
  // Best-effort removal: the signed URL may still recreate staging until expiry.
  await staging.delete({ ignoreNotFound: true }).catch(() => {});
}

function serve(row, res, next) {
  res.type('webp');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('Cache-Control', 'private, no-store');
  objectFile(row.object_key).createReadStream().on('error', error => {
    if (res.headersSent) return res.destroy();
    res.status(503).json({ errors: { image: 'Image temporarily unavailable.' } });
  }).pipe(res);
}

module.exports = { privatePrefix, signUpload, finalize, serve, validateImage };
