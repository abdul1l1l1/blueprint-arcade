# Screenshot upload reconciliation — QA report

## Scope and branch

Restored the preserved screenshot-upload work onto
`reconcile-screenshot-uploads`, created from approved GitHub main after the
Phase 5 merge. The stash applied without conflicts. The original stash and
durable backup patch remain preserved.

No authentication replacement, frontend framework, seed reset, production
migration hook or publishing change was introduced. The existing plain form,
session identity, approved image routes and image URL support remain intact.
Documentation now explains the combined setup and current data-review policy.

## Acceptance checks and actual results

1. **PASS — compatibility and regressions:** locked npm install succeeded;
   `npm test` passed **86 tests, 0 failures, 0 skipped, 0 cancelled**.
   This includes all previous phase regressions and nine upload checks.
2. **PASS — access and validation:** automated coverage checks session/consent,
   JSON and same-site requests, owner-only completion/attachment, unready or
   missing paths, rate/expiry limits, unsafe paths, corrupt/disguised images,
   size/pixel limits and decoder behavior.
3. **PASS — failure recovery:** frontend handler tests cover invalid selection,
   clearing pending files without losing other entries, partial failures,
   retrying only failed files and idempotent completion after a lost response.
4. **PASS — actual browser upload:** at 390×844 a disposable user selected a
   generated PNG in the real file picker. Upload was disabled until consent.
   The upload completed with a real preview and a stable local WebP path.
5. **PASS — signed transfer evidence:** a focused follow-up attached listeners
   before upload. The PUT URL exactly matched the URL returned by the upload
   API; the real external-storage PUT returned 200 and completion returned 200.
   No signed URLs or credentials were recorded in this report.
6. **PASS — saved lifecycle:** the disposable build saved through the UI,
   its actual image loaded after reload, and edit/save retained the image and
   text. Owner deletion removed the build; signed-out media access returned 404.
7. **PASS — targeted cleanup:** removed only the disposable test account and
   its two exact test upload objects/metadata. The tester had already deleted
   its sole build. Existing build rows were compared before/after cleanup and
   were unchanged. Final counts: **5 intended accounts, 9 builds, 0 fixture
   schemas**. A genuine new owner post appeared during verification and was
   preserved alongside Construction Site and the seven remaining demo builds.
8. **PASS — QA schema:** additive/idempotent upload migration succeeded on QA.
   It changes no existing content or sessions. Tests drop their own schemas.

The first browser report lacked complete network capture because listeners
were attached late; only that missing evidence was repeated, not the full
journey. The focused follow-up resolved the verification gap.

## Remaining boundaries

The managed QA web service runs this feature branch for review. The GitHub main
branch was not changed by this reconciliation. No merge or publication was
performed.

Existing non-fatal storage SDK deprecation/stream-listener warnings remain.
Abandoned-object retention and unsaved drafts are already separate follow-ups;
neither was added here. Production checks remain not run because publishing
has not been authorized.

**Status: ready for review; separate merge approval required.**
