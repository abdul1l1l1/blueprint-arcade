# Phase 2 QA report — Games (Directory + Detail)

Date: 2026-11-06

## Scope and branch

- Branch: `phase-2-games`, created after pulling the latest approved `main`
  (`cc4261d`, the Phase 1 merge).
- This is a **pre-merge report**. No merge or deployment is authorized by this
  report. Owner approval is required separately.
- Plain HTML/CSS/JavaScript, Node.js 24, Express 5, npm, and PostgreSQL/`pg`
  remain unchanged.
- Authentication implementation, Phase 1 tests, schema, seed content,
  dependencies/lockfile, shared theme/auth scripts, and Phase 3–5 feature
  implementations were not changed.
- The only server integration change mounts the games router with the existing
  database dependency so real QA fixture schemas can exercise the games API.

## Implemented

- `/games.html`: all eight seeded games, build counts and aggregate ratings,
  case-insensitive literal-text search of name/genre/description, sandbox and
  non-sandbox filters, four deterministic sorts, and query-string persistence
  across reloads. The filter uses the existing seeded boolean, not genre text.
- `/game.html?slug=...`: game description/genre/year, aggregate rating, per-game
  vocabulary, and only that game's credited, read-only builds, including
  descriptions, budget tiers, build types, and style tags.
- Public, read-only list/detail APIs with parameterized values, an allowlist
  for SQL ordering, safe validation/errors, and no private account fields.
- Loading, empty, invalid/missing/unknown slug, failure, and retry states.
  API-provided text uses DOM text nodes rather than HTML interpolation.
- The two pages use the existing brand/navigation and unchanged auth shell.
  Seed images remain empty, as approved; the pages do not pretend to provide
  build-image/carousel, editing, pinning, rating submission, or social controls.
- Comparison, related-game recommendations, profile, showcase CRUD, social
  actions, and release preparation are not added in this phase.

### Exact browsing behavior

- `GET /api/games?q=...&sandbox=true|false&sort=name|builds|rating|newest`
  returns `{ games }`. Omit optional values for all games.
- Default sorting: name A–Z. Other sorts: build count descending, rating
  descending, release year descending (unknown year last); ties use name,
  then stable database ID.
- Search is trimmed, case-insensitive, and limited to 120 characters.
  `%`, `_`, and backslash are literal characters, not SQL wildcards.
- Invalid query values return 400 with field errors.
- `GET /api/games/:slug` returns `{ game, tags, builds }`.
  Malformed slugs return 400; unknown well-formed slugs return 404.
- Game rating uses the **existing** `game_stats` view: mean of per-build average
  ratings, including unrated builds as zero. This is labeled “build rating,”
  not a direct rating of the game. Zero displays as “No ratings.”
- Tags are the game's vocabulary; build types remain per-build attributes.

## QA environment

- Replit development workspace; managed workflow
  `artifacts/api-server: API Server` runs the feature branch.
- Confirmed PostgreSQL database: `heliumdb`, schema `public`.
- Public content before the managed restart: 8 games, 10 builds, 5 demo users.
- Tests write only new retained `qa_p1_*` / `qa_p2_*` fixture schemas.
  No public QA data was deleted, overwritten, or reseeded.
- Production environment/database were not accessed or changed.

## Automated results

Command actually executed: `npm test`

**32 passed, 0 failed, 0 skipped/cancelled** (about 7.1 seconds).

### Phase 2 acceptance — 13/13 PASS

| Check | Result |
|---|---|
| P2.1 All eight seed games, correct descriptions, exact counts, existing aggregate ratings, anonymous read | PASS |
| P2.2 Case-insensitive/trimmed name, genre, description search; empty results; literal wildcards and injection-shaped input | PASS |
| P2.3 Sandbox and non-sandbox filters match the seeded booleans, including Hometopia | PASS |
| P2.4 Complete order for all four sorts, with deterministic name ties | PASS |
| P2.5 Search/filter/sort compose correctly | PASS |
| P2.6 Invalid/repeated parameters, unsupported sorts, and sort injection return safe field errors | PASS |
| P2.7 Every one of the eight slugs returns the exact vocabulary and only its builds, with correct credits/type/budget/tags and no private fields | PASS |
| P2.8 Games without builds retain descriptions and vocabulary, return empty builds and zero stats | PASS |
| P2.9 Unknown/malformed slugs return clear errors without cross-game data | PASS |
| P2.10 Simulated database failures return safe JSON; comparison remains the existing Phase 4 501 scaffold | PASS |
| P2.11 Complete directory and detail responses persist across application restart | PASS |
| P2.12 Both pages, actual controller, and stylesheet are served by the same Express app | PASS |
| P2.13 Isolated game fixture with no tags/builds and unknown release year remains browsable and sorts last by release | PASS |

