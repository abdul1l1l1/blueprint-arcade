const express = require('express');
const { pool } = require('../db/pool');

async function recordBuildNotification(database, { recipientId, actorId, buildId, eventType }) {
  if (!recipientId || String(recipientId) === String(actorId)) return;
  await database.query(
    `INSERT INTO notifications(recipient_id,actor_id,build_id,event_type)
     VALUES($1,$2,$3,$4)`,
    [recipientId, actorId, buildId, eventType],
  );
}

function createNotificationsRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!req.session.userId) {
      return res.status(401).json({ errors: { _general: 'You must be logged in.' } });
    }
    next();
  });

  router.get('/unread-count', async (req, res, next) => {
    try {
      const { rows: [result] } = await database.query(
        'SELECT count(*)::int AS unread_count FROM notifications WHERE recipient_id=$1 AND read_at IS NULL',
        [req.session.userId],
      );
      res.json({ unread_count: result.unread_count });
    } catch (error) { next(error); }
  });

  router.post('/open', async (req, res, next) => {
    let client;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      await client.query(
        `UPDATE notifications SET read_at=now()
         WHERE recipient_id=$1 AND read_at IS NULL`,
        [req.session.userId],
      );
      const { rows } = await client.query(
        `SELECT n.id,n.build_id AS "buildId",n.event_type AS "eventType",
            n.created_at AS "createdAt",n.read_at AS "readAt",
            COALESCE(NULLIF(p.display_name,''),u.username,'Someone') AS actor,
            b.title AS "buildTitle"
         FROM notifications n
         JOIN builds b ON b.id=n.build_id
         LEFT JOIN users u ON u.id=n.actor_id
         LEFT JOIN profiles p ON p.user_id=u.id
         WHERE n.recipient_id=$1
         ORDER BY n.created_at DESC,n.id DESC`,
        [req.session.userId],
      );
      await client.query('COMMIT');
      res.json({ notifications: rows, unread_count: 0 });
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}

module.exports = { createNotificationsRouter, recordBuildNotification };
