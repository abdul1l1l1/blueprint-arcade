# Blueprint Arcade — Mandatory Project Requirements

These requirements are the source of truth for this project. All are mandatory.

## App requirements
- Five working domain views (login/register pages do not count):
  1. **Build Showcase** (landing page) — the CRUD heart of the app.
  2. **Game Directory** — lists all games.
  3. **Game Detail** — one game with its description and its builds.
  4. **Compare Games** — side-by-side comparison of selected games.
  5. **Top 10 Builds** — ranked list.
- A build has: title, game, description, image(s), budget tier, style tags, and a pinned flag.
- Full CRUD on builds: create, read, update, delete.
- Only the owner of a build may edit, delete, or pin it.
- A profile may pin at most 3 builds.
- Users can register, log in, and log out.
- Passwords must never be stored as plain text.
- Ten required features:
  1. Search builds
  2. Filter builds (game, build type, budget tier, tags)
  3. Sorting (newest, rating, likes)
  4. Favorites
  5. Star ratings (1-5, one per user per build)
  6. Image carousel on a build
  7. Likes + comments on a build
  8. Dark / Light mode
  9. Top 10 Builds (score = rating x likes)
  10. Comparison tool for games
- 3-layer tag system: game variant (freeform / interior / renovation / city-planning / sandbox) + per-game tag vocabulary + build tags.
- Seed data: 8 games (Bloxburg, Sims 4, House Flipper, Cities: Skylines II, Manor Lords, Tiny Glade, Hometopia, Minecraft) and 10 credited builds.
- All required features must work in the deployed app.

## Tech stack and environments
- Frontend: plain HTML, CSS, and JavaScript.
- Server: Node.js 24 LTS and Express 5.
- The same server serves static files and dynamic API routes.
- Package manager: npm, with package-lock.json committed.
- Database: Replit PostgreSQL.
- Database access: pg with parameterized SQL.
- Persistent data remains available after an app restart.
- AI development environment: Replit Agent (or the student's chosen AI coding tool).
- GitHub stores the code, documentation, and development history.
- Replit's development workspace is the QA environment.
- Replit Deployment is production, with a separate production database.
- Keep the agreed stack consistent across environments.

## Visual theme (design decisions)
- App name: Blueprint Arcade · Audience: class + friends · Mood: simple and clean, not cartoonish
- Colors: baby blue #89CFF0, slate #6C9BD1, ink navy #12233B, terracotta #E07A5F (CTAs), paper #F7F9FB
- Font: Inter · Style: flat white cards, thin #e2e9f0 borders, subtle shadows, NO emojis in the UI
- Layout: category sidebar (Discover / Games / Builds / Community) + slim top bar (Favorites, Dark Mode, Post a Build)
