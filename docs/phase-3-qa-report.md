# Phase 3 QA report — Builds (Showcase CRUD + Post a Build + Profile)

Date: 2026-11-06

## Scope, branch, and approval status

- Phase 2 was approved and merged. Latest `main` was pulled before creating
  `phase-3-builds-crud` from `ff403e3`.
- This is a **pre-merge report**. The phase is **NOT MERGED — awaiting owner
  approval**. No production changes or deployment were performed.
- Implemented only Phase 3: public build showcase, create/edit form, public/
  owner profile, owner-only delete/pin, maximum three pinned builds, and
  showcase search/filter/sort.
- Stack remains plain HTML/CSS/JavaScript, Node.js 24, Express 5, npm and `pg`.
- Authentication implementation, existing Phase 1/2 tests, game browsing,
  schema/seed content, dependencies/lockfile, and shared auth/theme scripts
  are unchanged. The pre-existing Top 10 SQL is unchanged apart from using the
  injected database dependency shared with profile tests.
- Phase 4 social actions, favorites, rating submission, carousel, Top 10/
  comparison UI, and Phase 5 release work are not implemented here.

## Implemented behavior

- `/`: build cards with real descriptions, creator/profile and game links,
  budget, type, style tags, first image, existing rating/like aggregates, and
  owner controls. Descriptions can be expanded; no build-detail/carousel
  screen is fabricated.
- Showcase query: `q` searches literal title/description text ignoring case;
  `game` is a game slug; `build_type`, `budget_tier`, and exact `tag` compose
  with AND. `sort` is `newest` (default), `rating`, or `likes`, descending with
  deterministic ties. Apply/Clear and query-string reload are functional.
- `/post.html`: create; `/post.html?id=<uuid>`: owner edit with all fields and
  current tags prefilled. Changing game resets incompatible tags and loads
  the selected game's vocabulary. Controls wait for metadata; stale tag
  requests cannot overwrite the current selection.
- Errors preserve form entries, re-enable submission, and show feedback.
  Successful create/edit opens the owner's profile with the changed build
  visible and a saved message.
- `/profile.html`: signed-in user or sign-in prompt; `?username=...` opens a
  public profile. Builds are pinned first. Counts, ordering and owner controls
  update after mutations. Deleted builds do not leave a false saved banner.
- Title and valid game/budget/type are required. Description, images and tags
  retain their existing optional schema states. Supplied images must be full
  HTTP(S) URLs without credentials; tags must be unique entries in that game's
  vocabulary. Unsafe image protocols and cross-game tags are rejected.
- Cards support the first image, no-image state, and failed-image fallback.
  The existing ten demo builds still have empty image arrays; no game
  screenshots were fabricated or assigned to fictional builds.

### Server guarantees

- `GET /api/builds` → `{ builds }`; `GET /api/builds/:id` → `{ build }`.
- `POST /api/builds` → 201 `{ build }`; `PUT /api/builds/:id` → 200 `{ build }`.
- `DELETE /api/builds/:id` → `{ deleted: true }`, after UI confirmation.
- `POST /api/builds/:id/pin` uses the explicit desired `{ is_pinned: boolean }`.
- `GET /api/stats/profile/:username` → `{ profile, builds }`, public and
  case-insensitive, excluding account secrets.
- Ownership comes only from the stored session, not submitted owner fields.
  Anonymous writes return 401; non-owner changes 403; malformed input 400;
  missing builds 404; fourth-pin attempts 409.
- All mutations lock the same owner's row before reading/changing build and
  pin state. Create, update, delete and pin use transactions; pin counting
  cannot race across endpoints. Tags and build fields commit or roll back
  together. Pinned builds can be edited/idempotently pinned while at the cap.
- Public responses contain no email, password hash, role, or session contents.
  SQL values are parameterized and sorting identifiers come from fixed clauses.

## QA environment and data safety

- Running branch: `phase-3-builds-crud`.
- Replit development workspace, managed workflow
  `artifacts/api-server: API Server`; confirmed database `heliumdb`, public
  schema. Production was not accessed.
- Workflow restarted after implementation; startup confirmed database/session
  storage ready. `/api/health` returned DB connected.
- Automated fixtures use new retained `qa_p3_*` schemas, alongside unchanged
  `qa_p1_*` and `qa_p2_*` fixture schemas. No original public rows were deleted,
  overwritten or reseeded.
- Browser testing created two clearly synthetic `p3qa_*` member accounts in
  separate sessions. Those accounts remain; no credentials are in this report.
  Only four builds created by that pass were deleted, through their owner API.
- Final public verification: **8 games, exactly the original 10 builds,
  7 users (5 original demo accounts + 2 browser QA accounts)**.

## Automated tests — actual results

Command: `npm test`

**50 passed, 0 failed, 0 skipped/cancelled**, about 10.8 seconds.

### Phase 3 backend acceptance — 15/15 PASS

