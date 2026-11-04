# Blueprint Arcade 🏗️

A fan website for the **architecture / build-game community** — the players of Welcome to Bloxburg, The Sims 4, House Flipper, Cities: Skylines, and more.

**The problem it solves:** architecture-game knowledge is scattered across Roblox wikis, the Sims Gallery, and separate city-builder communities. Blueprint Arcade is one hub to **discover games, compare them, and show off your own builds**.

## Panel of Experts

| Expert | Role |
|---|---|
| **FroggyHopz** (Game Director, Welcome to Bloxburg) | Player-first design; the Bloxburg scene |
| **Phil — City Planner Plays** (professional urban planner) | Credibility & domain depth |
| **James Turner — The Sim Supply** (EA-commissioned Sims builder) | Build showcase UX & community |
| **Simone — UX / Full-Stack Product Designer** | Maps fan features to MVP requirements |

## MVP Checklist

- [x] Clear purpose & target audience (build-game fandom)
- [x] Database & persistence — Supabase (PostgreSQL): `db/schema.sql`, `db/seed.sql`
- [x] User accounts & auth (registration / login / logout, protected actions via RLS)
- [x] 5+ domain views: Build Showcase (landing) · Game Directory · Game Detail · Compare · Top 10 (+ Profile bonus)
- [x] Navigation — category sidebar + top action bar
- [x] Full CRUD on **Builds** (post / edit / delete / pin, owner-only)
- [x] Meaningful seed content — 8 real games + 10 credited builds
- [x] Search & filtering (keyword, variant, style tags, sorting)
- [x] Fan-specific interactive feature — game comparison tool + Top 10 ranking
- [x] Responsive design
- [x] Validation & feedback (form validation, toasts, empty states)
- [ ] Deployment (Vercel)

## 10 Custom Features

Search Bar · Category Filters · Sorting Options · Favorites Button · Star Rating System · Image Carousel · Like + Comment on Builds · Dark/Light Mode · Top 10 Builds List · Comparison Tool

## Tech Stack

Next.js + Supabase (PostgreSQL, Auth) + Tailwind CSS · deployed on Vercel

## Project Structure

```
db/
  schema.sql   -- 9 tables, views, indexes, row-level security policies
  seed.sql     -- 8 games + tag vocabularies + 10 credited builds
docs/
  design.md    -- concept, features, brand style
```

## Brand

Baby blue `#89CFF0` · slate blue `#6C9BD1` · ink navy `#12233B` · terracotta `#E07A5F` (CTA) · paper white `#F7F9FB`. Clean, minimal drafting aesthetic.
