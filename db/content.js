// Seed data for Blueprint Arcade (games, tag vocabularies, demo users, credited builds)

const games = [
  { slug: 'bloxburg',  name: 'Welcome to Bloxburg',  genre: 'Life sim / building', release_year: 2016, is_sandbox: false,
    description: 'Roblox life-sim with detailed residential building, interiors and renovation.', tags: ['Modern', 'Suburban', 'Noobstarter', 'Mansion', 'Cottagecore', 'Interior'] },
  { slug: 'sims-4',    name: 'The Sims 4',           genre: 'Life sim',            release_year: 2014, is_sandbox: false,
    description: 'Build mode classic: room-based construction, interior design and renovation packs.', tags: ['Modern', 'Family', 'Renovation', 'Tiny Home', 'Interior'] },
  { slug: 'house-flipper', name: 'House Flipper',    genre: 'Renovation sim',      release_year: 2018, is_sandbox: false,
    description: 'Buy, gut and renovate houses for profit.', tags: ['Renovation', 'Budget', 'Fixer-Upper'] },
  { slug: 'cities-skylines-2', name: 'Cities: Skylines II', genre: 'City builder',  release_year: 2023, is_sandbox: false,
    description: 'Full city planning simulation: zoning, roads, services and districts.', tags: ['City Planning', 'Grid', 'Traffic', 'Districts'] },
  { slug: 'manor-lords', name: 'Manor Lords',        genre: 'City builder / strategy', release_year: 2024, is_sandbox: false,
    description: 'Medieval city building with organic, non-grid layouts.', tags: ['Medieval', 'Organic Layout', 'Village'] },
  { slug: 'tiny-glade', name: 'Tiny Glade',          genre: 'Cozy sandbox',        release_year: 2024, is_sandbox: true,
    description: 'Relaxing castle-town doodling toy with procedural charm.', tags: ['Cozy', 'Castle', 'Diorama'] },
  { slug: 'hometopia', name: 'Hometopia',            genre: 'Building sandbox',    release_year: 2023, is_sandbox: false,
    description: 'Design, build and renovate homes and whole neighborhoods.', tags: ['Neighborhood', 'Renovation', 'Interior'] },
  { slug: 'minecraft', name: 'Minecraft',            genre: 'Sandbox',             release_year: 2011, is_sandbox: true,
    description: 'The original block sandbox: freeform building at any scale.', tags: ['Freeform', 'Pixel Art', 'Survival', 'Megabuild'] },
];

// Demo members; passwords are set by db/seed.js (bcrypt-hashed, placeholder values)
const users = [
  { username: 'abdul_builds', email: 'abdul@blueprintarcade.dev', display_name: 'Abdul', bio: 'Bloxburg builder. I love showing off my builds and getting feedback.' },
  { username: 'demo_maya',    email: 'maya@blueprintarcade.dev',   display_name: 'Maya',   bio: 'Interior design fan, mostly Sims 4.' },
  { username: 'demo_theo',   email: 'theo@blueprintarcade.dev',   display_name: 'Theo',   bio: 'City planning nerd. Cities: Skylines II all the way.' },
  { username: 'demo_sana',   email: 'sana@blueprintarcade.dev',   display_name: 'Sana',   bio: 'Cozy Tiny Glade dioramas.' },
  { username: 'demo_lin',    email: 'lin@blueprintarcade.dev',    display_name: 'Lin',    bio: 'Minecraft megabuilds.' },
];

