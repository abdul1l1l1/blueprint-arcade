# Phase 5 QA report — Themes, polish and release preparation

## Scope and environment

Phase 4 was confirmed approved/merged at `5926cf3`. Fetched remote main,
preserved the matching local Phase 4 snapshot, fast-forwarded main, then
created `phase-5-polish-release`. No feature was developed on app main.

QA is the Replit workspace, PostgreSQL `heliumdb` / `public`, served by managed
`artifacts/api-server: API Server`. Same plain frontend/Node 24/Express/pg/npm/
bcrypt/PostgreSQL-session stack; no authentication replacement.

## Implemented

- Early shared persistent light/dark theme on all ten pages, including auth.
  Accessible label/pressed state, cross-tab updates, safe blocked-storage case.
- Shared brand colors, flat surfaces, thin borders, keyboard focus, touch
  targets, reduced motion and mobile/tablet/desktop layouts.
- Tablet directory controls reflow with the sidebar instead of clipping Search.
- Restored owner-approved Construction Site serving, safe validation, card/
  carousel rendering and editing; fixed private App Storage object only.
- Transactional additive import, idempotent and preserving the original ten.
- Explicit guarded QA cleanup; test fixtures now remove their own schemas.
- Correct production build/run/health settings in the QA harness artifact;
  no watch server, startup DDL, seed or cleanup in production commands.
- Documented separate production database initialization through Publishing,
  not a custom migration hook. No publish was initiated.

## Saved-content disposition

The owner viewed the actual original screenshot and the saved 13-file patch
inventory, including the proposed eleventh build, credit and default fields.
They explicitly chose **Restore support and eleventh build**.

Compatible changes were restored, not blindly applied over Phase 4 routes.
The Phase 4 carousel now accepts the same exact approved local image path as
the editor/server. Other local/credential/unsafe URLs remain rejected.

Construction Site: Abdul, Bloxburg, Freeform, Starter, unpinned, no invented
tags. Description discloses that the actual budget was not supplied.
The original root `images/construction-site.png` and private durable object
are retained; the historical patch is a backup, not unresolved future work.

Live image: HTTP 200 `image/png`; SHA-256 equals the supplied original:
`c40bfeba9312e95c328214a740b41d569a850b8831b559ee69f2a92196543767`.
Actual import preserved all ten original build rows; repeat import skipped.

## Automated evidence

`cd blueprint-arcade && npm test`: **70 passed / 0 failed / 0 skipped /
0 cancelled**.

| Group | Passed |
|---|---:|
| Phase 1 auth frontend handlers | 4 |
| Phase 1 PostgreSQL/HTTP integration | 15 |
| Phase 2 directory/detail/compare regressions | 13 |
| Phase 3 frontend card handlers | 3 |
| Phase 3 CRUD/profile/permissions/concurrency/persistence | 15 |
| Phase 4 social/Top 10/Compare integration | 12 |
| Restored image serving/validation/import tests | 3 |
| Phase 5 theme/all-page wiring tests | 3 |
| Phase 5 real-DB additive import + cross-feature integration journey | 2 |

New integration covers registration → create → search/combined filters/sorts →
like/rating/comment/favorite → Top 10/compare → edit/profile → delete → logout.
Earlier tests exercise failure paths, ownership, fourth-pin rejection,
concurrency, injected DB errors, restart persistence and bcrypt storage.
Expected logged 400/413/500 responses are deliberately tested failure paths.

The first new journey run found incorrect API-envelope assumptions in the test
harness (`favorites`, `top`, and the comparison path). The harness was corrected
to the existing route contracts; the subsequent complete run passed 70/70.

Production build command `npm ci --omit=dev` succeeded; runtime imports for
bcrypt, Express, pg and App Storage succeeded on Node 24.22.1. npm reported
zero dependency vulnerabilities. JavaScript syntax and `git diff --check`
passed.

## Browser evidence — initial pass

One real browser journey registered two unique synthetic accounts and exercised
all ten feature categories without changing seeded builds. Its five generated
builds were deleted through owner APIs.

