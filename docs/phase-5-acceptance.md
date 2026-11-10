# Phase 5 acceptance plan

Base: approved Phase 4 main `5926cf3`; branch `phase-5-polish-release`.
Plain HTML/CSS/JS, Node 24, Express 5, npm, pg, and session auth remain unchanged.
The owner approved restoring the saved image support and eleventh build after
viewing the screenshot and proposed defaults. Original ten builds stay intact.

## Observable checks before merge

1. Five required domain views and all supporting/auth pages load.
2. Registration, login, invalid login, logout, bcrypt passwords and protected
   writes work; no credential data appears in public responses.
3. Full build CRUD with all fields persists after restart; nonowners receive
   403; at most three pins even with concurrent writes.
4. Search is literal/case-insensitive; all four filters combine; newest,
   rating and likes ordering agree with database statistics.
5. Favorites are per-user and persist; unsave updates the Favorites view.
6. Ratings are integer 1–5, upsert one per user/build, with safe failures.
7. A multi-image build visibly moves forward/back and wraps; failed images
   retain usable controls; the approved local image works on all card views.
8. Like toggles and safe literal comments persist with accurate counts;
   signed-out actions show guidance and do not mutate.
9. Dark and Light themes apply before content loads on all ten pages,
   survive navigation/reload, update controls and other tabs, and remain
   usable when storage is blocked.
10. Top 10 orders at most ten builds by exact average rating × likes with
    deterministic ties, reflected visibly.
11. Compare accepts two/three distinct games with aligned stats, vocabulary,
    leader highlighting and verdict; invalid selections show feedback.
12. Game directory lists all eight games, search/sandbox/sort work, and every
    detail view shows the correct game vocabulary/builds.
13. Mobile (390), tablet (768), desktop (1440) in both themes: no document
    overflow, reachable navigation/actions, readable forms/cards, and contained
    comparison-table scrolling; keyboard focus and reduced-motion support.
14. No UI emojis/decorative textures; flat cards and thin borders match design.
15. All original seed content/credits and social samples remain unchanged;
    approved Construction Site is the only additional build. Remove only
    positively identified synthetic QA records/schemas, never unknown data.
16. Production commands install locked npm dependencies and run the same
    Express server without watch mode, seed/reset scripts or startup DDL.
    Production database is separate and initialized only via the approved
    Publishing flow; never publish as part of this phase.

Run automated integration/regression tests and a single browser acceptance
journey covering the ten features and responsive/theme matrix. Record actual
pass/fail/not-run evidence. A deployment and its live checks are NOT RUN until
explicit owner authorization; release preparation is not a deployment.