// owner: username, game: slug
const builds = [
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Sunset Cliffside Modern', build_type: 'freeform', budget_tier: 'luxury', pinned: true,
    description: 'My pride and joy: a cliffside modern villa with an infinity pool and an open floor plan.', tags: ['Modern', 'Mansion'] },
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Cozy Starter Cottage', build_type: 'freeform', budget_tier: 'starter', pinned: true,
    description: 'Proof you do not need a huge budget: a cute starter cottage under 20k.', tags: ['Cottagecore', 'Noobstarter'] },
  { owner: 'abdul_builds', game: 'bloxburg', title: 'Downtown Loft Interior', build_type: 'interior', budget_tier: 'mid', pinned: true,
    description: 'Full interior of a downtown loft — warm woods and big windows.', tags: ['Interior', 'Modern'] },
  { owner: 'demo_maya', game: 'sims-4', title: 'Tiny Home, Big Ideas', build_type: 'interior', budget_tier: 'starter', pinned: false,
    description: 'A 5x5 tiny home that still fits everything you need.', tags: ['Tiny Home', 'Interior'] },
  { owner: 'demo_maya', game: 'house-flipper', title: 'Flip #14: Abandoned Bungalow', build_type: 'renovation', budget_tier: 'mid', pinned: false,
    description: 'Before/after of a gutted bungalow flip. Huge glow-up.', tags: ['Renovation', 'Fixer-Upper'] },
  { owner: 'demo_theo', game: 'cities-skylines-2', title: 'Roundabout City: Traffic Update', build_type: 'city-planning', budget_tier: 'unlimited', pinned: true,
    description: 'My grid-free city built around roundabouts. Traffic flow is butter.', tags: ['City Planning', 'Traffic'] },
  { owner: 'demo_theo', game: 'manor-lords', title: 'Riverside Medieval Village', build_type: 'city-planning', budget_tier: 'unlimited', pinned: false,
    description: 'Organic village layout that follows the river bend.', tags: ['Medieval', 'Organic Layout'] },
  { owner: 'demo_sana', game: 'tiny-glade', title: 'Autumn Castle Diorama', build_type: 'sandbox', budget_tier: 'unlimited', pinned: true,
    description: 'Little castle town covered in autumn vines.', tags: ['Cozy', 'Castle', 'Diorama'] },
  { owner: 'demo_lin', game: 'minecraft', title: 'Neo-Tokyo Megabuild', build_type: 'sandbox', budget_tier: 'unlimited', pinned: true,
    description: 'A cyberpunk city block built over 6 months with the crew.', tags: ['Megabuild', 'Freeform'] },
  { owner: 'demo_lin', game: 'minecraft', title: 'Cherry Grove Shrine', build_type: 'freeform', budget_tier: 'starter', pinned: false,
    description: 'Small cherry-blossom shrine, built in survival.', tags: ['Pixel Art', 'Survival'] },
];

const sampleRatings = [
  { user: 'demo_maya', build: 'Sunset Cliffside Modern', stars: 5 },
  { user: 'demo_theo', build: 'Sunset Cliffside Modern', stars: 5 },
  { user: 'demo_sana', build: 'Cozy Starter Cottage', stars: 4 },
  { user: 'demo_lin', build: 'Cozy Starter Cottage', stars: 5 },
  { user: 'abdul_builds', build: 'Tiny Home, Big Ideas', stars: 5 },
  { user: 'demo_theo', build: 'Neo-Tokyo Megabuild', stars: 5 },
];

const sampleLikes = [
  { user: 'demo_maya', build: 'Sunset Cliffside Modern' },
  { user: 'demo_sana', build: 'Sunset Cliffside Modern' },
  { user: 'demo_lin', build: 'Sunset Cliffside Modern' },
  { user: 'demo_theo', build: 'Cozy Starter Cottage' },
  { user: 'abdul_builds', build: 'Neo-Tokyo Megabuild' },
];

const sampleComments = [
  { user: 'demo_theo', build: 'Sunset Cliffside Modern', body: 'That infinity pool placement is perfect. Tutorial?' },
  { user: 'demo_maya', build: 'Downtown Loft Interior', body: 'The warm woods with the big windows — chef kiss.' },
  { user: 'demo_sana', build: 'Cozy Starter Cottage', body: 'Under 20k?? Saving this immediately.' },
];

module.exports = { games, users, builds, sampleRatings, sampleLikes, sampleComments };
