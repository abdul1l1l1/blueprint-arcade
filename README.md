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

## How I develop (solo, student-directed)
I split the build into 5 phases (foundation/auth, games, builds CRUD, social + Top 10 + compare, polish + deploy). Each phase happens on its own Git branch, gets acceptance-tested in the Replit QA workspace, and only merges to main after I review the results and approve. My prompts for each phase live in docs/prompts.md; the full rules are in agent-development.md.

## Documentation
- [docs/requirements.md](docs/requirements.md) — mandatory project requirements (source of truth)
- [docs/spec.md](docs/spec.md) — my approved Spec Doc
- [docs/design.md](docs/design.md) — concept, views, tag system, design principles
- [agent-development.md](agent-development.md) — my AI workflow: phases, branches, tests, approval gates
- [docs/prompts.md](docs/prompts.md) — the prompts I send the agent each phase
