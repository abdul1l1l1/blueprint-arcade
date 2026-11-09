# Saved image/content work — review required

Saved separately before Phase 4 in the Git stash named
`saved-image-content-review-before-phase4`.

A complete patch backup and contents note also live in the QA harness's
`saved-work/` directory, outside the app's clean feature branch, so preservation
does not depend only on the checkout's separate Git metadata.

It contains construction-site build content, an App Storage asset-serving route
and helper, support for one approved local image URL in build validation and
rendering, post-form adjustments, the storage dependency/lockfile, related tests,
and a content note. It includes tracked and previously untracked files.

The saved changes are **not applied to the Phase 4 branch**. The owner must see
and review them before any application. Inspect with
`git stash list` and `git stash show --include-untracked -p <matching stash>`.
Use the name to identify the entry; stash numbers can change.

## Final submission checklist

- Show the saved diff to the owner before applying any of it.
- Review and merge appropriate portions within approved Phase 4/5 scope, or
  explicitly drop them with owner approval if superseded.
- Confirm a disposition before submission so this work is not orphaned.
- Do not silently restore the stash or include it in Phase 4 commits.
