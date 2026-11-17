const express = require('express');
const { pool } = require('../db/pool');

function createFollowsRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  async function targetUser(req, res) {
    const { rows: [target] } = await database.query(
      'SELECT id FROM users WHERE lower(username)=lower($1)',
      [req.params.username],
    );
    if (!target) {
      res.status(404).json({ errors: { profile: 'Profile not found.' } });
      return null;
    }
    if (String(target.id) === String(req.session.userId)) {
      res.status(400).json({ errors: { follow: 'You cannot follow yourself.' } });
      return null;
    }
    return target;
  }

  router.post('/:username', async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ errors: { follow: 'Log in to follow builders.' } });
    try {
      const target = await targetUser(req, res);
      if (!target) return;
      const result = await database.query(
        'INSERT INTO follows (follower_id, followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING followed_id',
        [req.session.userId, target.id],
      );
      if (!result.rowCount) return res.status(409).json({ errors: { follow: 'You already follow this builder.' } });
      const { rows: [counts] } = await database.query(
        'SELECT count(*)::int AS follower_count FROM follows WHERE followed_id=$1',
        [target.id],
      );
      res.status(201).json({ following: true, follower_count: counts.follower_count });
    } catch (error) { next(error); }
  });

  router.delete('/:username', async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ errors: { follow: 'Log in to follow builders.' } });
    try {
      const target = await targetUser(req, res);
      if (!target) return;
      await database.query('DELETE FROM follows WHERE follower_id=$1 AND followed_id=$2', [req.session.userId, target.id]);
      const { rows: [counts] } = await database.query(
        'SELECT count(*)::int AS follower_count FROM follows WHERE followed_id=$1',
        [target.id],
      );
      res.json({ following: false, follower_count: counts.follower_count });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createFollowsRouter };
