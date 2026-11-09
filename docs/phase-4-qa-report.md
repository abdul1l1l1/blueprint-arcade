# Phase 4 QA report — Social features, Top 10, and Compare

## Scope and approval status

- Phase 3 is merged into main. Owner explicitly authorized Phase 4, then
  authorized separately saving the unfinished image/content work.
- Fetched origin and fast-forward checked main before creating
  `phase-4-social-stats` from `aa19a6d` (merged Phase 3).
- **NOT MERGED — awaiting separate owner approval.**
- No authentication replacement, production database work, or deployment.

## Preserved work

The named stash `saved-image-content-review-before-phase4` contains all
13 unfinished image/content files, including previously untracked files.
A complete 48,509-byte patch backup and short contents note are retained in
the QA harness `saved-work/` directory, outside this feature branch.
See `saved-image-content-review.md`.

None of those changes were applied to Phase 4. The carousel uses existing
HTTP(S) image URLs and does not need the saved local-image content.
Before any restoration, show the changes to the owner for review. Final
submission review must decide what to merge within approved Phase 4/5 scope
or drop if superseded; nothing should be orphaned.

## Implemented

- Session-owned like and favorite toggles, serialized to prevent duplicate
  concurrent toggles; database uniqueness remains enforced.
- Integer 1–5 ratings with one rating per user/build and upsert behavior.
- Public comments, session-owned posting, nonempty/2000-character validation,
  safe literal-text rendering, explicit failures and preserved failed drafts.
- Public reaction counts plus per-session liked/favorited/rating state.
- Private Favorites view, full build cards, removal and empty/signed-out states.
- Per-build image carousel with previous/next, position, wraparound, accessible
  controls and recoverable unavailable-image state.
- Social controls on showcase, profiles, game detail, Favorites and Top 10.
- Top 10: exact average rating × likes, maximum ten, deterministic ties
  (rating, likes, ID). Display rounding does not determine order.
- Comparison of 2–3 distinct games, ordered columns, aligned genre/year/
  sandbox/build-count/rating/vocabulary rows, numeric leaders including ties,
  and a factual verdict without an invented overall score.
- Loading/retry/error states, request-order protection for comparison/ranking,
  and all existing owner CRUD/pin controls retained.
- Social router now receives the configured database dependency, so isolated
  acceptance fixtures exercise the same routes without touching public QA data.

## QA environment

- Application branch: `phase-4-social-stats`.
- Runtime: managed `artifacts/api-server: API Server`, plain Node/Express app.
- `/api/health`: HTTP 200, `status: ok`, `db: connected`.
- Workflow restarted after the implementation; startup logs show database and
  session storage ready.
- Workspace PostgreSQL is QA. Automated tests create isolated retained
  `qa_p1_*`, `qa_p2_*`, `qa_p3_*`, and `qa_p4_*` schemas and refuse production.
- No production configuration or database was changed.

## Automated results

Command: `cd blueprint-arcade && npm test`

**62 passed / 0 failed / 0 skipped / 0 cancelled**.

| Group | Result |
|---|---|
| Existing authentication frontend handlers | 4/4 PASS |
| Phase 1 foundation/authentication | 15/15 PASS |
| Phase 2 directory/detail | 13/13 PASS |
| Phase 3 shared frontend handlers | 3/3 PASS |
| Phase 3 build CRUD/profile/access control | 15/15 PASS |
| Phase 4 social/stats/comparison | 12/12 PASS |

All 50 previous checks were retained. The obsolete Phase 2 expectation that
comparison returns 501 was updated to require its now-implemented public 200
response; database error checks in that test remain intact.

### Phase 4 acceptance results

| Check | Result |
|---|---|
| P4.1 Public reads, session-required writes/favorites, no-store state | PASS |
| P4.2 Like toggles, session ownership, user isolation, concurrent toggles | PASS |
| P4.3 Integer/range validation, upsert, concurrent rating uniqueness | PASS |
| P4.4 Comment validation, trimming, literal markup, authorship, public data safety | PASS |
| P4.5 Full private favorite cards, isolation, toggle and concurrency | PASS |
| P4.6 Malformed/missing build IDs across social endpoints | PASS |
| P4.7 Exact Top 10 scoring, ordering, deterministic ties, ten-result limit | PASS |
| P4.8 Two/three-game selection order, matching stats and vocabulary | PASS |
| P4.9 Invalid/repeated/duplicate/excess/nonexistent comparison selections | PASS |
| P4.10 Reactions, comments, favorites and sessions persist after restart | PASS |
| P4.11 Safe JSON errors for injected database failures | PASS |
| P4.12 Owner deletion cascades social rows and clears saved build | PASS |

Additional checks: changed JavaScript syntax and `git diff --check` passed.
Expected 400/413/500 logs in automated tests are deliberately injected failure
paths, not unexpected QA runtime failures.

## Focused browser results

One focused browser journey registered a unique test-only account and created
one Bloxburg test build with two HTTP image URLs. No seeded build/account was
edited. Its QA account/build remain as retained verification data.

| Browser check | Actual result |
|---|---|
| Register, post build, find through showcase search | PASS |
| Like on/off/on, counts 1/0/1 and reload persistence | PASS |
| Rate 5 then 3; one rating, average 3; persists on reload | PASS |
| Post literal `<b>QA literal comment</b>` without executing markup; reload | PASS |
| Carousel 1/2 → 2/2 → 1/2; URL changes; focusable Next | PASS |
| Save → Favorites → unsave → empty state → re-save/reload | PASS |
| Ten leaderboard ranks in descending score; API/formula agrees | PASS |
| Two/three-game tables: aligned six rows, leaders and factual verdict | PASS |
| One/four-game selection rejected; stale results cleared | PASS |
| Game-detail social controls and stored literal comment | PASS |
| Mobile Compare table scrolls within its wrapper; controls reachable | PASS |
| Signed-out mutation gives login guidance and does not write | PASS |

The browser found a narrow Favorites layout because its wrapper used the game
layout class without game CSS. Favorites and Top 10 now use their loaded build
layout class. A fresh 390px Favorites screenshot confirmed a full-width mobile
page with reachable navigation/actions and signed-out guidance.

A narrow follow-up to the same browser resolved an image-rendering timing
caveat: after awaiting image decode, the second image was visibly “Back,”
`currentSrc` matched `text=Back`, `complete` was true, and dimensions were
800×450. No interception or generated replacement images were used.

Browser console/network coverage was partial: the tester attached listeners
near the end, so no claim is made that the entire run was console-error-free.
The observed signed-out 401 is the intended access-control response.

## Remaining issues and final review

- No required Phase 4 failure or unrun acceptance check remains.
- The preserved image/content changes are intentionally unapplied and still
  require owner review and a final disposition before submission.
- Approved seed screenshots and image-upload support remain separate existing
  tasks, not silently included in Phase 4.
- Phase 5 polish/release preparation remains separately authorized work.

## Approval gate

**MERGE STATUS: NOT MERGED — AWAITING OWNER APPROVAL.**

**APPROVAL REQUEST: May I merge this tested feature branch into main?**
