const express = require('express');
const { pool } = require('../db/pool');
const { validId } = require('./build-data');

function createReportsRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  function requireLogin(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ errors: { _general: 'Log in to report content.' } });
    next();
  }

  async function createReport(req, res, next, targetType) {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason || reason.length > 500 || reason.includes('\0')) {
      return res.status(400).json({ errors: { reason: 'Enter a reason of 1–500 characters.' } });
    }

    try {
      let buildId = null;
      let commentId = null;
      if (targetType === 'build') {
        if (!validId(req.params.id)) return res.status(400).json({ errors: { target: 'Invalid build.' } });
        const { rows: [build] } = await database.query('SELECT id, owner_id FROM builds WHERE id=$1', [req.params.id]);
        if (!build) return res.status(404).json({ errors: { target: 'Build not found.' } });
        if (String(build.owner_id) === String(req.session.userId)) {
          return res.status(403).json({ errors: { target: 'You cannot report your own build.' } });
        }
        buildId = build.id;
      } else {
        if (!/^[1-9]\d*$/.test(String(req.params.id)) || !Number.isSafeInteger(Number(req.params.id))) {
          return res.status(400).json({ errors: { target: 'Invalid comment.' } });
        }
        const { rows: [comment] } = await database.query('SELECT id, user_id FROM comments WHERE id=$1', [Number(req.params.id)]);
        if (!comment) return res.status(404).json({ errors: { target: 'Comment not found.' } });
        if (String(comment.user_id) === String(req.session.userId)) {
          return res.status(403).json({ errors: { target: 'You cannot report your own comment.' } });
        }
        commentId = comment.id;
      }

      await database.query(
        `INSERT INTO reports (reporter_id, target_type, build_id, comment_id, reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.session.userId, targetType, buildId, commentId, reason],
      );
      res.status(201).json({ reported: true });
    } catch (error) { next(error); }
  }

  router.post('/builds/:id', requireLogin, (req, res, next) => createReport(req, res, next, 'build'));
  router.post('/comments/:id', requireLogin, (req, res, next) => createReport(req, res, next, 'comment'));

  router.get('/moderation', async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ errors: { _general: 'Log in as an administrator.' } });
    try {
      const { rows: [account] } = await database.query('SELECT role FROM users WHERE id=$1', [req.session.userId]);
      if (account?.role !== 'admin') return res.status(403).json({ errors: { _general: 'Administrator access required.' } });
      const { rows } = await database.query(
        `SELECT r.id, r.target_type, r.reason, r.created_at, ru.username AS reporter_username,
                COALESCE(b.id, c.build_id) AS build_id, b.title AS build_title,
                c.id AS comment_id, c.body AS comment_body,
                COALESCE(bo.username, co.username) AS content_owner_username
         FROM reports r
         JOIN users ru ON ru.id=r.reporter_id
         LEFT JOIN builds b ON b.id=r.build_id
         LEFT JOIN comments c ON c.id=r.comment_id
         LEFT JOIN users bo ON bo.id=b.owner_id
         LEFT JOIN users co ON co.id=c.user_id
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT 100`,
      );
      res.json({ reports: rows });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createReportsRouter };
