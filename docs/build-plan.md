# Blueprint Arcade — Phase Build Plan

Estimate: ~7-8 focused days. Each phase ends demoable.

## Phase 0 — Setup (half day)

- [ ] Create Supabase project; run db/schema.sql then db/seed.sql
- [ ] Scaffold Next.js + Tailwind; connect Supabase client
- [ ] Define design tokens (colors, typography, spacing) as Tailwind theme
- **Deliverable:** app skeleton that talks to the database

## Phase 1 — Auth (half day)

- [ ] Sign up / log in / log out pages + Supabase Auth wiring
- [ ] Session state in the top bar (avatar vs "Log in"); protected routes redirect
- **Deliverable:** working accounts; unauthenticated write attempts blocked

## Phase 2 — Layout + Game Directory (1 day)

- [ ] App shell: sidebar categories + top action bar (all pages)
- [ ] View 2: game grid from game_stats view, search bar, platform/variant/sandbox filters, sorting, pagination, empty state
- **Deliverable:** browsable directory (MVP views 1/5 done)

## Phase 3 — Game Detail (1 day)

- [ ] View 3: gallery, description, tags, per-game vocabulary, rating stars (logged-in), comments, related games by variant
- [ ] "Add to Compare" saves selection to context/session
- **Deliverable:** rich detail pages for all 8 seed games

## Phase 4 — Build Showcase, the CRUD heart (2 days)

- [ ] View 1: build grid with featured carousel, search, game/variant/tag filters, sorting
- [ ] Build detail view with owner-only Edit / Delete / Pin
- [ ] Post a Build form with game-dependent tag loading and validation
- [ ] Public Profile view with pinned builds + stats
- **Deliverable:** the complete post -> edit -> delete -> pin loop (MVP CRUD done)

## Phase 5 — Engagement features (1 day)

- [ ] Likes (toggle) on builds; favorites (games + builds) + Favorites page
- [ ] Top 10 view using build_stats (rating x likes), daily fun fact, countdown timer
- [ ] Recently viewed tracking (local)
- **Deliverable:** the feedback loop alive — trending, ranking, collecting

## Phase 6 — Comparison tool + theme (1 day)

- [ ] View 4: two dropdowns, spec table from DB, per-row winner highlighting, swap sides, verdict banner
- [ ] Dark/light mode toggle persisted across sessions
- **Deliverable:** fan-specific interactive feature done

## Phase 7 — Polish + Deploy (1 day)

- [ ] Responsive audit at 3 breakpoints (sidebar -> hamburger on mobile)
- [ ] Toasts on every mutation; inline form errors; empty/loading states everywhere
- [ ] Seed build images added
- [ ] Deploy to Vercel; env vars for Supabase; final URL smoke test
- **Deliverable:** publicly reachable, submission-ready app
