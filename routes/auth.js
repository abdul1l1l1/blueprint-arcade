// Authentication: register, login, logout, current user (bcrypt, express-session)
const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

const router = express.Router();

function publicUser(row) {
  return { id: row.id, username: row.username, role: row.role, displayName: row.display_name };
}

router.post('/register', async (req, res, next) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const displayName = typeof req.body?.displayName === 'string' && req.body.displayName.trim()
      ? req.body.displayName.trim() : username;

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ errors: { username: 'Username must be 3-20 letters, numbers or underscores.' } });
    }
    if (!/^[^@s]+@[^@s]+.[^@s]+$/.test(email)) {
      return res.status(400).json({ errors: { email: 'Enter a valid email address.' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ errors: { password: 'Password must be at least 8 characters.' } });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'member')
       RETURNING id, username, role`,
      [username, email, hash]
    ).catch((err) => {
      if (err.code === '23505') return null; // unique violation
      throw err;
    });
    if (!result) {
      return res.status(409).json({ errors: { username: 'That username or email is already taken.' } });
    }

    const user = result.rows[0];
    await pool.query('INSERT INTO profiles (user_id, display_name) VALUES ($1, $2)', [user.id, displayName]);

    req.session.userId = user.id;
    res.status(201).json({ user: { id: user.id, username: user.username, role: user.role, displayName } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      return res.status(400).json({ errors: { _general: 'Enter your username and password.' } });
    }

    const { rows } = await pool.query(
      'SELECT u.id, u.username, u.role, u.password_hash, p.display_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.username = $1 OR u.email = $1',
      [username.toLowerCase() === username ? username : username.toLowerCase()]
    );

    const user = rows[0];
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
      return res.status(401).json({ errors: { _general: 'Invalid username or password.' } });
    }

    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const { rows } = await pool.query(
      'SELECT u.id, u.username, u.role, p.display_name FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = $1',
      [req.session.userId]
    );
    if (!rows[0]) { req.session.destroy(() => {}); return res.json({ user: null }); }
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
