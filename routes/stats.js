// Stats API — Top 10 Builds (rating x likes) and profile stats.
const express = require('express');
const { pool } = require('../db/pool');
const { buildSelect, repostSelect } = require('./build-data');
const PAGE_SIZE = 12;

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
  const list = req.query.list || 'all';
  const offset = req.query.offset === undefined ? '0' : req.query.offset;
  if (!['all', 'builds', 'reposts'].includes(list)
    || typeof offset !== 'string'
    || !/^\d+$/.test(offset)
    || !Number.isSafeInteger(Number(offset))
    || Number(offset) > 100000
    || Number(offset) % PAGE_SIZE !== 0) {
    return res.status(400).json({ errors: { page: 'Choose a valid profile results page.' } });
  }
  try {
    const profile = await database.query(
      `SELECT u.id,u.username,p.display_name,p.bio,p.avatar_url,
       (SELECT count(*)::int FROM builds WHERE owner_id=u.id) AS build_count,
       (SELECT count(*)::int FROM builds WHERE owner_id=u.id AND is_pinned) AS pinned_count,
       (SELECT count(*)::int FROM reposts WHERE user_id=u.id) AS repost_count,
       (SELECT count(*)::int FROM follows WHERE followed_id=u.id) AS follower_count,
       (SELECT count(*)::int FROM follows WHERE follower_id=u.id) AS following_count,
       EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=u.id) AS is_following
       FROM users u JOIN profiles p ON p.user_id=u.id WHERE lower(u.username)=lower($1)`,
      [req.params.username, req.session?.userId || null]);
    if (!profile.rows[0]) return res.status(404).json({ errors: { _general: 'Profile not found.' } });
    const wantsBuilds = list === 'all' || list === 'builds';
    const wantsReposts = list === 'all' || list === 'reposts';
    const [builds, reposts] = await Promise.all([
      wantsBuilds ? database.query(
        `${buildSelect} WHERE b.owner_id=$1 ORDER BY b.is_pinned DESC,b.created_at DESC,b.id LIMIT $2 OFFSET $3`,
        [profile.rows[0].id, PAGE_SIZE + 1, Number(offset)],
      ) : { rows: [] },
      wantsReposts ? database.query(
        `${repostSelect} WHERE r.user_id=$1 ORDER BY r.created_at DESC,b.id LIMIT $2 OFFSET $3`,
        [profile.rows[0].id, PAGE_SIZE + 1, Number(offset)],
      ) : { rows: [] },
    ]);
    const hasMoreBuilds = builds.rows.length > PAGE_SIZE;
    const hasMoreReposts = reposts.rows.length > PAGE_SIZE;
    res.json({
      profile: profile.rows[0],
      builds: builds.rows.slice(0, PAGE_SIZE),
      reposts: reposts.rows.slice(0, PAGE_SIZE).map(build => ({ ...build, is_repost: true })),
      page: {
        builds: { offset: Number(offset), has_more: hasMoreBuilds, next_offset: hasMoreBuilds ? Number(offset) + PAGE_SIZE : null },
        reposts: { offset: Number(offset), has_more: hasMoreReposts, next_offset: hasMoreReposts ? Number(offset) + PAGE_SIZE : null },
      },
    });
  } catch (err) { next(err); }
});

return router;
}
module.exports = { createStatsRouter };
