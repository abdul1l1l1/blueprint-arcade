# Blueprint Arcade

Abdul's build-showcase site for architecture & build games — a solo AI-assisted web development project. I plan the app, direct my AI agent phase by phase, and approve every merge.

## What it is
Players post builds (title, game, description, images, budget tier, tags), browse a showcase, favorite and rate builds, like and comment, compare games, and climb the Top 10 (rating x likes).

## Tech stack
- **Frontend:** plain HTML, CSS, JavaScript
- **Server:** Node.js 24 LTS + Express 5 (serves static files and API routes)
- **Database:** Replit PostgreSQL via pg (parameterized SQL)
- **Auth:** express-session + connect-pg-simple + bcrypt
- **AI development environment:** Replit Agent (directed by me)
- **Source control:** GitHub
- **Environments:** Replit workspace = QA · Replit Deployment = production (separate database)

## Project structure
```
├── public/            # Frontend pages (index=Build Showcase, games, game, compare, top10, post, profile, login, register)
│   ├── css/styles.css # Design system (baby blue / terracotta, flat cards, no emojis)
│   └── js/            # api.js fetch helpers, app.js shared shell (dark mode, toasts)
├── routes/           # auth, builds, games, social (likes/comments/ratings/favorites), stats (top10/profile)
├── db/                # pool.js, schema.sql, init.js, content.js (seed data), seed.js
├── server.js          # Express entry point
├── docs/              # requirements.md, spec.md, design.md, prompts.md
└── agent-development.md  # My phase-by-phase workflow for directing the AI agent
```

## Getting started
```bash
git clone https://github.com/abdul1l1l1/blueprint-arcade.git
cd blueprint-arcade
npm install
cp .env.example .env   # fill in DATABASE_URL + SESSION_SECRET
npm run db:init        # create tables
npm run db:seed        # 8 games, 5 demo users, 10 credited builds
npm start              # http://localhost:5000
```

In Replit, use Secrets rather than creating `.env`: `DATABASE_URL` is managed by
Replit, and `SESSION_SECRET` and `SEED_PASSWORD` must be set securely. No password
or session-secret fallback exists. Missing configuration stops startup/seeding.

## Phase 1 QA

Run `npm test` for the Phase 1 integration and frontend-handler checks. These
require the QA database and must not run against production. Tests create
separate `qa_p1_*` schemas with synthetic fixtures, cleaned up on completion;
they do not delete or overwrite existing public QA data. Test passwords are
generated in memory and never printed or committed.

`npm run db:init` is transactional and preserves existing tables/data.
`npm run db:seed` is QA-only and transactional: it either adds a complete seed,
verifies an existing complete seed without changing it, or reports incomplete
seed data and leaves it untouched. Never drop tables to reseed.

All 10 builds are original demo content created for this project and associated
with fictional demo accounts, not attributed to real builders. Images stay
empty for Phase 1; real screenshots are deferred to Phase 3 by approval.

Usernames retain display case, but uniqueness and login are case-insensitive.
Emails are stored lowercase and matched case-insensitively. Registration creates
the user/profile atomically. Sessions are regenerated on login/registration,
stored in PostgreSQL, and invalidated on logout. The top bar shows Logout only
when logged in. Passwords must be 8+ characters and at most bcrypt's 72-byte limit.

The server performs no startup DDL; initialize the QA schema explicitly.
Production initialization/seeding is not authorized by Phase 1.

## Phase 2 games browsing and QA

Open `/games.html` for the public directory and `/game.html?slug=bloxburg`
for a game detail. Search matches name, genre, or description, ignoring case;
SQL wildcard characters are literal search text. The sandbox filter uses the
seeded `is_sandbox` flag (not words in the genre). Sorting supports name A–Z
(default), most builds, highest build rating, and newest release year, with
name tie-breaking. Search/filter/sort selections survive a page reload via
the directory query string.

`GET /api/games?q=...&sandbox=true|false&sort=name|builds|rating|newest`
returns `{ games }`. Omit optional search/filter values to browse all games.
Search is limited to 120 characters. Invalid query values return field errors
with HTTP 400. `GET /api/games/:slug` returns `{ game, tags, builds }`, including
only that game's vocabulary and credited builds. Unknown slugs return 404.
Both APIs are public and read-only.

Game ratings retain the existing `game_stats` definition: the mean of each
build's average rating, including zero for unrated builds. They are not direct
ratings of the game. The UI labels this as a build rating and displays
“No ratings” for zero rather than suggesting a submitted zero-star rating.
Build types and style tags are displayed without adding build editing or
social actions.

`npm test` now runs the 19 Phase 1 regression checks and 13 Phase 2 HTTP/database
checks. Phase 2 fixtures are isolated in disposable `qa_p2_*` schemas, just as
Phase 1 uses `qa_p1_*`; neither suite deletes or overwrites public QA content.
The phase report records the separate browser and managed-workflow restart
checks. No production setup, schema change, or deployment is part of Phase 2.

## Phase 3 build CRUD and QA

