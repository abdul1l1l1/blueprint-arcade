# Phase 1 — Foundation and authentication QA report

Date: 2026-11-04  
Branch: `phase-1-foundation-auth`  
Base: updated `main` after the approved specification corrections  
Merge status: **NOT MERGED — awaiting owner approval**  
Production: **not accessed, configured, or deployed**

## Implemented

- Kept plain HTML/CSS/JavaScript, Node 24, Express 5, npm and parameterized `pg`.
- Explicit, transactional, non-destructive QA initialization, including the
  PostgreSQL session table. Removed obsolete OIDS syntax and startup DDL.
- Transactional demo seeding and complete-seed verification. Incomplete seeds
  cause an explicit failure without changes. No drop/delete/reset operations.
- Seed password from `SEED_PASSWORD`; no credential fallbacks. Session secret
  required, including production; no fallback. Empty `.env.example` template.
- Atomic user/profile registration, corrected email validation, lowercase stored
  emails, case-insensitive email/username lookup and uniqueness, preserved
  displayed username case, bcrypt hashes with explicit 72-byte input limit.
- Session regeneration/save at registration/login, PostgreSQL persistence,
  isolated sessions, logout invalidation and cookie expiration.
- Shared form handlers with field errors and accessible labels. Conditional
  top-bar account state and visible Logout control.
- API errors handled after the routes; malformed JSON/oversized requests return
  safe JSON. Unavailable database health returns 503 rather than a success.
- Committed npm lockfile and reproducible automated checks.

## QA environment

This newly created Replit project's **development** PostgreSQL 16.10 is QA.
Node.js is 24.22.1. The source checkout is independently on
`phase-1-foundation-auth`, not the Replit starter repository's main branch.
The managed service routes `/` and `/api/*` to the same imported Express app.

Public QA content: **8 games, 5 demo users, 10 original fictional-demo builds**,
with vocabularies, tags and sample social data. Images remain empty by approval
until Phase 3. Separate retained `qa_p1_*` fixture schemas contain test data.
No existing public QA rows were deleted or overwritten.

## Results

`npm test`: **19 passed, 0 failed, 0 skipped**.

| Check | Result |
| --- | --- |
| Login/register JavaScript submit and redirect handlers | PASS |
| Field validation rendering and focus | PASS |
| Login rejection and network-error feedback | PASS |
| Conditional top-bar state and Logout click handler | PASS |
| Node 24, DB health, static pages, 11-table fixture schema | PASS |
| Complete seeds and repeat init/seed preserve existing rows | PASS |
| Seed insertion failure rolls back; missing password rejected | PASS |
| Incomplete seed reports failure without mutation | PASS |
| Registration, profile, bcrypt hash, normalized identity, session | PASS |
| Invalid inputs, whitespace/missing-dot email, case-insensitive duplicates | PASS |
| Profile insertion failure rolls back user insert | PASS |
| Invalid/missing login and injection input rejected | PASS |
| Case-insensitive login, session rotation, independent sessions | PASS |
| New app instance retains account, seed and DB-backed session | PASS |
| Logout expires cookie and prevents old-session replay | PASS |
| Existing anonymous write guards and public scaffold routes | PASS |
| Safe JSON 400/413/404/500 and database-unavailable 503 | PASS |
| Missing secret failure and Secure production-cookie configuration | PASS |
| Served form wiring, shared Logout code, no destructive schema SQL | PASS |

Additional checks against the actual proxied running QA service:

- `npm run db:init` followed by `npm run db:seed`: **PASS**.
- Repeated initialization/seed verification: **PASS**; no reset or duplication.
- `/api/health`: **PASS**, `status: ok`, `db: connected`.
- Real demo login followed by full managed-workflow restart: **PASS**, same
  PostgreSQL-backed session still authenticated afterward.
- Public seed counts after full restart: **PASS**, still 8/5/10.
- Live logout and replay of the old cookie: **PASS**, viewer becomes anonymous.
- Registration and anonymous landing-page screenshots: **PASS**, page rendered.
- `git diff --check`: **PASS**.
- Dependency installation audit: **0 known vulnerabilities** in installed app
  dependencies at verification time.
- Sensitive-file review: no real `.env`, credentials, cookies, private keys or
  test-session files staged; only the empty `.env.example` template is tracked.

## Verification boundaries and expected unfinished work

Browser handlers were exercised with DOM fixtures and real HTTP integration
checks; browser end-to-end automation was **not run**. The signed-in page was
not screenshot-verified. The public screens were screenshot-verified.

Phase 2–5 features remain scaffolded, not complete. Owner/non-owner build CRUD
and max-three-pin behavior belong to Phase 3 and were not claimed as tested.
The production cookie test uses an isolated QA fixture app with production
settings; it does not connect to a production database or deployment.

The initial QA service start failed because its relative working directory was
incorrect; the managed command was corrected and the service then started cleanly.

The starter production service commands in the outer QA harness are not a
Blueprint Arcade release configuration. Review/configure production only in
Phase 5 with separate approval.

## Approval gate

No merge or deployment has occurred. Review the feature-branch diff and this
report before separately authorizing the merge to `main`.
