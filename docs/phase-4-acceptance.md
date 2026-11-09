# Phase 4 acceptance checklist

Branch: `phase-4-social-stats`, based on latest merged `main`.
Phase 3 is merged; owner explicitly authorized starting Phase 4.
No authentication replacement, production changes, or merge without approval.

## Observable checks

1. Visitors read builds, reaction counts, comments, ranking and comparison;
   reaction writes and personal favorites require a session.
2. Likes/favorites toggle once per user/build, isolate users, and remain unique
   under concurrent requests.
3. Ratings accept integers 1–5 and update the user's existing rating; aggregates
   reflect every user's rating without duplicate rows.
4. Comments validate nonempty text (up to 2000 characters), preserve literal
   content, use session-owned authorship, and render without executing HTML.
5. Favorites lists complete saved builds, survives reload/restart, and removes
   unsaved/deleted builds with a meaningful empty state.
6. Build image carousel supports previous/next, position, keyboard-accessible
   buttons, and safe missing/broken-image states.
7. Top 10 shows at most ten builds with score = exact average rating × likes,
   descending; deterministic ties use rating, likes, then ID. Formatting must
   not change the ordering.
8. Compare accepts 2–3 distinct existing games, preserves selected order,
   aligns genre/year/sandbox/build-count/rating/tag rows, highlights numeric
   winners (including ties), and gives an evidence-based verdict.
9. Invalid IDs/payloads/selections and database failures return explicit safe
   errors; frontend loading/error/retry/signed-out states work.
10. Social state and sessions persist after app restart; owner deletion cascades
    only the deleted build's related data.
11. Run all 50 existing Phase 1–3 checks, retaining their coverage. The former
    comparison-501 expectation is updated to the now-required public success.
12. Run Phase 4 automated checks and a focused real-browser journey covering
    reaction controls, favorites, carousel, ranking and comparison; report actual
    results before requesting merge approval.

Saved image/content work remains separate; see `saved-image-content-review.md`.
