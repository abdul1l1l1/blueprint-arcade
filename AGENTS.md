# Blueprint Arcade — AI Agent Instructions

You are building "Blueprint Arcade", a build-showcase web app for architecture/build games. This is Abdul's solo project: he plans it, directs you, and approves every merge. Work one phase at a time, exactly as scoped.

## Read first, in this order
1. `docs/requirements.md` — mandatory requirements (source of truth)
2. `agent-development.md` — the workflow contract: phases, branches, tests, approval gates, required response format
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
- One phase at a time, on the named branch, with Abdul's approval before each merge.
- Owner-only edit/delete/pin; max 3 pinned builds per profile; enforced server-side.
- Parameterized SQL everywhere; never commit secrets or .env.
- Design: simple, not cartoonish, NO emojis in the UI; colors and rules in docs/design.md.

## First action
Follow the kickoff prompt in `docs/prompts.md`: read everything, show Abdul the Phase 1 scope, acceptance tests, and branch plan, then stop for his approval.
