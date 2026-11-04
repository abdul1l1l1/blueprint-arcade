-- Blueprint Arcade — Seed Data
-- 8 real games (7 realistic + Minecraft as the sandbox pick)
-- ~10 credited example builds so the showcase is alive on day one.

-- ============ GAMES ============
insert into games (title, slug, variant, platforms, price, description, is_sandbox) values
('Welcome to Bloxburg', 'welcome-to-bloxburg', 'Freeform', 'PC, Mobile, Console (Roblox)', 'Freemium',
 'Build houses, decorate interiors, and live a virtual life in the most popular architecture game on Roblox. Deep freeform building tools with an active speedbuild community.', false),
('The Sims 4', 'the-sims-4', 'Interior', 'PC, Console, Mobile', 'Free base game',
 'The life sim where build mode is legend. Design homes down to the wallpaper, from tiny homes to mansions. Officially began as an architecture simulator.', false),
('House Flipper', 'house-flipper', 'Renovation', 'PC, Console, Mobile', 'Paid',
 'Buy run-down houses, gut them, and renovate for profit. The most satisfying interior renovation loop in gaming.', false),
('Cities: Skylines II', 'cities-skylines-ii', 'City Planning', 'PC', 'Paid',
 'The modern city-builder. Zone, road, and plan entire metropolises with realistic traffic, services, and growth simulation.', false),
('Manor Lords', 'manor-lords', 'City Planning', 'PC', 'Paid',
 'Medieval city-builder with organic gridless street growth and gorgeous period-accurate visuals.', false),
('Tiny Glade', 'tiny-glade', 'Freeform', 'PC', 'Paid',
 'A cozy freeform castle-building toy. Doodle charming cottages, gardens, and castles and watch them come alive.', false),
('Hometopia', 'hometopia', 'Freeform', 'PC', 'Free',
 'A free collaborative home-building and interior design game — build with friends and share designs.', false),
('Minecraft', 'minecraft', 'Sandbox', 'PC, Console, Mobile', 'Paid',
 'The sandbox original. Endless block building — the pick for players who love freeform creation over realism.', true);

-- ============ PER-GAME TAG VOCABULARIES ============
insert into game_tags (game_id, name)
select g.id, t.name from games g
join (values
 ('Welcome to Bloxburg', 'Modern Villa'), ('Welcome to Bloxburg', 'Ranch'),
 ('Welcome to Bloxburg', 'No-Cheats'), ('Welcome to Bloxburg', 'Speedbuild'),
 ('Welcome to Bloxburg', 'Budget Build'), ('Welcome to Bloxburg', 'Roleplay Home'),
 ('The Sims 4', 'Cottagecore'), ('The Sims 4', 'Tiny Home'),
 ('The Sims 4', 'Shell'), ('The Sims 4', 'Mansion'),
 ('House Flipper', 'Renovation'), ('House Flipper', 'Loft'), ('House Flipper', 'Garden'),
 ('Cities: Skylines II', 'Grid'), ('Cities: Skylines II', 'Organic'), ('Cities: Skylines II', 'Downtown'),
 ('Manor Lords', 'Medieval'), ('Manor Lords', 'Village'),
 ('Tiny Glade', 'Cottagecore'), ('Tiny Glade', 'Castle'), ('Tiny Glade', 'Cozy'),
 ('Hometopia', 'Interior'), ('Hometopia', 'Collab'),
 ('Minecraft', 'Starter Base'), ('Minecraft', 'Medieval'), ('Minecraft', 'Modern')
) as t(game_name, name) on t.game_name = g.title;

-- ============ DEMO USERS (seed builders) ============
-- In production these come from Supabase Auth; ids here are stable for seeds.
insert into users (id, username, email, password_hash, bio) values
 ('00000000-0000-4000-a000-000000000001', 'abdul_builds', 'abdul@blueprintarcade.app', 'seed',
  'Bloxburg builder — modern builds, no-cheats only.'),
 ('00000000-0000-4000-a000-000000000002', 'simmer99', 'simmer99@blueprintarcade.app', 'seed',
  'Tiny home addict. Sims 4 builder since 2014.'),
 ('00000000-0000-4000-a000-000000000003', 'flipking', 'flipking@blueprintarcade.app', 'seed',
  'If it is ugly, I flip it.'),
 ('00000000-0000-4000-a000-000000000004', 'plannerphil', 'phil@blueprintarcade.app', 'seed',
  'Real-life city planner. I build like it is zoning day.'),
 ('00000000-0000-4000-a000-000000000005', 'cozyqueen', 'cozy@blueprintarcade.app', 'seed',
  'Cottagecore forever. Tiny Glade and Sims.');

