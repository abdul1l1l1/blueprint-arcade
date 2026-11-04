// Seeds demo data from db/content.js. Safe to run once; skips if games already exist.
// Usage: npm run db:seed
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./pool');
const { games, users, builds, sampleRatings, sampleLikes, sampleComments } = require('./content');

const GAME_ID = {};   // slug -> id
const USER_ID = {};   // username -> id
const BUILD_ID = {};  // title -> id

async function main() {
  const existing = await pool.query('SELECT COUNT(*)::int AS n FROM games');
  if (existing.rows[0].n > 0) {
    console.log('Database already seeded — skipping. (Drop tables with db:init to reseed.)');
    await pool.end();
    return;
  }

  for (const g of games) {
    const r = await pool.query(
      `INSERT INTO games (slug, name, genre, release_year, description, is_sandbox)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [g.slug, g.name, g.genre, g.release_year, g.description, g.is_sandbox]
    );
    GAME_ID[g.slug] = r.rows[0].id;
    for (const tag of g.tags) {
      await pool.query('INSERT INTO game_tags (game_id, tag) VALUES ($1,$2)', [GAME_ID[g.slug], tag]);
    }
  }

  for (const u of users) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'demo-password-1', 10);
    const r = await pool.query(
      `INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id`,
      [u.username, u.email, hash, u.username === 'abdul_builds' ? 'admin' : 'member']
    );
    USER_ID[u.username] = r.rows[0].id;
    await pool.query(
      'INSERT INTO profiles (user_id, display_name, bio, favorite_game_id) VALUES ($1,$2,$3,$4)',
      [USER_ID[u.username], u.display_name, u.bio, GAME_ID['bloxburg']]
    );
  }

  for (const b of builds) {
    const r = await pool.query(
      `INSERT INTO builds (owner_id, game_id, title, description, budget_tier, build_type, is_pinned)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [USER_ID[b.owner], GAME_ID[b.game], b.title, b.description, b.budget_tier, b.build_type, b.pinned]
    );
    BUILD_ID[b.title] = r.rows[0].id;
    for (const tag of b.tags) {
      await pool.query('INSERT INTO build_tags (build_id, tag) VALUES ($1,$2)', [BUILD_ID[b.title], tag]);
    }
  }

  for (const s of sampleRatings) {
    await pool.query('INSERT INTO ratings (user_id, build_id, stars) VALUES ($1,$2,$3)', [USER_ID[s.user], BUILD_ID[s.build], s.stars]);
  }
  for (const s of sampleLikes) {
    await pool.query('INSERT INTO likes (user_id, build_id) VALUES ($1,$2)', [USER_ID[s.user], BUILD_ID[s.build]]);
  }
  for (const s of sampleComments) {
    await pool.query('INSERT INTO comments (build_id, user_id, body) VALUES ($1,$2,$3)', [BUILD_ID[s.build], USER_ID[s.user], s.body]);
  }

  console.log('Seeded ' + games.length + ' games, ' + users.length + ' users, ' + builds.length + ' builds.');
  await pool.end();
}

main().catch((err) => {
  console.error('db:seed failed:', err.message);
  process.exit(1);
});
