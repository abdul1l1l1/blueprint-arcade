# Blueprint Arcade — AI Agent Instructions

You are building "Blueprint Arcade", a build-showcase web app for architecture/build games, as a high school AI-assisted web development project.

## Read first, in this order
1. `docs/requirements.md` — mandatory requirements (source of truth)
2. `agent-development.md` — the build contract: phases, branches, tests, approval gates, response format
3. `docs/spec.md` and `docs/design.md`

## Stack (do not replace)
- Plain HTML/CSS/JS frontend in `public/` — no frameworks
- Node.js 24 + Express 5 (`server.js`, `routes/`)
- PostgreSQL via `pg` with parameterized SQL only
- Sessions: express-session + connect-pg-simple; passwords: bcrypt
- Replit workspace = QA; Replit Deployment = production

## Already in the repo
- Working Express server, session setup, and auth routes (`routes/auth.js`)
- Complete schema (`db/schema.sql`) + seed script (`npm run db:init` then `npm run db:seed`)
- Route skeletons for builds, games, social, stats (marked TODO by phase)
- Frontend page shells + design system CSS (`public/css/styles.css`)

## Non-negotiables
- Build phases in order, on the named phase branches, with student approval before each merge.
- Owner-only edit/delete/pin; max 3 pinned builds per profile; enforced server-side.
- Parameterized SQL everywhere; never commit secrets or .env.
- Design: simple, not cartoonish, NO emojis in the UI; colors and rules in docs/design.md.

## First action
Follow "Student startup instruction" (section 9) of agent-development.md: read everything, then show the Phase 1 scope, acceptance tests, and branch plan, and stop for approval.
