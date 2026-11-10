const express = require('express');
const COVER_PATH = '/media/builds/construction-site-c40bfeba.png';
const OBJECT_KEY = 'public/builds/construction-site-c40bfeba.png';
const { entries } = require('../public/js/approved-images');

function createApprovedAssetsRouter({ load } = {}) {
  const router = express.Router();
  const loadImage = load || (async entry => {
    const { assetFile } = require('../db/asset-storage');
    const [bytes] = await assetFile(entry).download();
    return bytes;
  });
  const approved = [
    { path: COVER_PATH, objectKey: OBJECT_KEY, type: 'png', error: 'Cover image unavailable.' },
    ...entries.map(entry => ({ ...entry, type: 'jpg', error: 'Illustration unavailable.' })),
  ];
  for (const entry of approved) {
    router.get(entry.path, async (req, res) => {
      try {
        const bytes = await loadImage(entry);
        res.set('Cache-Control', 'public, max-age=86400');
        res.type(entry.type).send(bytes);
      } catch {
        res.set('Cache-Control', 'no-store');
        res.status(503).json({ errors: { image: entry.error } });
      }
    });
  }
  // Do not let unsupported media paths fall through to the HTML app shell.
  router.use('/media', (req, res) => res.status(404).json({ errors: { image: 'Image not found.' } }));
  return router;
}
module.exports = { COVER_PATH, OBJECT_KEY, createApprovedAssetsRouter };
