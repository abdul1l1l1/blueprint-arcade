# Blueprint Arcade — Specification Document

## 1. Overview

**Blueprint Arcade** is a fan website for the architecture/build-game community — players of Welcome to Bloxburg, The Sims 4, House Flipper, Cities: Skylines II, Manor Lords, Tiny Glade, Hometopia, and Minecraft. It combines a **community build showcase** (the heart) with a **game encyclopedia and comparison tool** around it.

- **Fandom:** architecture / build-game players
- **Target user:** builders who want to show off their creations and discover their next building game
- **Problem solved:** this knowledge is scattered across Roblox wikis, the Sims Gallery, and separate city-builder communities; Blueprint Arcade is the single hub to discover, compare, and share

## 2. Panel of Experts

1. **FroggyHopz** (Game Director, Welcome to Bloxburg) — player-first design
2. **Phil / City Planner Plays** (professional urban planner) — domain credibility
3. **James Turner / The Sim Supply** (EA-commissioned Sims builder) — community & showcase UX
4. **Simone** (UX / full-stack product designer) — requirements, accessibility, shipping

## 3. User Stories

- As a **visitor**, I can browse the build showcase, game directory, compare games, and read everything without an account.
- As a **builder**, I can register, log in, post builds with images, tags, and budget tier, and edit or delete my own builds.
- As a **builder**, I can pin up to 3 of my builds so they appear at the top of my public profile.
- As a **fan**, I can rate games and builds (1-5 stars), like builds, comment, and save favorites.
- As a **fan**, I can search, filter, and sort builds and games to find exactly what I want.

## 4. Views

| # | View | Contents |
|---|---|---|
| 1 | **Build Showcase** (landing) | Featured carousel, search + filters (game, variant, tag, sort), build grid |
| 2 | **Game Directory** | Search, platform/variant/sandbox filters, sorting, game cards, pagination |
| 3 | **Game Detail** | Gallery, description, variant + platform tags, per-game tag vocabulary, rating, comments, related games |
| 4 | **Compare Games** | Pick 2 games, side-by-side specs, per-row winner highlighting, verdict |
| 5 | **Top 10** | Builds ranked by rating x likes, daily fun fact, countdown timer |
| 6 | **Profile** (bonus) | Avatar, bio, stats, pinned builds (max 3), all builds, favorite games |
| 7 | **Post a Build** (bonus) | Form: title, game -> auto variant tags, description, image, budget tier, pin checkbox |

**Navigation:** category sidebar (Discover: Builds, Top 10 - Games: Directory, Compare - Builds: Showcase, Post a Build - Community: My Profile) + slim top bar with page title and **top-right actions**: Favorites, Dark Mode, Post a Build. Auth pages (Login, Sign Up) exist but do not count toward the 5 required views.

## 5. Custom Features (10)

1. Search Bar (games + builds)
2. Category Filters
3. Sorting Options
4. Favorites Button
5. Rating System (stars)
6. Image Carousel (featured builds)
7. Like + Comment on builds
8. Dark/Light Mode
9. Top 10 Builds List
10. Comparison Tool (fan-specific interactive feature)

## 6. Data Model

9 tables — users, games, game_tags, builds, build_tags, ratings, likes, favorites, comments — plus game_stats and build_stats aggregate views (powering Top 10 and compare numbers). Full DDL in db/schema.sql; seed content in db/seed.sql (8 games + tag vocabularies + 10 credited builds).

**Tag system (3 layers):** game variant (Freeform / Interior / Renovation / City Planning / Sandbox) -> per-game style vocabulary -> tags on builds via build_tags.

## 7. Auth & Permissions

Supabase Auth (email + password). Row-level security: public read for all content; only authenticated users can insert ratings/likes/favorites/comments; only a build's owner can update, delete, or pin their builds (max 3 pins enforced in app logic).

## 8. Validation & Feedback

- Client-side: required fields, image URL checks, star limits, comment length (1-2000), tag limits
- Server-side: DB constraints (CHECK, UNIQUE, NOT NULL) back up every form
- Feedback: success/error toasts, inline form errors, graceful empty states, loading skeletons

## 9. Responsive Design

Mobile: sidebar collapses to bottom nav / hamburger; grids go 1 -> 2 -> 3 columns; top-right actions remain reachable. Visual parity across breakpoints; touch-friendly controls.

## 10. Brand

Baby blue #89CFF0 (hero), slate blue #6C9BD1, ink navy #12233B (sidebar/text/dark base), terracotta #E07A5F (CTAs, hearts), paper white #F7F9FB. **Simple, not cartoonish:** flat white cards, thin borders, subtle shadows, Inter typography, no emojis, no decorative textures.

## 11. Tech Stack & Deployment

Next.js (App Router) - Supabase (PostgreSQL + Auth) - Tailwind CSS - Vercel. Live URL required for submission.

## 12. Success Criteria

All MVP requirements met and demoable: persistent data, auth with protected actions, 5+ domain views, full CRUD on builds, 8+ meaningful seed entries, working search/filter, working comparison tool, responsive at 3 breakpoints, visible validation/feedback, and a public deployed URL.
