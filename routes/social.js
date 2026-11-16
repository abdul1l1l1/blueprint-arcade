// Public reading, session-owned reactions, and serialized toggle transactions.
const express = require('express');
const { pool } = require('../db/pool');
const { buildSelect, validId } = require('./build-data');
const { recordBuildNotification } = require('./notifications');

function createSocialRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const login = (req, res, next) => req.session.userId ? next()
    : res.status(401).json({ errors: { _general: 'You must be logged in.' } });
  router.use((req, res, next) => req.method === 'POST' ? login(req, res, next) : next());
  router.param('id', async (req, res, next, id) => {
    if (!validId(id)) return res.status(400).json({ errors: { id: 'Invalid build ID.' } });
    try {
      const result = await database.query('SELECT id FROM builds WHERE id=$1', [id]);
      if (!result.rows.length) return res.status(404).json({ errors: { _general: 'Build not found.' } });
      next();
    } catch (error) { next(error); }
  });

  async function state(client, id, userId) {
    const { rows } = await client.query(
      `SELECT bs.avg_rating::float8, bs.like_count::int, bs.rating_count::int, bs.comment_count::int,
       EXISTS(SELECT 1 FROM likes WHERE build_id=$1 AND user_id=$2) AS liked,
       EXISTS(SELECT 1 FROM favorites WHERE build_id=$1 AND user_id=$2) AS favorited,
       (SELECT stars FROM ratings WHERE build_id=$1 AND user_id=$2) AS rating,
       EXISTS(SELECT 1 FROM reposts WHERE build_id=$1 AND user_id=$2) AS reposted,
       (SELECT count(*)::int FROM reposts WHERE build_id=$1) AS repost_count,
       COALESCE((SELECT owner_id<>$2 FROM builds WHERE id=$1),FALSE) AS can_repost
       FROM build_stats bs WHERE bs.build_id=$1`, [id, userId || null]);
    return rows[0];
  }
  router.get('/builds/:id/state', async (req, res, next) => {
    try { res.json(await state(database, req.params.id, req.session.userId)); }
    catch (error) { next(error); }
  });

  for (const [action, table] of [['like', 'likes'], ['favorite', 'favorites']]) {
    router.post(`/builds/:id/${action}`, login, async (req, res, next) => {
      let client;
      try {
        client = await database.connect();
        await client.query('BEGIN');
        // Parent lock also prevents a concurrent delete and serializes toggles.
        const { rows: [build] } = await client.query(
          'SELECT id,owner_id FROM builds WHERE id=$1 FOR UPDATE', [req.params.id]);
        if (!build) {
          await client.query('ROLLBACK');
          return res.status(404).json({ errors: { _general: 'Build not found.' } });
        }
        const removed = await client.query(
          `DELETE FROM ${table} WHERE build_id=$1 AND user_id=$2 RETURNING user_id`,
          [req.params.id, req.session.userId]);
        if (!removed.rowCount) {
          await client.query(
            `INSERT INTO ${table}(build_id,user_id) VALUES($1,$2)`, [req.params.id, req.session.userId]);
          if (action === 'like') await recordBuildNotification(client, {
            recipientId: build.owner_id,
            actorId: req.session.userId,
            buildId: req.params.id,
            eventType: 'like',
          });
        }
        const result = await state(client, req.params.id, req.session.userId);
        await client.query('COMMIT');
        res.json(result);
      } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        next(error);
      } finally { client?.release(); }
    });
  }

  router.post('/builds/:id/repost', login, async (req, res, next) => {
    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      const { rows: [build] } = await client.query(
        'SELECT id,owner_id FROM builds WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!build) {
        await client.query('ROLLBACK');
        return res.status(404).json({ errors: { _general: 'Build not found.' } });
      }
      if (build.owner_id === req.session.userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ errors: { _general: 'You cannot repost your own build.' } });
      }
      const removed = await client.query(
        'DELETE FROM reposts WHERE user_id=$1 AND build_id=$2 RETURNING user_id',
        [req.session.userId, req.params.id]);
      if (!removed.rowCount) {
        await client.query('INSERT INTO reposts(user_id,build_id) VALUES($1,$2)',
          [req.session.userId, req.params.id]);
        await recordBuildNotification(client, {
          recipientId: build.owner_id,
          actorId: req.session.userId,
          buildId: req.params.id,
          eventType: 'repost',
        });
      }
      const result = await state(client, req.params.id, req.session.userId);
      await client.query('COMMIT');
      res.json(result);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally { client?.release(); }
  });

  router.post('/builds/:id/rating', login, async (req, res, next) => {
    const stars = req.body?.stars;
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ errors: { stars: 'Choose an integer from 1 to 5.' } });
    }
    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      const { rows: [build] } = await client.query(
        'SELECT id,owner_id FROM builds WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!build) {
        await client.query('ROLLBACK');
        return res.status(404).json({ errors: { _general: 'Build not found.' } });
      }
      await client.query(
        `INSERT INTO ratings(build_id,user_id,stars) VALUES($1,$2,$3)
         ON CONFLICT(user_id,build_id) DO UPDATE SET stars=EXCLUDED.stars`,
        [req.params.id, req.session.userId, stars]);
      await recordBuildNotification(client, {
        recipientId: build.owner_id,
        actorId: req.session.userId,
        buildId: req.params.id,
        eventType: 'rating',
      });
      const result = await state(client, req.params.id, req.session.userId);
      await client.query('COMMIT');
      res.json(result);
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23503') return res.status(404).json({ errors: { _general: 'Build not found.' } });
      next(error);
    } finally { client?.release(); }
  });
  router.get('/builds/:id/comments', async (req, res, next) => {
    try {
      const { rows } = await database.query(
        `SELECT c.id,c.body,c.created_at,u.username FROM comments c JOIN users u ON u.id=c.user_id
         WHERE c.build_id=$1 ORDER BY c.created_at DESC,c.id DESC`, [req.params.id]);
      res.json({ comments: rows });
    } catch (error) { next(error); }
  });
  router.post('/builds/:id/comments', login, async (req, res, next) => {
    const body = req.body?.body;
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000 || body.includes('\0')) {
      return res.status(400).json({ errors: { body: 'Enter a comment of 1–2000 characters.' } });
    }
    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      const { rows: [build] } = await client.query(
        'SELECT id,owner_id FROM builds WHERE id=$1 FOR UPDATE', [req.params.id]);
      if (!build) {
        await client.query('ROLLBACK');
        return res.status(404).json({ errors: { _general: 'Build not found.' } });
      }
      const { rows: [comment] } = await client.query(
        `WITH added AS (
          INSERT INTO comments(build_id,user_id,body) VALUES($1,$2,$3)
          RETURNING id,body,created_at,user_id
         )
         SELECT a.id,a.body,a.created_at,u.username
         FROM added a JOIN users u ON u.id=a.user_id`,
        [req.params.id, req.session.userId, body.trim()]);
      await recordBuildNotification(client, {
        recipientId: build.owner_id,
        actorId: req.session.userId,
        buildId: req.params.id,
        eventType: 'comment',
      });
      await client.query('COMMIT');
      res.status(201).json({ comment });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23503') return res.status(404).json({ errors: { _general: 'Build not found.' } });
      next(error);
    } finally { client?.release(); }
  });
  router.get('/favorites', login, async (req, res, next) => {
    try {
      const { rows } = await database.query(
        `${buildSelect} JOIN favorites f ON f.build_id=b.id
         WHERE f.user_id=$1 ORDER BY f.created_at DESC,b.id`, [req.session.userId]);
      res.json({ favorites: rows });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createSocialRouter };
