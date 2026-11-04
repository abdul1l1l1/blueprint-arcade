# BUILD INSTRUCTIONS — Blueprint Arcade (for AI builders / Replit / Claude / Cursor)

You are building **Blueprint Arcade**, a fan website for architecture/build-game players (Welcome to Bloxburg, The Sims 4, House Flipper, Cities: Skylines II, House Flipper, Manor Lords, Tiny Glade, Hometopia, Minecraft).

Read these first (all in this repo):
- `docs/spec.md` — full specification (views, features, data model, validation)
- `docs/build-plan.md` — the 8 phases to follow, in order
- `docs/design.md` — concept, tag system, design principles
- `db/schema.sql` — 9 tables + views + row-level security (run this first)
- `db/seed.sql` — 8 games + tag vocabularies + 10 credited builds (run second)

## Stack (required)

- **Next.js** (App Router) + **Tailwind CSS**
- **Supabase** for PostgreSQL database AND auth (email/password)
- Deploy on **Vercel** (or host here on Replit)

## Non-negotiable requirements (class MVP rubric)

1. All user data persists (Supabase) across refreshes
2. Auth: register / login / logout; only logged-in users can post builds, rate, like, favorite, comment; only a build's owner can edit/delete/pin their build (max 3 pins)
3. These 5 domain views: **Build Showcase (the landing page)**, Game Directory, Game Detail, Compare Games, Top 10. Bonus: User Profile + Post a Build form
4. Navigation: dark ink-navy **sidebar** with categories (Discover: Builds, Top 10 / Games: Directory, Compare / Builds: Showcase, Post a Build / Community: My Profile) + slim top bar with page title and TOP-RIGHT actions: Favorites, Dark Mode toggle, terracotta "Post a Build" button
5. Full CRUD on **builds** (title, game, description, image, budget tier, style tags, pin)
6. The 10 custom features: Search Bar, Category Filters, Sorting, Favorites, Star Ratings, Image Carousel, Likes + Comments, Dark/Light Mode, Top 10 Builds (ranked by rating x likes), Comparison Tool (two dropdowns -> spec table with per-row winner highlighting + verdict)
7. Search + filtering + sorting on Directory and Showcase
8. Responsive: mobile (sidebar collapses to hamburger/bottom bar), tablet, desktop
9. Validation + feedback: toasts on success/error, inline form errors, empty states ("No builds match this filter")
10. Public deployed URL at the end

## Design system (keep it SIMPLE, not cartoonish)

- Colors: baby blue #89CFF0 (hero), slate blue #6C9BD1, ink navy #12233B (sidebar, text, dark mode base), terracotta #E07A5F (CTAs, hearts, variant tags), paper white #F7F9FB (background)
- Flat white cards, thin #e2e9f0 borders, subtle shadows, Inter font, **NO emojis, no cartoonish elements, no decorative textures**
- Dark mode: ink navy base with soft blue accents; toggle persists (localStorage)
- Filter pills are small rounded rectangles, not buttons; variant tags tinted terracotta

## Tag system (3 layers)

1. **Variant** (one per game): Freeform / Interior / Renovation / City Planning / Sandbox
2. **Per-game style vocabulary** (game_tags): Bloxburg -> Modern Villa, Ranch, No-Cheats, Speedbuild, Budget Build, Roleplay Home; Sims 4 -> Cottagecore, Tiny Home, Shell, Mansion; etc. (see seed.sql)
3. **Build tags** (build_tags): which vocabulary tags a build uses — the Post a Build form loads the selected game's tags automatically

## Suggested build order

Follow `docs/build-plan.md`: setup -> auth -> layout + directory -> game detail -> build showcase CRUD + profile -> likes/favorites/Top 10 -> compare tool + theme -> polish + deploy. Seed images may be placeholders (solid-color gradients fine).

## Definition of done

Every rubric point above is demoable on the deployed URL, with the seeded data visible on first load.