The landing showcase now supports literal, case-insensitive title/description
search, game slug, build type, budget, and exact style-tag filters. Filters
compose with AND; sorting is newest (default), rating, or likes, descending
with stable ties. Apply/Clear controls update the URL and reload restores the
selection. Displayed ratings/likes use the existing seed aggregates; submitting
social actions is still Phase 4.

- `/post.html` creates a build; `/post.html?id=<build-uuid>` edits an owned build.
- `/profile.html` resolves the signed-in user; `?username=...` opens a public
  profile, with pinned builds first and owner controls only for that owner.
- `GET /api/builds` accepts `q`, `game`, `build_type`, `budget_tier`, `tag`,
  and `sort=newest|rating|likes`, returning `{ builds }`.
- `GET /api/builds/:id` returns `{ build }`.
- `POST /api/builds` and `PUT /api/builds/:id` accept title, numeric `game_id`,
  description, `image_urls` array, budget tier, build type, `tags` array, and
  boolean `is_pinned`. Create returns 201; edit returns 200 with `{ build }`.
- `DELETE /api/builds/:id` returns `{ deleted: true }`; the UI asks for
  confirmation first. Only the owner can edit, delete, or pin.
- `POST /api/builds/:id/pin` accepts the explicit desired boolean
  `{ is_pinned }`, rather than a non-idempotent toggle.
- `GET /api/stats/profile/:username` returns `{ profile, builds }` without
  private account fields; usernames resolve case-insensitively.

The owner identity always comes from the existing authenticated session, never
from the request body. Anonymous writes return 401, non-owner writes 403,
missing builds 404, invalid inputs 400, and a fourth pin 409. Every mutation
locks the owner's database row in a transaction before counting pins or
changing a build. Create, edit, and pin therefore share the same concurrency
protection; rejected writes roll back fields and tags together.

Titles and valid game/budget/type choices are required. Description, images,
and style tags retain the schema's optional/empty states, including the
existing demo builds without images. Supplied image URLs must be HTTP(S)
without embedded credentials; tags must be unique entries in the selected
game's vocabulary. Game changes require choosing compatible tags. The form
preserves entries on errors. Cards show the first image or an honest missing/
failed-image state; no carousel is implemented yet.

`npm test` includes the unchanged 32 Phase 1/2 checks, 15 Phase 3 PostgreSQL/HTTP
checks in isolated disposable `qa_p3_*` schemas, and three actual shared
frontend-handler checks. Real-browser form/profile/ownership coverage is
recorded separately in `docs/phase-3-qa-report.md`. No original demo rows,
schema, auth implementation, secrets, or production configuration are changed.

## Phase 5 themes and release preparation

All ten pages share an early `public/js/theme.js` boot script: selected light/
dark mode survives navigation/reload, synchronizes across tabs and degrades
safely when browser storage is blocked. Auth pages use the same visual controls.
Responsive navigation, cards, forms and comparison tables support mobile,
tablet and desktop, with keyboard focus and reduced-motion styles.

The original demo seed remains eight games, five accounts and ten credited
builds. The owner-approved Construction Site is an additive eleventh build,
not a replacement cover or fabricated demo screenshot. Import explicitly in QA
with `node db/add-construction-site.js`; repeated imports skip existing content.
Its fixed public application route serves only the approved App Storage image.

Run `npm test` for all phase regressions and Phase 5 checks. Fixture schemas
are now removed by teardown; no test suite changes public seed data.

### Builder screenshot uploads

The build form can upload JPEG, PNG and WebP screenshots directly to App
Storage using the existing login session. Consent, file validation, owner-only
attachment and save-before-public visibility are required. Existing image URLs
and approved fixed assets still work.

For an existing QA database, use the additive `npm run db:migrate:uploads`;
never seed/reset existing content to enable uploads. Fresh QA initialization
includes that schema. See `docs/image-uploads.md` for limits, access rules and
retry behavior. Production schema changes remain part of the approved Replit
Publishing flow, never a startup or production migration command.
`node db/clean-qa.js` previews the owner-requested synthetic-data cleanup;
`--apply` is destructive, QA-only and refuses unknown accounts/content.
See `docs/phase-5-acceptance.md`, `docs/phase-5-qa-report.md` and
`docs/production-readiness.md` for evidence and the separate production handoff.
Preparing configuration does not publish; explicit owner approval is required.

## How I develop (solo, student-directed)
I split the build into 5 phases (foundation/auth, games, builds CRUD, social + Top 10 + compare, polish + deploy). Each phase happens on its own Git branch, gets acceptance-tested in the Replit QA workspace, and only merges to main after I review the results and approve. My prompts for each phase live in docs/prompts.md; the full rules are in agent-development.md.

## Documentation
- [docs/requirements.md](docs/requirements.md) — mandatory project requirements (source of truth)
- [docs/spec.md](docs/spec.md) — my approved Spec Doc
- [docs/design.md](docs/design.md) — concept, views, tag system, design principles
- [agent-development.md](agent-development.md) — my AI workflow: phases, branches, tests, approval gates
- [docs/prompts.md](docs/prompts.md) — the prompts I send the agent each phase
