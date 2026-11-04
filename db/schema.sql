-- Blueprint Arcade schema (plain PostgreSQL, no RLS — access control is server-side)

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preserve display case; identifiers must still be unique ignoring case.
CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci ON users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci ON users (lower(email));

-- Initialized explicitly with db:init, never by a production startup hook.
CREATE TABLE IF NOT EXISTS "session" (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS session_expire_idx ON "session" (expire);

CREATE TABLE IF NOT EXISTS profiles (
  user_id   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio        TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  favorite_game_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL UNIQUE,
  genre       TEXT NOT NULL,
  release_year INTEGER,
  description TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  is_sandbox  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-game vocabulary (layer 2 of the 3-layer tag system)
CREATE TABLE IF NOT EXISTS game_tags (
  id       SERIAL PRIMARY KEY,
  game_id  INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  UNIQUE (game_id, tag)
);

CREATE TABLE IF NOT EXISTS builds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_urls  TEXT[] NOT NULL DEFAULT '{}',
  budget_tier TEXT NOT NULL CHECK (budget_tier IN ('starter', 'mid', 'luxury', 'unlimited')),
  build_type  TEXT NOT NULL CHECK (build_type IN ('freeform', 'interior', 'renovation', 'city-planning', 'sandbox')),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Build tags (layer 3)
CREATE TABLE IF NOT EXISTS build_tags (
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (build_id, tag)
);

CREATE TABLE IF NOT EXISTS ratings (
  id       SERIAL PRIMARY KEY,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_id UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  stars    INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, build_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_id   UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  build_id   UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  build_id   UUID NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, build_id)
);

-- Stats views
CREATE OR REPLACE VIEW build_stats AS
SELECT b.id AS build_id,
       COALESCE(AVG(r.stars), 0) AS avg_rating,
       COUNT(DISTINCT r.user_id) AS rating_count,
       COUNT(DISTINCT l.user_id) AS like_count,
       COUNT(DISTINCT c.id) AS comment_count
FROM builds b
LEFT JOIN ratings r ON r.build_id = b.id
LEFT JOIN likes l   ON l.build_id = b.id
LEFT JOIN comments c ON c.build_id = b.id
GROUP BY b.id;

CREATE OR REPLACE VIEW game_stats AS
SELECT g.id AS game_id,
       COUNT(DISTINCT b.id) AS build_count,
       COALESCE(AVG(bs.avg_rating), 0) AS avg_rating
FROM games g
LEFT JOIN builds b ON b.game_id = g.id
LEFT JOIN build_stats bs ON bs.build_id = b.id
GROUP BY g.id;

-- Indexes for search/filter/sort
CREATE INDEX IF NOT EXISTS idx_builds_game ON builds(game_id);
CREATE INDEX IF NOT EXISTS idx_builds_owner ON builds(owner_id);
CREATE INDEX IF NOT EXISTS idx_builds_title_trgm ON builds (lower(title));
CREATE INDEX IF NOT EXISTS idx_comments_build ON comments(build_id);
CREATE INDEX IF NOT EXISTS idx_build_tags_tag ON build_tags(tag);
