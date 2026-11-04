// Social API — likes, comments, star ratings, favorites.
// All routes require login; one like/rating/favorite per user per build (DB uniqueness).
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ errors: { _general: 'You must be logged in.' } });
  }
  next();
}

// POST /api/social/builds/:id/like — toggle like
router.post('/builds/:id/like', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 4): INSERT ... ON CONFLICT toggle, return new count + liked state
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  } catch (err) { next(err); }
});

// POST /api/social/builds/:id/rating — set 1-5 star rating (upsert)
router.post('/builds/:id/rating', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 4): validate stars 1-5, upsert ratings, return new average
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  } catch (err) { next(err); }
});

// GET /api/social/builds/:id/comments — list comments
router.get('/builds/:id/comments', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.body, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.build_id = $1 ORDER BY c.created_at DESC`, [req.params.id]);
    res.json({ comments: rows });
  } catch (err) { next(err); }
});

// POST /api/social/builds/:id/comments — add comment
router.post('/builds/:id/comments', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 4): validate body, insert, return created comment
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  } catch (err) { next(err); }
});

// POST /api/social/builds/:id/favorite — toggle favorite
router.post('/builds/:id/favorite', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 4): toggle favorites, return state
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  } catch (err) { next(err); }
});

// GET /api/social/favorites — current user's favorites (Favorites view)
router.get('/favorites', requireLogin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.title, g.name AS game_name FROM favorites f
       JOIN builds b ON b.id = f.build_id JOIN games g ON g.id = b.game_id
       WHERE f.user_id = $1 ORDER BY f.created_at DESC`, [req.session.userId]);
    res.json({ favorites: rows });
  } catch (err) { next(err); }
});

module.exports = router;
