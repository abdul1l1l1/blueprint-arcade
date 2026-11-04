// Builds API — the CRUD heart of the app.
// Implemented progressively: Phase 3 (create/read), Phase 3 (update/delete/pin).
// Access control is server-side: only the owner may edit, delete, or pin a build.
// Rule: a profile may pin at most 3 builds (check before setting is_pinned).
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ errors: { _general: 'You must be logged in.' } });
  }
  next();
}

// GET /api/builds — list with search, filters (game, build_type, budget_tier, tags), sorting
router.get('/', async (req, res, next) => {
  try {
    // TODO (Phase 3): search by title, filter by game/build_type/budget_tier/tag, sort by newest|rating|likes
    const { rows } = await pool.query(
      `SELECT b.id, b.title, b.description, b.image_urls, b.budget_tier, b.build_type, b.is_pinned,
              b.created_at, g.name AS game_name, g.slug AS game_slug, u.username AS owner,
              COALESCE(bs.avg_rating, 0) AS avg_rating, COALESCE(bs.like_count, 0) AS like_count
       FROM builds b
       JOIN games g ON g.id = b.game_id
       JOIN users u ON u.id = b.owner_id
       LEFT JOIN build_stats bs ON bs.build_id = b.id
       ORDER BY b.is_pinned DESC, b.created_at DESC`
    );
    res.json({ builds: rows });
  } catch (err) { next(err); }
});

// GET /api/builds/:id — one build with tags, ratings, comments (Image Carousel + Likes/Comments data)
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, g.name AS game_name, u.username AS owner,
              COALESCE(bs.avg_rating, 0) AS avg_rating, COALESCE(bs.like_count, 0) AS like_count
       FROM builds b JOIN games g ON g.id = b.game_id JOIN users u ON u.id = b.owner_id
       LEFT JOIN build_stats bs ON bs.build_id = b.id
       WHERE b.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ errors: { _general: 'Build not found.' } });
    res.json({ build: rows[0] }); // TODO (Phase 3): also return tags, comments, viewer rating/like state
  } catch (err) { next(err); }
});

// POST /api/builds — create (owner = session user)
router.post('/', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 3): validate title/game/budget_tier/build_type/image_urls, insert build + build_tags
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 3).' } });
  } catch (err) { next(err); }
});

// PUT /api/builds/:id — update (owner only)
router.put('/:id', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 3): load build, 403 unless owner, update fields + tags
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 3).' } });
  } catch (err) { next(err); }
});

// DELETE /api/builds/:id — delete (owner only)
router.delete('/:id', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 3): load build, 403 unless owner, delete
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 3).' } });
  } catch (err) { next(err); }
});

// POST /api/builds/:id/pin — pin/unpin (owner only, max 3 pinned per profile)
router.post('/:id/pin', requireLogin, async (req, res, next) => {
  try {
    // TODO (Phase 3): enforce MAX 3 PINNED rule server-side
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 3).' } });
  } catch (err) { next(err); }
});

module.exports = router;
