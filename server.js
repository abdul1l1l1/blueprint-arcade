// Blueprint Arcade — Express entry point
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./db/pool');

const authRoutes = require('./routes/auth');
const buildRoutes = require('./routes/builds');
const gameRoutes = require('./routes/games');
const socialRoutes = require('./routes/social');
const statRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false }));

const sessionStore = new pgSession({ pool, tableName: 'session' });

async function ensureSessionTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    ) WITH (OIDS=FALSE)`);
  await pool.query('ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE')
    .catch(() => {});
}

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// JSON error handler for API routes (parameterized SQL + role checks upstream)
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.error(err);
    return res.status(500).json({ errors: { _general: 'Something went wrong. Please try again' } });
  }
  next(err);
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', app: 'Blueprint Arcade', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'ok', app: 'Blueprint Arcade', db: 'unavailable', time: new Date().toISOString() });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/builds', buildRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/stats', statRoutes);

app.use(express.static(path.join(__dirname, 'public')));

// Static page routes (one page per domain view, quiz-quest style)
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));            // Build Showcase (landing)
app.get('/games.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));   // Game Directory
app.get('/game.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')));     // Game Detail
app.get('/compare.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'compare.html'))); // Compare Games
app.get('/top10.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'top10.html')));   // Top 10 Builds
app.get('/post.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'post.html')));     // Post a Build
app.get('/profile.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html'))); // My Profile

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureSessionTable()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log('Blueprint Arcade server running on port ' + PORT + ' (sessions ready)');
    });
  })
  .catch(err => {
    console.error('Startup failed: could not prepare session table:', err);
    process.exit(1);
  });
