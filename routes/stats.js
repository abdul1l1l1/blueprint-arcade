// Stats API — Top 10 Builds (rating x likes) and profile stats.
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// GET /api/stats/top10 — Top 10 Builds ranked by rating x likes
router.get('/top10', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, g.name AS game_name, u.username AS owner,
              bs.avg_rating, bs.like_count,
              ROUND(bs.avg_rating * bs.like_count, 2) AS score
       FROM builds b JOIN games g ON g.id = b.game_id JOIN users u ON u.id = b.owner_id
       JOIN build_stats bs ON bs.build_id = b.id
       ORDER BY score DESC NULLS LAST, bs.avg_rating DESC
       LIMIT 10`);
    res.json({ top: rows });
  } catch (err) { next(err); }
});

// GET /api/stats/profile/:username — profile: pinned (max 3) + all builds
router.get('/profile/:username', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.is_pinned, b.build_type, g.name AS game_name,
              COALESCE(bs.avg_rating, 0) AS avg_rating, COALESCE(bs.like_count, 0) AS like_count
       FROM builds b JOIN users u ON u.id = b.owner_id JOIN games g ON g.id = b.game_id
       LEFT JOIN build_stats bs ON bs.build_id = b.id
       WHERE u.username = $1
       ORDER BY b.is_pinned DESC, b.created_at DESC`, [req.params.username]);
    res.json({ builds: rows });
  } catch (err) { next(err); }
});

module.exports = router;
