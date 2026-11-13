const { storage } = require('./asset-storage');

function objectFile(key) {
  const match = /^\/([^/]+)\/(.+)$/.exec(key);
  if (!match) throw new Error('Invalid private image location.');
  return storage.bucket(match[1]).file(match[2]);
}

function serve(row, res) {
  res.type('webp');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('Cache-Control', 'private, no-store');
  try {
    objectFile(row.object_key).createReadStream()
      .on('error', () => {
        if (res.headersSent) return res.destroy();
        res.status(503).json({ errors: { image: 'Image temporarily unavailable.' } });
      })
      .pipe(res);
  } catch {
    res.status(503).json({ errors: { image: 'Image temporarily unavailable.' } });
  }
}

async function deleteObjects(rows) {
  const keys = new Set((rows || []).flatMap(row => [row.staging_key, row.object_key]).filter(Boolean));
  await Promise.all([...keys].map(key => objectFile(key).delete({ ignoreNotFound: true })));
}

module.exports = { serve, deleteObjects };
