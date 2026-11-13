// Phase 3: public browsing, transactional owner-only CRUD, max-three pin rule.
const express = require('express');
const { pool } = require('../db/pool');
const { buildSelect, repostSelect, types, budgets, validId, failure, validateBuild } = require('./build-data');
const sorts = Object.freeze({
  newest: 'b.created_at DESC, b.id',
  rating: 'avg_rating DESC, b.created_at DESC, b.id',
  likes: 'like_count DESC, b.created_at DESC, b.id',
});
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ errors: { _general: 'You must be logged in.' } });
  next();
}
function createBuildsRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/', async (req, res, next) => {
    const { q = '', game = '', build_type = '', budget_tier = '', tag = '', sort = 'newest' } = req.query;
    const errors = {};
    for (const [key, value] of Object.entries({ q, game, build_type, budget_tier, tag, sort })) {
      if (typeof value !== 'string' || value.includes('\0')) errors[key] = 'Choose a single valid value.';
    }
    if (typeof q === 'string' && q.trim().length > 120) errors.q = 'Search must be at most 120 characters.';
    if (build_type && !types.includes(build_type)) errors.build_type = 'Choose a valid build type.';
    if (budget_tier && !budgets.includes(budget_tier)) errors.budget_tier = 'Choose a valid budget tier.';
    if (typeof sort !== 'string' || !Object.hasOwn(sorts, sort)) errors.sort = 'Choose newest, rating, or likes.';
    if (Object.keys(errors).length) return res.status(400).json({ errors });
    try {
      const values = [];
      const where = [];
      const add = (sql, value) => { values.push(value); where.push(sql.replaceAll('?', `$${values.length}`)); };
      if (q.trim()) add('(b.title ILIKE ? OR b.description ILIKE ?)', `%${q.trim().replace(/[\\%_]/g, '\\$&')}%`);
      if (game) add('g.slug=?', game);
      if (build_type) add('b.build_type=?', build_type);
      if (budget_tier) add('b.budget_tier=?', budget_tier);
      if (tag) add('EXISTS (SELECT 1 FROM build_tags bt WHERE bt.build_id=b.id AND bt.tag=?)', tag);
      const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [originals, reposts] = await Promise.all([
        database.query(`${buildSelect} ${filter}`, values),
        database.query(`${repostSelect} ${filter}`, values),
      ]);
      const rows = [
        ...originals.rows.map(build => ({ ...build, is_repost: false })),
        ...reposts.rows.map(build => ({ ...build, is_repost: true })),
      ];
      const activityTime = build => new Date(build.reposted_at || build.created_at).getTime() || 0;
      rows.sort((a, b) => {
        if (sort === 'rating' && Number(b.avg_rating) !== Number(a.avg_rating)) {
          return Number(b.avg_rating) - Number(a.avg_rating);
        }
        if (sort === 'likes' && Number(b.like_count) !== Number(a.like_count)) {
          return Number(b.like_count) - Number(a.like_count);
        }
        return activityTime(b) - activityTime(a)
          || String(a.id).localeCompare(String(b.id))
          || String(a.reposted_by_id || '').localeCompare(String(b.reposted_by_id || ''));
      });
      res.json({ builds: rows });
    } catch (err) { next(err); }
  });
  router.get('/:id', async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ errors: { _general: 'Invalid build ID.' } });
    try {
      const { rows } = await database.query(`${buildSelect} WHERE b.id=$1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ errors: { _general: 'Build not found.' } });
      res.json({ build: rows[0] });
    } catch (err) { next(err); }
  });

  // Every mutating path locks the SAME owner row before reading build/pin state.
  // Concurrent creates, edits, pins and deletes cannot race around the cap.
  async function write(req, res, next, action) {
    if (action !== 'create' && !validId(req.params.id)) {
      return res.status(400).json({ errors: { _general: 'Invalid build ID.' } });
    }
    let client;
    let begun = false;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      begun = true;
      const owner = await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.session.userId]);
      if (!owner.rows.length) throw failure(401, { _general: 'Please log in again.' });
      let current;
      if (action !== 'create') {
        const result = await client.query('SELECT * FROM builds WHERE id=$1 FOR UPDATE', [req.params.id]);
        current = result.rows[0];
        if (!current) throw failure(404, { _general: 'Build not found.' });
        if (current.owner_id !== req.session.userId) throw failure(403, { _general: 'Only this build’s owner can change it.' });
      }
      if (action === 'delete') {
        await client.query('DELETE FROM builds WHERE id=$1 AND owner_id=$2', [current.id, req.session.userId]);
        await client.query('COMMIT');
        begun = false;
        return res.json({ deleted: true });
      }
      let data;
      if (action === 'pin') {
        if (typeof req.body?.is_pinned !== 'boolean') throw failure(400, { is_pinned: 'Pin must be true or false.' });
        data = { is_pinned: req.body.is_pinned };
      } else {
        data = await validateBuild(client, req.body, current, req.session.userId);
      }
      if (data.is_pinned && !current?.is_pinned) {
        const pins = await client.query('SELECT count(*)::int AS n FROM builds WHERE owner_id=$1 AND is_pinned', [req.session.userId]);
        if (pins.rows[0].n >= 3) throw failure(409, { is_pinned: 'You can pin at most 3 builds. Unpin one first.' });
      }
      let id = current?.id;
      if (action === 'create') {
        const result = await client.query(
          `INSERT INTO builds (owner_id,game_id,title,description,image_urls,budget_tier,build_type,is_pinned)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [req.session.userId, data.game_id, data.title, data.description, data.image_urls, data.budget_tier, data.build_type, data.is_pinned]);
        id = result.rows[0].id;
      } else if (action === 'update') {
        await client.query(
          `UPDATE builds SET game_id=$1,title=$2,description=$3,image_urls=$4,budget_tier=$5,
           build_type=$6,is_pinned=$7,updated_at=now() WHERE id=$8 AND owner_id=$9`,
          [data.game_id, data.title, data.description, data.image_urls, data.budget_tier, data.build_type, data.is_pinned, id, req.session.userId]);
      } else {
        await client.query('UPDATE builds SET is_pinned=$1,updated_at=now() WHERE id=$2 AND owner_id=$3', [data.is_pinned, id, req.session.userId]);
      }
      if (action === 'create' || action === 'update') {
        if (action === 'update') await client.query('DELETE FROM build_tags WHERE build_id=$1', [id]);
        for (const tag of data.tags) await client.query('INSERT INTO build_tags (build_id,tag) VALUES ($1,$2)', [id, tag]);
      }
      const result = await client.query(`${buildSelect} WHERE b.id=$1`, [id]);
      await client.query('COMMIT');
      begun = false;
      res.status(action === 'create' ? 201 : 200).json({ build: result.rows[0] });
    } catch (err) {
      if (begun) await client.query('ROLLBACK').catch(() => {});
      if (err.errors) return res.status(err.status).json({ errors: err.errors });
      next(err);
    } finally { client?.release(); }
  }
  router.post('/', requireLogin, (req, res, next) => write(req, res, next, 'create'));
  router.put('/:id', requireLogin, (req, res, next) => write(req, res, next, 'update'));
  router.delete('/:id', requireLogin, (req, res, next) => write(req, res, next, 'delete'));
  router.post('/:id/pin', requireLogin, (req, res, next) => write(req, res, next, 'pin'));
  return router;
}
module.exports = { createBuildsRouter };
