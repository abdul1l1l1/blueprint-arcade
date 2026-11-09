// One Express server serves the plain frontend and API.
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const { pool } = require('./db/pool');
const { createAuthRouter, COOKIE_NAME, cookieOptions } = require('./routes/auth');

function createApp({ database = pool, store, env = process.env } = {}) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is required; configure it in Replit Secrets.');
  const app = express();
  app.disable('x-powered-by');
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(session({
    name: COOKIE_NAME,
    store: store || new PgSession({ pool: database, tableName: 'session', createTableIfMissing: false }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { ...cookieOptions, secure: env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 },
  }));

  app.get(['/api/health', '/api/healthz'], async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      await database.query('SELECT 1');
      res.json({ status: 'ok', app: 'Blueprint Arcade', db: 'connected', time: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'error', app: 'Blueprint Arcade', db: 'unavailable' });
    }
  });
  app.use('/api/auth', createAuthRouter(database));
  // Completed phases share the configured QA/runtime database dependency.
  app.use('/api/builds', require('./routes/builds').createBuildsRouter(database));
  app.use('/api/games', require('./routes/games').createGamesRouter(database));
  app.use('/api/social', require('./routes/social').createSocialRouter(database));
  app.use('/api/stats', require('./routes/stats').createStatsRouter(database));
  app.use('/api', (req, res) => res.status(404).json({ errors: { _general: 'API endpoint not found.' } }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/*splat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  // Must follow body parsing AND all API routes to handle forwarded errors.
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (!req.path.startsWith('/api/')) return next(err);
    const status = err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500;
    const message = status === 400 ? 'Invalid JSON request.'
      : status === 413 ? 'Request is too large.' : 'Something went wrong. Please try again.';
    // Do not log request bodies, SQL errors, session contents, or credentials.
    console.error('API request failed', { status, path: req.path });
    res.status(status).json({ errors: { _general: message } });
  });
  return app;
}

async function start() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const app = createApp();
  // DDL belongs to db:init, not startup (especially not production startup).
  await pool.query('SELECT sid, sess, expire FROM "session" LIMIT 0');
  const server = app.listen(process.env.PORT || 5000, '0.0.0.0', () => {
    console.info('Blueprint Arcade is running (database and session storage ready).');
  });
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  return server;
}

if (require.main === module) {
  start().catch(() => {
    console.error('Startup failed. Configure DATABASE_URL and SESSION_SECRET, and run db:init in QA.');
    process.exit(1);
  });
}
module.exports = { createApp, start };