| Requirement | Observed result |
|---|---|
| Registration/login/logout, invalid login | PASS |
| Build create/read/edit/delete and owner/nonowner controls | PASS; nonowner PUT 403 |
| Three pins and fourth-pin rejection | PASS; fourth API request 409 |
| Search and game/type/budget/tag combination | PASS; one matching result |
| Newest/rating/likes sort UI and URL | PASS |
| Favorites save/reload/unsave | PASS |
| Rating 5 then 3, one persisted user rating | PASS |
| Like and literal comment persistence | PASS |
| Two-image carousel forward/back/wrap | PASS |
| Top 10 exact score rule/order/ten-result maximum | PASS |
| Two/three-game compare, rows/leaders/verdict, invalid one-game feedback | PASS |
| Directory eight games, sandbox/search/four sorts, correct Bloxburg detail | PASS |
| Construction Site image and Abdul creator link | PASS; real image loaded |
| Theme labels/pressed state, navigation/reload, cross-tab, blocked storage | PASS |

Carousel image demonstration used two deliberately intercepted HTTPS
`example.test` URLs with distinct SVG fixtures. These were test images, not
uploads or owner content. The actual Construction Site image was not mocked.

All ten routes were checked at 390×844, 768×1024 and 1440×1000 in both themes
(60 page/width/theme cases). Initial result: **58 passed, 2 failed**.
Both failures were Games at tablet width: document scroll width 822px for a
768px viewport and clipped Search. Comparison scrolling was contained in its
own wrapper. This defect was corrected with tablet-specific form columns.

The initial browser listeners reported no uncaught page errors. Expected
invalid-login 401, one transient game-detail 502 recovered using Retry, and
an un-intercepted `example.test` request in a separate context were recorded.
No claim is made that this initial pass had zero network errors.

## Final verification status

Focused follow-up to the same browser: **PASS**, without repeating the full
journey or matrix. The two corrected tablet cases now measure document width
753px within the 768px viewport; Search is fully visible and Minecraft search
works in both themes. Combined evidence: all **60 matrix cases pass**.

Additional edge cases passed: failed first image shows unavailable feedback
with enabled carousel controls; Next/Previous/wrap recover to the real approved
image (natural width 1320); Like on/off/on persists after reload; Tab reaches
navigation/theme/form controls with visible 3px focus; reduced motion disables
card transitions/skeleton animation. Sampled cards have 1px solid borders and
UI chrome has no emoji. Intentionally aborted broken-image fixture is expected;
no new uncaught page errors were recorded.

Cleanup applied in one guarded QA transaction:
- Four confirmed synthetic accounts removed, including their session/dependent
  records; the browser had already deleted its six generated builds.
- 25 old isolated fixture schemas removed.
- Follow-up dry run: zero synthetic accounts, zero fixture schemas.
- Final public counts: **8 games, 5 intended accounts, 11 intended builds,
  5 sample ratings, 5 sample likes, 2 sample comments, 0 favorites**.
- All intended build rows and seed relationships verified unchanged.

Source changes are committed/pushed on the named branch with a draft PR; exact
commit and PR identifiers are supplied in the owner-facing phase report.
This document is pre-merge evidence, not a merge approval.

## Production boundary

Replit metadata reports **not deployed**; there is no production URL. Separate
production database provisioning/initial data copy belongs to Publishing after
explicit owner authorization. No production database write, custom migration,
seed/reset or deployment occurred.

Published-app acceptance and live HTTPS smoke checks are **NOT RUN**, expressly
pending publication approval. QA success does not claim production verification.
See `production-readiness.md` for the exact handoff.

### Publishing registration blocker

The workspace currently registers only an `api` artifact (the existing Express
app) and a `design` canvas. The project snapshot reports that this artifact set
is not publishable. Current artifact inventory confirms that no publishable web
artifact has been registered. Updating the API production commands does not
by itself resolve that registration limitation.

Production commands and the cleaned initial-data snapshot are prepared, but
production readiness is **not complete** until the existing plain app is
represented in a supported publishable web-artifact setup. No immutable artifact
kind was changed, no React replacement introduced, and no unapproved structural
refactor was attempted. Ask the owner before that additional setup or any merge
with this known blocker. No production database or live URL was fabricated.

**MERGE STATUS: NOT MERGED — awaiting owner decision on the publishing blocker
and separate merge approval.**
