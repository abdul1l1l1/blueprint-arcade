const express = require('express');
const COVER_PATH = '/media/builds/construction-site-c40bfeba.png';
const OBJECT_KEY = 'public/builds/construction-site-c40bfeba.png';

function createApprovedAssetsRouter({ load } = {}) {
  const router = express.Router();
  const loadImage = load || (async () => {
    const { storage } = require('../db/asset-storage');
    const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucket) throw new Error('App Storage is not configured.');
    const [bytes] = await storage.bucket(bucket).file(OBJECT_KEY).download();
    return bytes;
  });
  // This deliberately public, owner-approved object is the only exposed key.
  router.get(COVER_PATH, async (req, res) => {
    try {
      const bytes = await loadImage();
      res.set('Cache-Control', 'public, max-age=86400');
      res.type('png').send(bytes);
    } catch {
      res.set('Cache-Control', 'no-store');
      res.status(503).json({ errors: { image: 'Cover image unavailable.' } });
    }
  });
  return router;
}
module.exports = { COVER_PATH, OBJECT_KEY, createApprovedAssetsRouter };