### Phase 1 regressions — unchanged suite, 19/19 PASS

| Check | Result |
|---|---|
| Frontend: actual login/register handlers send values and redirect on success | PASS |
| Frontend: inline server validation and field focus | PASS |
| Frontend: login rejection/network failure do not redirect | PASS |
| Frontend: anonymous auth links and authenticated working Logout handler | PASS |
| P1.1 Node 24, database health, static pages, session schema | PASS |
| P1.2 Full seed and repeated initialization preserve all rows | PASS |
| P1.3 Seed failure rolls back; missing seed credentials rejected | PASS |
| P1.4 Incomplete seed reported without overwriting/deleting data | PASS |
| P1.5 Registration normalization, bcrypt, profile, session, safe public response | PASS |
| P1.6 Invalid inputs/password lengths and duplicate identities rejected | PASS |
| P1.7 Failed profile insertion rolls back user registration | PASS |
| P1.8 Invalid/missing logins and SQL injection rejected without session | PASS |
| P1.9 Case-insensitive login, session rotation, independent cookie jars | PASS |
| P1.10 Account, seed, and stored session survive application restart | PASS |
| P1.11 Logout expires cookie and invalidates session/replay | PASS |
| P1.12 Anonymous write guards remain 401; public scaffolds respond | PASS |
| P1.13 Malformed JSON, oversized requests, API 404, database-down health | PASS |
| P1.14 Missing session secret rejected; secure production-cookie behavior tested only in a QA fixture | PASS |
| P1.15 Accessible auth-form wiring, shared Logout wiring, and prohibited SQL/secret-fallback checks | PASS |

Expected safe 500/400/413 messages from deliberately injected failures appeared
in test output; they were asserted negative cases, not test failures.

## Browser acceptance — actual Playwright pass

| Check | Result |
|---|---|
| B1 Desktop directory: all eight cards; Bloxburg 3/1.6, Sims 4 2/2.5, Minecraft 0/No ratings | PASS |
| B2 Search via Enter; both sandbox filters; all four sort controls; combined city/non-sandbox/newest; URL/control/result persistence after reload | PASS |
| B3 Directory card → Bloxburg: description, all six vocabulary terms, exactly three credited builds and correct budget/type/style tags; directory → Minecraft zero-build state | PASS |
| B4 Missing, unknown, and malformed slugs: useful messages and working directory-return actions | PASS |
| B5 Browser-intercepted list/detail 500s and Retry recovery; delayed response loading; literal hostile-text rendering; empty vocabulary message | PASS |
| B6 Directory and detail at 390px: readable controls/content/navigation and no horizontal document overflow | PASS |

The browser pass used the real API for normal browsing and temporary browser-only
interceptions for failure/loading/hostile-text fixtures; it did not change the
database. All interceptions were removed and real game data was restored.
Desktop directory/detail, mobile directory/detail, and negative-case screenshots
were captured.

### Browser console note

The tester reported the expected resource errors from simulated 500 responses
and invalid-slug requests. It also noted one HTTP 400 resource message around
the malformed-slug return step without identifying the source in its log.
The malformed-slug API deliberately returns 400; the return action and restored
eight-game directory both passed. No other unexpected console error or
functional failure was reported. This log-source uncertainty is disclosed
rather than described as a completely error-free browser console.

## Managed QA restart and static checks

- Captured the complete live directory and Bloxburg detail JSON, restarted the
  actual managed QA workflow, and compared both responses: **PASS**, unchanged.
- After restart `/api/health` reported `status: ok`, `db: connected`: **PASS**.
- Workflow startup log: database and session storage ready.
- `node --check` on games route/controller: **PASS**.
- `git diff --check`: **PASS**.
- Static desktop screenshot of the running directory: **PASS**, real eight-game
  response and controls rendered.

## Approval gate

- Required Phase 2 checks: **PASS**.
- Phase 1 regression suite: **PASS**.
- Required acceptance checks not run: **none**.
- Known functional failures: **none**.
- Remaining uncertainty: the single unattributed browser 400 log described above.
- **MERGE STATUS: NOT MERGED — AWAITING OWNER APPROVAL.**
- **APPROVAL REQUEST: May I merge this tested feature branch into main?**