-- ============ SEED BUILDS (credited examples) ============
insert into builds (user_id, game_id, title, description, image_url, budget_tier, is_pinned) values
 ('00000000-0000-4000-a000-000000000001', (select id from games where slug='welcome-to-bloxburg'),
  'Sunset Manor', 'Two-story modern manor, 4 bed / 4 bath, infinity pool. Built fully no-cheats.',
  '/img/seed/sunset-manor.jpg', 'Luxury', true),
 ('00000000-0000-4000-a000-000000000001', (select id from games where slug='welcome-to-bloxburg'),
  'Beach A-Frame', 'Cozy A-frame right on the sand. Starter-budget friendly.',
  '/img/seed/beach-aframe.jpg', 'Starter', true),
 ('00000000-0000-4000-a000-000000000001', (select id from games where slug='welcome-to-bloxburg'),
  'Suburban Ranch', 'Classic family ranch with an open-plan kitchen.',
  '/img/seed/suburban-ranch.jpg', 'Mid', true),
 ('00000000-0000-4000-a000-000000000002', (select id from games where slug='the-sims-4'),
  'Tiny Town Rowhome', 'A fully functional tiny home under 4x4 tiles — harder than it looks.',
  '/img/seed/tiny-rowhome.jpg', 'Starter', false),
 ('00000000-0000-4000-a000-000000000002', (select id from games where slug='the-sims-4'),
  'Mill Mansion', 'Grand cottagecore estate with a working mill garden.',
  '/img/seed/mill-mansion.jpg', 'Luxury', false),
 ('00000000-0000-4000-a000-000000000003', (select id from games where slug='house-flipper'),
  'The Loft Rebirth', 'An abandoned industrial loft turned warm modern home.',
  '/img/seed/loft-rebirth.jpg', 'Mid', false),
 ('00000000-0000-4000-a000-000000000003', (select id from games where slug='house-flipper'),
  'Hoarder House Rescue', 'The worst job I have ever taken. Before/after inside.',
  '/img/seed/hoarder-rescue.jpg', 'Starter', false),
 ('00000000-0000-4000-a000-000000000004', (select id from games where slug='cities-skylines-ii'),
  'Old Town District', 'An organic old-town core that grew along the river, no grid.',
  '/img/seed/old-town.jpg', 'Mid', false),
 ('00000000-0000-4000-a000-000000000005', (select id from games where slug='tiny-glade'),
  'Fairy Glade Cottage', 'A tiny overgrown cottage in a hidden glade. Maximum cozy.',
  '/img/seed/fairy-glade.jpg', 'Starter', false),
 ('00000000-0000-4000-a000-000000000005', (select id from games where slug='tiny-glade'),
  'Castle Overlook', 'Small castle on a cliff overlooking the sea.',
  '/img/seed/castle-lookout.jpg', 'Luxury', false);

-- ============ BUILD TAGS ============
insert into build_tags (build_id, tag_id)
select b.id, gt.id
from builds b
join games g on g.id = b.game_id
join game_tags gt on gt.game_id = g.id
where (b.title = 'Sunset Manor' and gt.name = 'Modern Villa')
   or (b.title = 'Beach A-Frame' and gt.name = 'No-Cheats')
   or (b.title = 'Suburban Ranch' and gt.name = 'Ranch')
   or (b.title = 'Tiny Town Rowhome' and gt.name = 'Tiny Home')
   or (b.title = 'Mill Mansion' and gt.name = 'Mansion')
   or (b.title = 'The Loft Rebirth' and gt.name = 'Loft')
   or (b.title = 'Hoarder House Rescue' and gt.name = 'Renovation')
   or (b.title = 'Old Town District' and gt.name = 'Organic')
   or (b.title = 'Fairy Glade Cottage' and gt.name = 'Cottagecore')
   or (b.title = 'Castle Overlook' and gt.name = 'Castle');

-- ============ SAMPLE RATINGS / LIKES / COMMENTS ============
insert into ratings (user_id, build_id, stars)
select '00000000-0000-4000-a000-000000000002', b.id, 5 from builds b where b.title = 'Sunset Manor'
union all select '00000000-0000-4000-a000-000000000003', b.id, 5 from builds b where b.title = 'Sunset Manor'
union all select '00000000-0000-4000-a000-000000000004', b.id, 4 from builds b where b.title = 'Sunset Manor'
union all select '00000000-0000-4000-a000-000000000001', b.id, 5 from builds b where b.title = 'Tiny Town Rowhome'
union all select '00000000-0000-4000-a000-000000000005', b.id, 5 from builds b where b.title = 'Tiny Town Rowhome';

insert into likes (user_id, build_id)
select '00000000-0000-4000-a000-000000000002', b.id from builds b where b.title in ('Sunset Manor','Suburban Ranch')
union all select '00000000-0000-4000-a000-000000000003', b.id from builds b where b.title in ('Sunset Manor','Beach A-Frame')
union all select '00000000-0000-4000-a000-000000000004', b.id from builds b where b.title = 'Sunset Manor';

insert into comments (user_id, build_id, body)
select '00000000-0000-4000-a000-000000000002', b.id,
 'The infinity pool placement is genius. Saving this for inspiration!' from builds b where b.title = 'Sunset Manor'
union all
select '00000000-0000-4000-a000-000000000001', b.id,
 'Functional AND tiny. Respect. How did you fit the bathroom?' from builds b where b.title = 'Tiny Town Rowhome';
