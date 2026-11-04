// Original project demo content and fictional demo users; not real creators' builds.
// Image screenshots are deferred to Phase 3 by approval.

const games = [
  { slug: 'bloxburg',  name: 'Welcome to Bloxburg',  genre: 'Life sim / building', release_year: 2016, is_sandbox: false,
    description: 'Build houses, decorate interiors, and live a virtual life in the most popular architecture game on Roblox.',
    tags: ['Modern Villa', 'Ranch', 'No-Cheats', 'Speedbuild', 'Budget Build', 'Roleplay Home'] },
  { slug: 'the-sims-4', name: 'The Sims 4',         genre: 'Life sim',            release_year: 2014, is_sandbox: false,
    description: 'The life sim where build mode is legend — design homes down to the wallpaper.',
    tags: ['Cottagecore', 'Tiny Home', 'Shell', 'Mansion'] },
  { slug: 'house-flipper', name: 'House Flipper',    genre: 'Renovation sim',      release_year: 2018, is_sandbox: false,
    description: 'Buy run-down houses, gut them, and renovate for profit.',
    tags: ['Renovation', 'Loft', 'Garden'] },
  { slug: 'cities-skylines-ii', name: 'Cities: Skylines II', genre: 'City builder', release_year: 2023, is_sandbox: false,
    description: 'The modern city-builder: zone, road, and plan entire metropolises.',
    tags: ['Grid', 'Organic', 'Downtown'] },
  { slug: 'manor-lords', name: 'Manor Lords',        genre: 'City builder / strategy', release_year: 2024, is_sandbox: false,
    description: 'Medieval city-builder with organic, gridless street growth.',
    tags: ['Medieval', 'Village'] },
  { slug: 'tiny-glade', name: 'Tiny Glade',          genre: 'Cozy sandbox',        release_year: 2024, is_sandbox: true,
    description: 'A cozy freeform castle-building toy. Doodle cottages, gardens, and castles.',
    tags: ['Cottagecore', 'Castle', 'Cozy'] },
  { slug: 'hometopia', name: 'Hometopia',            genre: 'Building sandbox',    release_year: 2023, is_sandbox: false,
    description: 'A free collaborative home-building and interior design game.',
    tags: ['Interior', 'Collab'] },
  { slug: 'minecraft', name: 'Minecraft',            genre: 'Sandbox',             release_year: 2011, is_sandbox: true,
    description: 'The sandbox original — endless block building for freeform creators.',
    tags: ['Starter Base', 'Medieval', 'Modern', 'Megabuild'] },
];

// Demo members; db/seed.js bcrypt-hashes SEED_PASSWORD from Replit Secrets.
const users = [
  { username: 'abdul_builds', email: 'abdul@blueprintarcade.dev', display_name: 'Abdul', bio: 'Bloxburg builder — modern builds, no-cheats only. I love showing off my builds and getting feedback.' },
  { username: 'simmer99',    email: 'simmer99@blueprintarcade.dev',  display_name: 'simmer99',  bio: 'Tiny home addict. Sims 4 builder since 2014.' },
  { username: 'flipking',    email: 'flipking@blueprintarcade.dev',  display_name: 'flipking',  bio: 'If it is ugly, I flip it.' },
  { username: 'plannerphil', email: 'phil@blueprintarcade.dev',      display_name: 'plannerphil', bio: 'Real-life city planner. I build like it is zoning day.' },
  { username: 'cozyqueen',   email: 'cozy@blueprintarcade.dev',      display_name: 'cozyqueen', bio: 'Cottagecore forever. Tiny Glade and Sims.' },
];

// owner: username, game: slug
const builds = [
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Sunset Manor', build_type: 'freeform', budget_tier: 'luxury', pinned: true,
    description: 'Two-story modern manor, 4 bed / 4 bath, infinity pool. Built fully no-cheats.', tags: ['Modern Villa', 'No-Cheats'] },
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Beach A-Frame', build_type: 'freeform', budget_tier: 'starter', pinned: true,
    description: 'Cozy A-frame right on the sand. Starter-budget friendly.', tags: ['No-Cheats', 'Budget Build'] },
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Suburban Ranch', build_type: 'interior', budget_tier: 'mid', pinned: true,
    description: 'Classic family ranch with an open-plan kitchen.', tags: ['Ranch'] },
  { owner: 'simmer99', game: 'the-sims-4', title: 'Tiny Town Rowhome', build_type: 'interior', budget_tier: 'starter', pinned: true,
    description: 'A fully functional tiny home under 4x4 tiles — harder than it looks.', tags: ['Tiny Home'] },
  { owner: 'simmer99', game: 'the-sims-4', title: 'Mill Mansion', build_type: 'freeform', budget_tier: 'luxury', pinned: false,
    description: 'Grand cottagecore estate with a working mill garden.', tags: ['Mansion', 'Cottagecore'] },
  { owner: 'flipking', game: 'house-flipper', title: 'The Loft Rebirth', build_type: 'renovation', budget_tier: 'mid', pinned: true,
    description: 'An abandoned industrial loft turned warm modern home.', tags: ['Loft', 'Renovation'] },
  { owner: 'flipking', game: 'house-flipper', title: 'Hoarder House Rescue', build_type: 'renovation', budget_tier: 'starter', pinned: false,
    description: 'The worst job I have ever taken. Before/after inside.', tags: ['Renovation'] },
  { owner: 'plannerphil', game: 'cities-skylines-ii', title: 'Old Town District', build_type: 'city-planning', budget_tier: 'unlimited', pinned: true,
    description: 'An organic old-town core that grew along the river, no grid.', tags: ['Organic', 'Downtown'] },
  { owner: 'cozyqueen', game: 'tiny-glade', title: 'Fairy Glade Cottage', build_type: 'sandbox', budget_tier: 'starter', pinned: true,
    description: 'A tiny overgrown cottage in a hidden glade. Maximum cozy.', tags: ['Cottagecore', 'Cozy'] },
  { owner: 'cozyqueen', game: 'tiny-glade', title: 'Castle Overlook', build_type: 'sandbox', budget_tier: 'unlimited', pinned: false,
    description: 'Small castle on a cliff overlooking the sea.', tags: ['Castle'] },
];

const sampleRatings = [
  { user: 'simmer99',    build: 'Sunset Manor', stars: 5 },
  { user: 'flipking',    build: 'Sunset Manor', stars: 5 },
  { user: 'plannerphil', build: 'Sunset Manor', stars: 4 },
  { user: 'abdul_builds', build: 'Tiny Town Rowhome', stars: 5 },
  { user: 'cozyqueen',  build: 'Tiny Town Rowhome', stars: 5 },
];

const sampleLikes = [
  { user: 'simmer99',    build: 'Sunset Manor' },
  { user: 'simmer99',    build: 'Suburban Ranch' },
  { user: 'flipking',    build: 'Sunset Manor' },
  { user: 'flipking',    build: 'Beach A-Frame' },
  { user: 'plannerphil', build: 'Sunset Manor' },
];

const sampleComments = [
  { user: 'simmer99', build: 'Sunset Manor', body: 'The infinity pool placement is genius. Saving this for inspiration!' },
  { user: 'abdul_builds', build: 'Tiny Town Rowhome', body: 'Functional AND tiny. Respect. How did you fit the bathroom?' },
];

module.exports = { games, users, builds, sampleRatings, sampleLikes, sampleComments };
