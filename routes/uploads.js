const express = require('express');
const { pool } = require('../db/pool');
const imageStorage = require('../db/image-storage');

const UUID_IMAGE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/;

function createUploadsRouter(database = pool, storage = imageStorage) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  router.get('/media/uploads/:filename', async (req, res, next) => {
    const match = UUID_IMAGE.exec(req.params.filename);
    if (!match) return res.status(404).json({ errors: { image: 'Image not found.' } });

    const imageUrl = `/media/uploads/${match[1]}.webp`;
    try {
      const { rows: [row] } = await database.query(
        `SELECT i.object_key
         FROM image_uploads i
         WHERE i.id=$1 AND i.ready AND i.public_consent
           AND (
             i.owner_id=$2 OR EXISTS (
               SELECT 1 FROM builds b WHERE $3=ANY(b.image_urls)
             )
           )`,
        [match[1], req.session?.userId || null, imageUrl],
      );
      if (!row) return res.status(404).json({ errors: { image: 'Image not found.' } });
      storage.serve(row, res);
    } catch {
      res.status(503).json({ errors: { image: 'Image temporarily unavailable.' } });
    }
  });

  return router;
}

module.exports = { createUploadsRouter };
