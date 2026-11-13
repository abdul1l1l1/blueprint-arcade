// Stats API — Top 10 Builds (rating x likes) and profile stats.
const express = require('express');
const { pool } = require('../db/pool');
const { buildSelect, repostSelect } = require('./build-data');

function createStatsRouter(database = pool) {
const router = express.Router();
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// GET /api/stats/top10 — Top 10 Builds ranked by rating x likes
router.get('/top10', async (req, res, next) => {
  try {
    const { rows } = await database.query(
      `${buildSelect.replace('SELECT b.id', 'SELECT (bs.avg_rating * bs.like_count)::float8 AS score, b.id')}
       ORDER BY bs.avg_rating * bs.like_count DESC, bs.avg_rating DESC, bs.like_count DESC,b.id
       LIMIT 10`);
    res.json({ top: rows.map(row => ({ ...row, score: Number(row.score) })) });
  } catch (err) { next(err); }
});

// GET /api/stats/profile/:username — profile: pinned (max 3) + all builds
router.get('/profile/:username', async (req, res, next) => {
  try {
    const profile = await database.query(
      `SELECT u.id,u.username,p.display_name,p.bio,p.avatar_url,
       (SELECT count(*)::int FROM builds WHERE owner_id=u.id) AS build_count,
       (SELECT count(*)::int FROM builds WHERE owner_id=u.id AND is_pinned) AS pinned_count
       FROM users u JOIN profiles p ON p.user_id=u.id WHERE lower(u.username)=lower($1)`, [req.params.username]);
    if (!profile.rows[0]) return res.status(404).json({ errors: { _general: 'Profile not found.' } });
    const { rows } = await database.query(
      `${buildSelect} WHERE b.owner_id=$1 ORDER BY b.is_pinned DESC,b.created_at DESC,b.id`, [profile.rows[0].id]);
    const reposted = await database.query(
      `${repostSelect} WHERE r.user_id=$1 ORDER BY r.created_at DESC,b.id`, [profile.rows[0].id]);
    res.json({
      profile: profile.rows[0],
      builds: rows,
      reposts: reposted.rows.map(build => ({ ...build, is_repost: true })),
    });
  } catch (err) { next(err); }
});

return router;
}
module.exports = { createStatsRouter };
