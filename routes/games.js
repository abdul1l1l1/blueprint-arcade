// Public, read-only Phase 2 browsing. Comparison remains a Phase 4 scaffold.
const express = require('express');
const { pool } = require('../db/pool');

const gameColumns = `g.id, g.slug, g.name, g.genre, g.release_year, g.description,
  g.image_url, g.is_sandbox, g.created_at,
  COALESCE(gs.build_count, 0)::int AS build_count,
  COALESCE(gs.avg_rating, 0)::float8 AS avg_rating`;
// SQL identifiers cannot be parameters: only these fixed order clauses are used.
const orders = Object.freeze({
  name: 'lower(g.name), g.id',
  builds: 'build_count DESC, lower(g.name), g.id',
  rating: 'avg_rating DESC, lower(g.name), g.id',
  newest: 'g.release_year DESC NULLS LAST, lower(g.name), g.id',
});

function createGamesRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // GET /api/games?q=...&sandbox=true|false&sort=name|builds|rating|newest
  router.get('/', async (req, res, next) => {
    const { q = '', sandbox, sort = 'name' } = req.query;
    const errors = {};
    if (typeof q !== 'string' || q.trim().length > 120 || q.includes('\0')) {
      errors.q = 'Search must be text with at most 120 characters.';
    }
    if (sandbox !== undefined && sandbox !== 'true' && sandbox !== 'false') {
      errors.sandbox = 'Choose all games, sandbox, or non-sandbox.';
    }
    if (typeof sort !== 'string' || !Object.hasOwn(orders, sort)) {
      errors.sort = 'Choose name, builds, rating, or newest.';
    }
    if (Object.keys(errors).length) return res.status(400).json({ errors });
    try {
      const values = [];
      const where = [];
      if (q.trim()) {
        // Treat %, _ and backslash as literal search text, not LIKE wildcards.
        values.push(`%${q.trim().replace(/[\\%_]/g, '\\$&')}%`);
        where.push(`(g.name ILIKE $${values.length} OR g.genre ILIKE $${values.length}
          OR g.description ILIKE $${values.length})`);
      }
      if (sandbox !== undefined) {
        values.push(sandbox === 'true');
        where.push(`g.is_sandbox = $${values.length}`);
      }
      const { rows } = await database.query(
        `SELECT ${gameColumns}
         FROM games g LEFT JOIN game_stats gs ON gs.game_id = g.id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY ${orders[sort]}`, values);
      res.json({ games: rows });
    } catch (err) { next(err); }
  });

  // GET /api/games/:slug — stats, vocabulary, and only this game's builds.
  router.get('/:slug', async (req, res, next) => {
    const { slug } = req.params;
    if (slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return res.status(400).json({ errors: { slug: 'Invalid game slug.' } });
    }
    try {
      const { rows } = await database.query(
        `SELECT ${gameColumns} FROM games g
         LEFT JOIN game_stats gs ON gs.game_id = g.id WHERE g.slug = $1`, [slug]);
      if (!rows[0]) return res.status(404).json({ errors: { _general: 'Game not found.' } });
      const game = rows[0];
      const tags = await database.query(
        'SELECT tag FROM game_tags WHERE game_id = $1 ORDER BY tag', [game.id]);
      const builds = await database.query(
        `SELECT b.id, b.game_id, b.title, b.description, b.image_urls, b.budget_tier,
                b.build_type, b.is_pinned, b.created_at, u.username AS owner,
                p.display_name, COALESCE(bs.avg_rating, 0)::float8 AS avg_rating,
                COALESCE(bs.like_count, 0)::int AS like_count,
                ARRAY(SELECT bt.tag FROM build_tags bt WHERE bt.build_id = b.id ORDER BY bt.tag) AS tags
         FROM builds b JOIN users u ON u.id = b.owner_id
         LEFT JOIN profiles p ON p.user_id = b.owner_id
         LEFT JOIN build_stats bs ON bs.build_id = b.id
         WHERE b.game_id = $1 ORDER BY b.created_at DESC, b.id`, [game.id]);
      res.json({ game, tags: tags.rows.map(row => row.tag), builds: builds.rows });
    } catch (err) { next(err); }
  });

  router.get('/compare/ids', (req, res) => {
    res.status(501).json({ errors: { _general: 'Not implemented yet (Phase 4).' } });
  });
  return router;
}

module.exports = { createGamesRouter };
