// QA demo content only. Never resets, deletes, or overwrites existing data.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool } = require('./pool');
const content = require('./content');

async function inspectSeed(client) {
  const { games, users, builds, sampleRatings, sampleLikes, sampleComments } = content;
  const gameRows = (await client.query('SELECT id, slug FROM games WHERE slug = ANY($1::text[])',
    [games.map(g => g.slug)])).rows;
  const userRows = (await client.query(
    `SELECT u.id, u.username, p.user_id AS profile_id FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id WHERE lower(u.username) = ANY($1::text[])`,
    [users.map(u => u.username.toLowerCase())])).rows;
  const buildRows = (await client.query(
    `SELECT b.id, b.title, u.username, g.slug FROM builds b
     JOIN users u ON u.id = b.owner_id JOIN games g ON g.id = b.game_id
     WHERE b.title = ANY($1::text[])`, [builds.map(b => b.title)])).rows;
  const gameIds = Object.fromEntries(gameRows.map(g => [g.slug, g.id]));
  const userIds = Object.fromEntries(userRows.map(u => [u.username.toLowerCase(), u.id]));
  const buildIds = Object.fromEntries(builds.map(b => [b.title, buildRows.find(row =>
    row.title === b.title && row.username.toLowerCase() === b.owner && row.slug === b.game)?.id]));
  const missing = [];
  for (const g of games) {
    if (!gameIds[g.slug]) { missing.push(`game:${g.slug}`); continue; }
    const tags = (await client.query('SELECT tag FROM game_tags WHERE game_id = $1', [gameIds[g.slug]])).rows;
    for (const tag of g.tags) if (!tags.some(t => t.tag === tag)) missing.push(`game-tag:${g.slug}`);
  }
  for (const u of users) {
    const row = userRows.find(r => r.username.toLowerCase() === u.username);
    if (!row) missing.push(`demo-user:${u.username}`);
    else if (!row.profile_id) missing.push(`demo-profile:${u.username}`);
  }
  for (const b of builds) {
    if (!buildIds[b.title]) { missing.push(`build:${b.title}`); continue; }
    const tags = (await client.query('SELECT tag FROM build_tags WHERE build_id = $1', [buildIds[b.title]])).rows;
    for (const tag of b.tags) if (!tags.some(t => t.tag === tag)) missing.push(`build-tag:${b.title}`);
  }
  const relationships = [
    ['ratings', sampleRatings, 'stars', 'stars'],
    ['likes', sampleLikes, null, null],
    ['comments', sampleComments, 'body', 'body'],
  ];
  for (const [table, samples, column, property] of relationships) {
    for (const s of samples) {
      if (!userIds[s.user] || !buildIds[s.build]) { missing.push(`sample:${table}`); continue; }
      // Identifiers are fixed by the allowlist above; all values are bound.
      const values = [userIds[s.user], buildIds[s.build]];
      if (column) values.push(s[property]);
      const { rows } = await client.query(
        `SELECT 1 FROM ${table} WHERE user_id = $1 AND build_id = $2${column ? ` AND ${column} = $3` : ''} LIMIT 1`, values);
      if (!rows.length) missing.push(`sample:${table}`);
    }
  }
  return {
    missing,
    hasSeedData: gameRows.length > 0 || userRows.length > 0 || Object.values(buildIds).some(Boolean),
    gameIds, userIds, buildIds,
  };
}

async function seedDatabase(database = pool, password = process.env.SEED_PASSWORD) {
  if (!password || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set SEED_PASSWORD in Replit Secrets (8+ characters, at most 72 bytes).');
  }
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(847216001)');
    const existing = await inspectSeed(client);
    if (existing.hasSeedData) {
      if (existing.missing.length) {
        throw new Error(`Incomplete demo seed: ${existing.missing.length} missing entries. No data changed; inspect QA before repairing.`);
      }
      await client.query('COMMIT');
      return { status: 'verified', games: 8, users: 5, builds: 10 };
    }

    const gameIds = {};
    const userIds = {};
    const buildIds = {};
    for (const g of content.games) {
      const { rows } = await client.query(
        `INSERT INTO games (slug, name, genre, release_year, description, is_sandbox)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [g.slug, g.name, g.genre, g.release_year, g.description, g.is_sandbox]);
      gameIds[g.slug] = rows[0].id;
      for (const tag of g.tags) {
        await client.query('INSERT INTO game_tags (game_id, tag) VALUES ($1,$2)', [rows[0].id, tag]);
      }
    }
    for (const u of content.users) {
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id`,
        [u.username, u.email.toLowerCase(), hash, u.username === 'abdul_builds' ? 'admin' : 'member']);
      userIds[u.username] = rows[0].id;
      await client.query(
        'INSERT INTO profiles (user_id, display_name, bio, favorite_game_id) VALUES ($1,$2,$3,$4)',
        [rows[0].id, u.display_name, u.bio, gameIds.bloxburg]);
    }
    for (const b of content.builds) {
      const { rows } = await client.query(
        `INSERT INTO builds (owner_id, game_id, title, description, budget_tier, build_type, is_pinned)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [userIds[b.owner], gameIds[b.game], b.title, b.description, b.budget_tier, b.build_type, b.pinned]);
      buildIds[b.title] = rows[0].id;
      for (const tag of b.tags) {
        await client.query('INSERT INTO build_tags (build_id, tag) VALUES ($1,$2)', [rows[0].id, tag]);
      }
    }
    for (const s of content.sampleRatings) {
      await client.query('INSERT INTO ratings (user_id, build_id, stars) VALUES ($1,$2,$3)',
        [userIds[s.user], buildIds[s.build], s.stars]);
    }
    for (const s of content.sampleLikes) {
      await client.query('INSERT INTO likes (user_id, build_id) VALUES ($1,$2)', [userIds[s.user], buildIds[s.build]]);
    }
    for (const s of content.sampleComments) {
      await client.query('INSERT INTO comments (build_id, user_id, body) VALUES ($1,$2,$3)',
        [buildIds[s.build], userIds[s.user], s.body]);
    }
    const check = await inspectSeed(client);
    if (check.missing.length) throw new Error('Demo seed verification failed; all changes rolled back.');
    await client.query('COMMIT');
    return { status: 'seeded', games: 8, users: 5, builds: 10 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const run = process.env.NODE_ENV === 'production'
    ? Promise.reject(new Error('Demo seeding is QA-only. Production was not changed.'))
    : seedDatabase();
  run.then(result => console.info('QA demo seed:', result))
    .catch(err => {
      // Only these deliberately authored messages are safe to print.
      const safe = /^(Set SEED_PASSWORD|Incomplete demo seed|Demo seed verification|Demo seeding is QA-only)/.test(err.message);
      console.error(safe ? err.message : 'Seeding failed; transaction rolled back. Inspect QA schema/configuration.');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
module.exports = { seedDatabase, inspectSeed };
