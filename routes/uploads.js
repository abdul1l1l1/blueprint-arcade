const express = require('express');
const { randomUUID } = require('node:crypto');
const { pool } = require('../db/pool');
const { validId, failure } = require('./build-data');
const { maxBytes, types, imagePath } = require('../public/js/upload-path');
const imageStorage = require('../db/image-storage');

function createUploadsRouter(database = pool, storage = imageStorage) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  function authenticated(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ errors: { image: 'Log in before uploading images.' } });
    // JSON + same-origin browser requests only. Reject cross-site signed-URL minting.
    if (!req.is('application/json') || req.get('Sec-Fetch-Site') === 'cross-site') {
      return res.status(403).json({ errors: { image: 'Upload from this site using the build form.' } });
    }
    next();
  }
  router.post('/api/uploads/request-url', authenticated, async (req, res, next) => {
    const { size, contentType, publicConsent } = req.body || {};
    if (publicConsent !== true) return res.status(400).json({ errors: { image: 'Confirm that you may share this image publicly.' } });
    if (!Number.isInteger(size) || size < 1 || size > maxBytes || !types.includes(contentType)) {
      return res.status(400).json({ errors: { image: 'Use a JPEG, PNG or WebP image no larger than 8 MB.' } });
    }
    let client;
    try {
      const prefix = storage.privatePrefix();
      const id = randomUUID();
      const stagingKey = `${prefix}/build-upload-staging/${id}`;
      const objectKey = `${prefix}/build-images/${id}.webp`;
      client = await database.connect();
      await client.query('BEGIN');
      const owner = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.session.userId]);
      if (!owner.rows.length) throw failure(401, { image: 'Please log in again.' });
      const count = await client.query("SELECT count(*)::int AS n FROM image_uploads WHERE owner_id=$1 AND created_at > now() - interval '1 hour'", [req.session.userId]);
      if (count.rows[0].n >= 30) throw failure(429, { image: 'Upload limit reached. Please try again in an hour.' });
      const uploadURL = await storage.signUpload(stagingKey);
      await client.query(`INSERT INTO image_uploads
        (id,owner_id,staging_key,object_key,expected_size,content_type,public_consent)
        VALUES ($1,$2,$3,$4,$5,$6,true)`, [id, req.session.userId, stagingKey, objectKey, size, contentType]);
      await client.query('COMMIT');
      res.status(201).json({ id, uploadURL });
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      if (error.errors) return res.status(error.status).json({ errors: error.errors });
      next(error);
    } finally { client?.release(); }
  });
  router.post('/api/uploads/:id/complete', authenticated, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ errors: { image: 'Invalid upload ID.' } });
    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      const { rows: [row] } = await client.query('SELECT * FROM image_uploads WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!row) throw failure(404, { image: 'Upload not found.' });
      if (row.owner_id !== req.session.userId) throw failure(403, { image: 'Only the uploader can finish this upload.' });
      if (!row.ready) {
        if (Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) throw failure(410, { image: 'Upload expired. Choose the file and retry.' });
        await storage.finalize(row);
        await client.query('UPDATE image_uploads SET ready=true WHERE id=$1', [row.id]);
      }
      await client.query('COMMIT');
      res.json({ imageUrl: imagePath(row.id) });
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      if (error.imageValidation) return res.status(400).json({ errors: { image: error.message } });
      if (error.errors) return res.status(error.status).json({ errors: error.errors });
      next(error);
    } finally { client?.release(); }
  });
  // Must be mounted BEFORE the fixed approved-assets /media 404 handler.
  router.get('/media/uploads/:filename', async (req, res, next) => {
    const { uploadId } = require('../public/js/upload-path');
    const id = uploadId(`/media/uploads/${req.params.filename}`);
    if (!id) return res.status(404).json({ errors: { image: 'Image not found.' } });
    try {
      const { rows: [row] } = await database.query(`SELECT i.* FROM image_uploads i
        WHERE i.id=$1 AND i.ready AND i.public_consent AND
        (i.owner_id=$2 OR EXISTS (SELECT 1 FROM builds b WHERE $3=ANY(b.image_urls)))`,
      [id, req.session.userId || null, imagePath(id)]);
      if (!row) return res.status(404).json({ errors: { image: 'Image not found.' } });
      storage.serve(row, res, next);
    } catch {
      res.status(503).json({ errors: { image: 'Image temporarily unavailable.' } });
    }
  });
  return router;
}
module.exports = { createUploadsRouter };
