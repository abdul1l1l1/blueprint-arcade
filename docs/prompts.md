# Blueprint Arcade — My Phase Prompts
These are the prompts I send my AI agent (Replit Agent or my coding assistant) each phase. I wrote them and I approve the results — the agent never moves to the next phase without my go-ahead.

## Kickoff (send once, before any code changes)

Read docs/requirements.md, docs/spec.md, docs/design.md, and agent-development.md completely. Follow their instruction priority. Inspect the repository and the Replit QA setup. Do not change code yet. Show me the Phase 1 scope, acceptance tests, branch plan, any conflicts or missing decisions, and the first action. Stop for my approval before beginning implementation.

## Phase 1 — Foundation and authentication
Start Phase 1 on branch phase-1-foundation-auth per agent-development.md. Verify the Express server, database schema, and seed data, then finish registration, login, and logout with bcrypt-hashed passwords and session auth. Give me the phase report with real test results before asking to merge.

## Phase 2 — Games (Directory + Detail)
Start Phase 2 on branch phase-2-games. Build the Game Directory (all 8 seeded games, build counts, ratings) and the Game Detail page (description, per-game tag vocabulary, builds in that game). Run the Phase 2 acceptance tests plus Phase 1 regressions, then give me the report and merge request.

## Phase 3 — Builds (Showcase CRUD + Post a Build + Profile)
Start Phase 3 on branch phase-3-builds-crud. Build the Build Showcase landing page, the Post a Build form, and My Profile. Enforce owner-only edit/delete/pin and the max-3-pinned rule server-side. Add search, filters, and sorting on the showcase. Test owner/non-owner access control and persistence, give me the report, and ask to merge.

## Phase 4 — Social features + Top 10 + Compare
Start Phase 4 on branch phase-4-social-stats. Build likes, comments, star ratings, favorites, the image carousel, the Top 10 page (score = avg rating x likes), and the Compare Games page. Run regressions for Phases 1-3, give me the report, and ask to merge.

## Phase 5 — Dark mode, polish, production readiness
Start Phase 5 on branch phase-5-polish-release. Finish Dark/Light mode on every page, responsive layouts, final polish per docs/design.md, and integration tests against docs/requirements.md. Prepare the production database and Replit Deployment — but do NOT deploy without my explicit approval.