| Check | Result |
|---|---|
| P3.1 Anonymous showcase returns ten complete credited seed builds, correct tags/fields and no secrets | PASS |
| P3.2 Literal/case-insensitive search; game/type/budget/tag filters, combined constraints and empty results | PASS |
| P3.3 Newest/rating/likes order on seed data; malformed/repeated/injection-shaped queries rejected | PASS |
| P3.4 Public case-insensitive profiles, correct owner builds/pins and unknown-profile 404 | PASS |
| P3.5 Anonymous create/edit/delete/pin denied; two actual authenticated sessions established | PASS |
| P3.6 Full create persists images/tags, ignores spoofed owner and appears in showcase, game, profile and read API | PASS |
| P3.7 Invalid fields, unsafe URLs, wrong-game/duplicate tags fail without partial creates | PASS |
| P3.8 Non-owner edit/delete/pin return 403 and leave original data untouched | PASS |
| P3.9 Owner edit updates game/text/images/budget/type/tags; invalid edits preserve previous state | PASS |
| P3.10 Three pins allowed, fourth rejected through all three write paths; no partial writes; unpin frees slot | PASS |
| P3.11 Five concurrent mixed create/edit/pin requests yield exactly three pins and two 409s | PASS |
| P3.12 Injected tag-write failure rolls back edited fields and previous tags; error details remain private | PASS |
| P3.13 Created/edited/pinned builds and authenticated session survive server close/recreation against PostgreSQL | PASS |
| P3.14 Owner deletion removes chosen build/tags only and remains deleted after server restart | PASS |
| P3.15 Malformed/missing IDs and invalid pin payloads fail explicitly without SQL leakage | PASS |

### Phase 3 actual frontend-handler tests — 3/3 PASS

| Check | Result |
|---|---|
| Creator link uses username rather than display name; hostile-looking title remains text | PASS |
| Only owner gets controls; canceled delete sends no request; confirmed delete and pin refresh data | PASS |
| Failed mutation shows error without false refresh; unsafe covers rejected; image-failure fallback retains pin badge | PASS |

### Earlier regression suites — 32/32 PASS

- **Phase 1: 19/19 PASS**, unchanged tests: four actual auth-handler checks and
  fifteen integration checks covering schema/runtime, seed safety, register/
  login/logout, validation, sessions/rotation/isolation, restart persistence,
  permissions, JSON/errors/health, secure cookies and auth wiring.
- **Phase 2: 13/13 PASS**, unchanged tests: all eight games/stats, search,
  sandbox filters, all sorts/composition, query validation, every game's exact
  vocabulary/builds/credits, zero-build/invalid/error states, persistence,
  static page/controller serving and empty-vocabulary fixture.
- Expected 500/400/413 logs came from deliberately injected negative cases;
  they were asserted test behavior, not failures.

## Browser journey — actual Playwright results

| Check | Result |
|---|---|
| Anonymous showcase: ten seed builds, no owner controls; combined Beach/Bloxburg/freeform/starter/No-Cheats filter; URL reload; clear; all sort controls | PASS |
| Creator link opens the correct Abdul profile; anonymous post/My Profile show useful sign-in states | PASS |
| Owner creates build with description, image, tags and pin; profile saved notice/control/data and reload persistence | PASS |
| Edit prefills all fields; changing game resets tags; updated title/description/image/budget/type/tag appears in profile, showcase and game detail | PASS |
| Browser-intercepted save 500 preserves all entries and re-enables Save; retry succeeds | PASS |
| Fourth-pin error visible with cap unchanged; unpin then pin succeeds; reload shows three pins first | PASS |
| Second user's profile view has no owner controls; direct edit URL is disabled and unpopulated | PASS |
| Canceled delete preserves build; confirmed delete updates counts, clears saved banner, and stays deleted after reload | PASS |
| Literal hostile-looking title does not execute or create injected markup | PASS |
| Owner profile and form usable at desktop and 390px; no horizontal document overflow | PASS |
| Cleanup removes only four pass-created builds; original ten seed builds remain | PASS |

The image rendering check used browser-only local SVG fulfillment of a fixture
HTTPS URL (640×420 rendered dimensions), not a claim that an external image
service was available. Interceptions were removed afterward.

Browser console/network observations:

- Expected simulated save 500 and real cap-rejection 409 were observed.
- A separate viewer context attempted the deliberately nonexistent
  `example.test` image URL without fulfillment and reported DNS failure.
  This was a test fixture network error, not an application exception.
- No uncaught JavaScript exception was reported.
- Optional browser-specific failed-image fallback and edit-form 409 variants
  were **not run**. These are covered respectively by the actual handler test
  and backend 409/rollback tests; general form-value preservation was exercised
  with a browser 500. No required acceptance behavior is left unverified.
- Desktop/mobile owner form/profile and key CRUD/failure screenshots were
  captured. No secrets or passwords were captured in the report.

## Additional checks and boundaries

- Node syntax checks for routes and all four new scripts: PASS.
- `git diff --check`: PASS.
- Static screenshot of the running showcase: PASS.
- Auth implementation, Phase 2 games files, schema/seed, dependencies/lockfile,
  and earlier tests checked unchanged against main: PASS.
- Final live health and exact original seed-build title set after browser
  cleanup: PASS.
- Post-merge regressions are not run yet because a merge is not authorized.

## Approval gate

- Known functional failures: none.
- Required acceptance checks not run: none.
- Disclosure: seed images remain empty; optional browser variants and fixture
  DNS failure are explained above.
- **MERGE STATUS: NOT MERGED — AWAITING OWNER APPROVAL.**
- **APPROVAL REQUEST: May I merge this tested feature branch into main?**
