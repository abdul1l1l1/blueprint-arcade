# Owner-approved original demo illustrations

The owner explicitly selected **“Approve clearly labeled illustrations”** on
2026-11-09 for the ten original fictional demo builds. These are AI-generated
architectural concept illustrations, not game screenshots, and not evidence of
real builds by the credited demo members. The visible caption and accessible
image text say **“Illustration — not an in-game screenshot.”**

The title/owner/game mapping and fixed image/object paths are in
`public/js/approved-images.js`. Each filename matches its build title slug.
The original credits, descriptions, tags, pins, ratings, likes and seed definitions
remain unchanged. Illustration authorship is not attributed to the demo members.

## Assets and safe application

- Local retained copies: workspace-root `images/demo-illustrations/*.jpg`.
- Durable copies: App Storage `public/demo-illustrations/*-v1.jpg`.
- SHA-256 inventory: `docs/demo-illustration-manifest.json`.
- Private bucket objects are served only by the ten fixed app routes in
  `routes/approved-assets.js`. No anonymous bucket URLs, development hostnames,
  expiring links, or arbitrary bucket-path access.
- Large image bytes are excluded from Git and deployment; App Storage is the
  runtime source. To recover local copies, download each manifest-listed object
  through the existing storage helper and verify its hash.
- `node db/demo-illustration-assets.js` uploads missing objects only, rejects
  conflicting bytes, uses create-only preconditions, and verifies stored hashes.
- `node db/add-demo-illustrations.js` is a read-only dry run.
- `node db/add-demo-illustrations.js --apply --qa` verifies durable assets first,
  then fills only empty `image_urls` in one transaction. All ten identities must
  resolve uniquely by title, owner and game. Existing exact matches are skipped;
  other nonempty images, renamed/missing/duplicate targets, or concurrent image
  changes abort. No rows are inserted, no seed is rerun, no other fields change.
- Neither operation runs at startup or from `db/seed.js`. Both refuse production.
  A fresh QA installation should use the unchanged normal seed first, then run
  this explicit content operation if the owner wants the approved illustrations.

## Construction Site remains separate

`docs/construction-site-content.md` and the previous asset route were inspected
in the preserved patch because they are not applied in this checkout.
`saved-work/image-content-review-before-phase4.patch` remains untouched.
No Construction Site record, screenshot, or saved code was restored, replaced,
or dropped. Its disposition still requires the owner's separate review.

### Compatibility with incoming main

The paragraph above records the original task's state. Main subsequently included
the separately owner-approved Construction Site support documented in
`docs/saved-image-content-review.md`. Rebase resolution preserves that PNG route,
its exported constants, storage client, and browser/edit validation alongside the
ten JPG illustration routes. Construction Site is not labeled as an illustration.
No content import or data update was run during conflict resolution.
The duplicate asset-router mount introduced by automatic merging was removed.
The combined suite passed **77 tests, 0 failures, 0 skipped** after resolution.

## QA scope

Workspace database/schema confirmed as `heliumdb` / `public`; production was
not accessed. Work is on `demo-build-illustrations`, not main. Existing unrelated
checkout changes were retained. No merge, push, or deployment is authorized by
this illustration approval.

### Verification results

- `npm test`: **69 passed, 0 failed, 0 skipped**. Includes real PostgreSQL
  fixture checks for all ten mappings, dry-run, repeat safety, conflicts,
  missing/duplicate identities, asset verification failure, and preservation of
  all unrelated build fields and related tables. HTTP tests cover all fixed
  asset routes, honest failures and unapproved-path rejection. Browser-handler
  checks cover visible labels, alt text, URL safety and unchanged credits.
- The workspace QA apply filled **10** empty covers. Full before/after row
  comparisons confirmed only `image_urls` changed. Related users, profiles,
  games, tags, ratings, likes, comments and favorites stayed identical.
  Repeating the operation changed **0** rows.
- All ten App Storage copies and all ten live app-served JPG responses matched
  the local SHA-256 inventory. `/api/health` returned 200 with DB connected after
  restarting the managed service.
- Full-page showcase capture confirmed images, labels and original credits
  render together. The final below-fold image is lazy-loaded; its live bytes
  were verified independently with the other nine images.
- `git diff --check` passed for the task changes. Seed definitions, seed behavior
  and the preserved Construction Site patch were not modified.
- The storage SDK emits non-fatal external-credential deprecation and stream
  listener warnings during downloads. Storage checks and HTTP requests succeed;
  no authentication configuration was changed from the platform's template.
- No new browser test pass was necessary for this content/asset change; existing
  automated HTTP and browser-handler checks plus the preview covered its scope.
- Existing queued upload, community-control regression and final display-check
  tasks cover the planned next steps; no overlapping follow-ups were added.
