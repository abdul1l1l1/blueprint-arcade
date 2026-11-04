-- Blueprint Arcade — Database Schema (PostgreSQL / Supabase)
-- Fan site for architecture/build games: game directory, comparison tool,
-- community build showcase with ratings, likes, comments, favorites, pins.

create extension if not exists "uuid-ossp";

-- ============ USERS ============
create table users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

-- ============ GAMES ============
create table games (
  id serial primary key,
  title text unique not null,
  slug text unique not null,
  variant text not null check (variant in
    ('Freeform','Interior','Renovation','City Planning','Sandbox')),
  platforms text not null,          -- e.g. 'PC, Mobile, Console'
  price text not null,              -- e.g. 'Freemium', 'Free base', '$39.99'
  description text not null,
  hero_image text,
  is_sandbox boolean default false, -- Minecraft-style sandbox picks
  created_at timestamptz default now()
);

-- Per-game style tag vocabulary (e.g. Bloxburg: 'Modern Villa', 'No-Cheats')
create table game_tags (
  id serial primary key,
  game_id int not null references games(id) on delete cascade,
  name text not null,
  unique (game_id, name)
);

-- ============ BUILDS (primary CRUD entity) ============
create table builds (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  game_id int not null references games(id),
  title text not null,
  description text not null,
  image_url text not null,
  budget_tier text check (budget_tier in ('Starter','Mid','Luxury')) default 'Mid',
  is_pinned boolean default false,  -- pinned to owner's profile (max 3, enforced in app)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Which style tags a build uses (tags come from the game's vocabulary)
create table build_tags (
  build_id int not null references builds(id) on delete cascade,
  tag_id int not null references game_tags(id) on delete cascade,
  primary key (build_id, tag_id)
);

-- ============ RATINGS (1-5 stars, unique per user per item) ============
create table ratings (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  build_id int references builds(id) on delete cascade,
  game_id int references games(id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  check (num_nonnulls(build_id, game_id) = 1), -- rate exactly one thing
  unique (user_id, build_id),
  unique (user_id, game_id)
);

-- ============ LIKES (builds only) ============
create table likes (
  user_id uuid not null references users(id) on delete cascade,
  build_id int not null references builds(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, build_id)
);

-- ============ FAVORITES (games or builds) ============
create table favorites (
  user_id uuid not null references users(id) on delete cascade,
  game_id int references games(id) on delete cascade,
  build_id int references builds(id) on delete cascade,
  created_at timestamptz default now(),
  check (num_nonnulls(game_id, build_id) = 1),
  primary key (user_id, game_id, build_id)
);

-- ============ COMMENTS (on games or builds) ============
create table comments (
  id serial primary key,
  user_id uuid not null references users(id) on delete cascade,
  build_id int references builds(id) on delete cascade,
  game_id int references games(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  check (num_nonnulls(build_id, game_id) = 1),
  created_at timestamptz default now()
);

-- ============ VIEWS (computed aggregates) ============
create view game_stats as
  select g.id, g.title, g.variant,
         coalesce(round(avg(r.stars)::numeric, 1), 0) as rating_avg,
         count(distinct r.id) as rating_count,
         count(distinct b.id) as build_count
  from games g
  left join ratings r on r.game_id = g.id
  left join builds b on b.game_id = g.id
  group by g.id;

create view build_stats as
  select b.id, b.title, b.is_pinned,
         coalesce(round(avg(r.stars)::numeric, 1), 0) as rating_avg,
         (select count(*) from likes l where l.build_id = b.id) as like_count,
         (select count(*) from comments c where c.build_id = b.id) as comment_count
  from builds b
  left join ratings r on r.build_id = b.id
  group by b.id;

-- ============ INDEXES for search & filtering ============
create index idx_builds_game on builds(game_id);
create index idx_builds_user on builds(user_id);
create index idx_games_variant on games(variant);
create index idx_comments_build on comments(build_id);

-- ============ ROW LEVEL SECURITY (protected actions) ============
alter table builds enable row level security;
alter table ratings enable row level security;
alter table likes enable row level security;
alter table favorites enable row level security;
alter table comments enable row level security;

-- anyone can read; only logged-in users can write;
-- only the owner can update/delete/pin their builds.
create policy "builds readable by all" on builds for select using (true);
create policy "users insert own builds" on builds for insert with check (auth.uid() = user_id);
create policy "owners update builds" on builds for update using (auth.uid() = user_id);
create policy "owners delete builds" on builds for delete using (auth.uid() = user_id);

create policy "ratings readable" on ratings for select using (true);
create policy "users rate when logged in" on ratings for insert with check (auth.uid() = user_id);

create policy "likes readable" on likes for select using (true);
create policy "users like when logged in" on likes for insert with check (auth.uid() = user_id);
create policy "users unlike own" on likes for delete using (auth.uid() = user_id);

create policy "favorites readable" on favorites for select using (true);
create policy "users favorite when logged in" on favorites for insert with check (auth.uid() = user_id);
create policy "users unfavorite own" on favorites for delete using (auth.uid() = user_id);

create policy "comments readable" on comments for select using (true);
create policy "users comment when logged in" on comments for insert with check (auth.uid() = user_id);
create policy "owners delete comments" on comments for delete using (auth.uid() = user_id);
