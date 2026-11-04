# Blueprint Arcade — Design Document

## Concept

**Blueprint Arcade** is a fan site for the architecture/build-game community (Bloxburg, Sims builders, House Flipper players, city-builders). Functionally it is a **community build showcase with a game encyclopedia wrapped around it**: visitors discover and compare games; logged-in builders post their own builds, collect likes, ratings, and comments, and climb the Top 10 leaderboard.

- **Fandom:** architecture / build-game players
- **Target user:** players who love building but have no central place to discover games, compare them, and show off creations
- **Problem solved:** scattered knowledge (Roblox wikis, Sims Gallery, CS communities) -> one hub
- **Core loop:** post a build -> appear in trending -> get likes/ratings/comments -> climb Top 10 -> new visitors discover games through builds

## Views

1. **Build Showcase** (landing page) — featured carousel, searchable/filterable build grid
2. **Game Directory** — 8 games, sandbox filter, sort
3. **Game Detail** — description, variant, per-game tag vocabulary, ratings, related games, builds in this game
4. **Compare Games** — pick 2-3 games, side-by-side specs with per-row winners
5. **Top 10** — leaderboard ranked by rating x likes
6. **Bonus: User Profile** — avatar, bio, stats, up to 3 pinned builds (owner-only action)
7. **Bonus: Post a Build** — form with game, budget tier, build type, tags, pin-to-profile checkbox

Navigation: category **sidebar** (Discover · Games · Builds · Community) + **top action bar** with Favorites, Dark Mode, and Post a Build (top-right, on every page).

## Tag System (3 layers)

1. **Game variant** — Freeform / Interior / Renovation / City Planning / Sandbox (one per build)
2. **Per-game style vocabulary** — each game defines its own tags (Bloxburg: Modern Villa, Ranch, No-Cheats, Speedbuild…; Sims 4: Cottagecore, Tiny Home…)
3. **Build tags** applied via build_tags, drawing from the per-game vocabulary

## Design Principles (per owner)

- **Simple, not cartoonish:** no emojis, flat white cards, thin #e2e9f0 borders, subtle shadows, Inter typography, muted palette
- **Actions top-right** in a slim top bar on every page
- **Colors:** baby blue #89CFF0 (hero), slate blue #6C9BD1, ink navy #12233B (sidebar/text), terracotta #E07A5F (CTAs/hearts), paper white #F7F9FB
- **Dark mode:** ink navy blueprint theme

## Database (see db/schema.sql)

users · profiles · games · game_tags · builds · build_tags · ratings · likes · favorites · comments + aggregate views (game_stats, build_stats). Access control is server-side: public read, logged-in write, owner-only edit/delete/pin (Express routes check the session user).
