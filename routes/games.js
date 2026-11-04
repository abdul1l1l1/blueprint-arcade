// Games API — Game Directory, Game Detail, per-game tag vocabulary, Compare Games data.
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

// GET /api/games — directory list with stats
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT g.*, COALESCE(gs.build_count, 0) AS build_count, COALESCE(gs.avg_rating, 0) AS avg_rating
       FROM games g LEFT JOIN game_stats gs ON gs.game_id = g.id
       ORDER BY g.name`);
    res.json({ games: rows });
  } catch (err) { next(err); }
});

// GET /api/games/:slug — one game + its tag vocabulary + its builds
router.get('/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM games WHERE slug = $1', [req.params.slug]);
    if (!rows[0]) return res.status(404).json({ errors: { _general: 'Game not found.' } });
    const tags = await pool.query('SELECT tag FROM game_tags WHERE game_id = $1 ORDER BY tag', [rows[0].id]);
    // TODO (Phase 2): also return builds for this game
    res.json({ game: rows[0], tags: tags.rows.map(r => r.tag) });
  } catch (err) { next(err); }
});

// GET /api/games/compare?ids=1,2,3 — side-by-side comparison rows (Comparison Tool)
router.get('/compare/ids', async (req, res, next) => {
  try {
    // TODO (Phase 4): return aligned comparison fields for the selected games
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  } catch (err) { next(err); }
});

module.exports = router;
