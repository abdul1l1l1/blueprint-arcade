// Local session authentication is the explicit project requirement.
const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

const COOKIE_NAME = 'blueprint.sid';
const cookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' };
const publicUser = (row) => ({
  id: row.id, username: row.username, role: row.role, displayName: row.display_name,
});
const sessionCall = (session, method) => new Promise((resolve, reject) => {
  session[method]((err) => err ? reject(err) : resolve());
});

async function signIn(req, userId) {
  await sessionCall(req.session, 'regenerate');
  req.session.userId = userId;
  await sessionCall(req.session, 'save');
}

function createAuthRouter(database = pool) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.post('/register', async (req, res, next) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = typeof req.body?.displayName === 'string' && req.body.displayName.trim()
      ? req.body.displayName.trim() : username;
    const errors = {};
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      errors.username = 'Username must be 3-20 letters, numbers or underscores.';
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
    // bcrypt uses at most 72 bytes; reject longer input instead of silently truncating it.
    if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      errors.password = 'Password must be at least 8 characters and at most 72 bytes.';
    }
    if (displayName.length > 80) errors.displayName = 'Display name must be 80 characters or fewer.';
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    let client;
    let user;
    try {
      const hash = await bcrypt.hash(password, 10);
      client = await database.connect();
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, 'member') RETURNING id, username, role`,
        [username, email, hash]
      );
      user = rows[0];
      await client.query('INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)', [user.id, displayName]);
      await client.query('COMMIT');
    } catch (err) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') {
        return res.status(409).json({ errors: { _general: 'That username or email is already taken.' } });
      }
      return next(err);
    } finally {
      if (client) client.release();
    }
    try {
      await signIn(req, user.id);
      res.status(201).json({ user: publicUser({ ...user, display_name: displayName }) });
    } catch (err) { next(err); }
  });

  router.post('/login', async (req, res, next) => {
    try {
      const identifier = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!identifier || !password) {
        return res.status(400).json({ errors: { _general: 'Enter your username or email and password.' } });
      }
      if (Buffer.byteLength(password, 'utf8') > 72) {
        return res.status(401).json({ errors: { _general: 'Invalid username or password.' } });
      }
      const { rows } = await database.query(
        `SELECT u.id, u.username, u.role, u.password_hash, p.display_name
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id
         WHERE lower(u.username) = $1 OR lower(u.email) = $1`, [identifier]
      );
      const user = rows[0];
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).json({ errors: { _general: 'Invalid username or password.' } });
      }
      await signIn(req, user.id);
      res.json({ user: publicUser(user) });
    } catch (err) { next(err); }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      await sessionCall(req.session, 'destroy');
      res.clearCookie(COOKIE_NAME, cookieOptions);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });

  router.get('/me', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (!req.session.userId) return res.json({ user: null });
      const { rows } = await database.query(
        `SELECT u.id, u.username, u.role, p.display_name FROM users u
         LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1`, [req.session.userId]
      );
      if (!rows[0]) {
        await sessionCall(req.session, 'destroy');
        res.clearCookie(COOKIE_NAME, cookieOptions);
        return res.json({ user: null });
      }
      res.json({ user: publicUser(rows[0]) });
    } catch (err) { next(err); }
  });

  router.get('/me/data', async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ errors: { _general: 'You must be logged in to download your data.' } });
    }

    let client;
    let transaction = false;
    try {
      client = await database.connect();
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      transaction = true;

      const accountResult = await client.query(
        `SELECT u.id AS "id", u.username AS "username", u.email AS "email", u.role AS "role",
           u.created_at AS "createdAt",
           p.display_name AS "displayName", p.bio AS "bio", p.avatar_url AS "avatarUrl",
           p.favorite_game_id AS "favoriteGameId", p.created_at AS "profileCreatedAt"
         FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,
        [req.session.userId]
      );
      const account = accountResult.rows[0];
      if (!account) {
        await client.query('COMMIT');
        transaction = false;
        return res.status(401).json({ errors: { _general: 'You must be logged in to download your data.' } });
      }

      const builds = await client.query(
        `SELECT b.id, b.game_id AS "gameId", b.title, b.description,
           b.image_urls AS "imageReferences", b.budget_tier AS "budgetTier",
           b.build_type AS "buildType", b.is_pinned AS "isPinned",
           b.created_at AS "createdAt", b.updated_at AS "updatedAt",
           ARRAY(SELECT bt.tag FROM build_tags bt WHERE bt.build_id=b.id ORDER BY bt.tag) AS tags
         FROM builds b WHERE b.owner_id=$1 ORDER BY b.created_at,b.id`,
        [req.session.userId]
      );
      const comments = await client.query(
        `SELECT id, build_id AS "buildId", body, created_at AS "createdAt"
         FROM comments WHERE user_id=$1 ORDER BY created_at,id`,
        [req.session.userId]
      );
      const ratings = await client.query(
        `SELECT id, build_id AS "buildId", stars, created_at AS "createdAt"
         FROM ratings WHERE user_id=$1 ORDER BY created_at,id`,
        [req.session.userId]
      );
      const likes = await client.query(
        `SELECT build_id AS "buildId", created_at AS "createdAt"
         FROM likes WHERE user_id=$1 ORDER BY created_at,build_id`,
        [req.session.userId]
      );
      const favorites = await client.query(
        `SELECT build_id AS "buildId", created_at AS "createdAt"
         FROM favorites WHERE user_id=$1 ORDER BY created_at,build_id`,
        [req.session.userId]
      );

      await client.query('COMMIT');
      transaction = false;
      const { id, username, email, role, createdAt, displayName, bio, avatarUrl, favoriteGameId, profileCreatedAt } = account;
      const exportData = {
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        account: { id, username, email, role, createdAt },
        profile: displayName === null ? null : {
          displayName,
          bio,
          avatarUrl,
          favoriteGameId,
          createdAt: profileCreatedAt,
        },
        builds: builds.rows,
        comments: comments.rows,
        ratings: ratings.rows,
        likes: likes.rows,
        favorites: favorites.rows,
      };
      res.set('X-Content-Type-Options', 'nosniff');
      res.attachment('blueprint-arcade-my-data.json').send(JSON.stringify(exportData, null, 2));
    } catch (err) {
      if (transaction) await client.query('ROLLBACK').catch(() => {});
      next(err);
    } finally {
      client?.release();
    }
  });
  return router;
}

module.exports = { createAuthRouter, COOKIE_NAME, cookieOptions };
