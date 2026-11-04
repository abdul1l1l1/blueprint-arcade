# Blueprint Arcade

Abdul's build-showcase site for architecture & build games — a high school AI-assisted web development project, set up with the same stack and workflow as QuizQuest.

## What it is
Players post builds (title, game, description, images, budget tier, tags), browse a showcase, favorite and rate builds, like and comment, compare games, and climb the Top 10 (rating x likes).

## Tech stack
- **Frontend:** plain HTML, CSS, JavaScript
- **Server:** Node.js 24 LTS + Express 5 (serves static files and API routes)
- **Database:** Replit PostgreSQL via pg (parameterized SQL)
- **Auth:** express-session + connect-pg-simple + bcrypt
- **AI development environment:** Replit Agent
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
├── docs/              # requirements.md, spec.md, design.md
└── agent-development.md  # Phase-by-phase build contract for the AI agent
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

## Development phases
| Phase | Focus |
|---|---|
| 1 | Setup, database schema, authentication (bcrypt, sessions) |
| 2 | Game Directory + Game Detail + tag vocabularies |
| 3 | Build Showcase CRUD, Post a Build, Profile (max 3 pinned) |
| 4 | Likes, comments, ratings, favorites, Top 10, Compare |
| 5 | Dark mode, responsive polish, deployment |

Each phase is built on an isolated branch and merged to main after QA tests pass and student approval (see agent-development.md).

## Documentation
- [docs/requirements.md](docs/requirements.md) — mandatory project requirements (source of truth)
- [docs/spec.md](docs/spec.md) — approved Spec Doc
- [docs/design.md](docs/design.md) — concept, views, tag system, design principles
- [agent-development.md](agent-development.md) — agent contract, phases, Git workflow
