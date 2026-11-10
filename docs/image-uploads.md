# Builder screenshot uploads

The plain HTML/JavaScript form and PostgreSQL-backed login sessions are unchanged.
Existing HTTP(S) URLs and fixed approved asset paths remain supported.

## QA setup

- Install with `npm ci --workspaces=false`.
- For an existing database, run `npm run db:migrate:uploads`. This additive,
  idempotent migration adds upload metadata and indexes without modifying content
  or sessions. The post-merge script runs this command for QA.
- Fresh `npm run db:init` includes the upload migration.
- App Storage must already be provisioned with `PRIVATE_OBJECT_DIR`. Use the
  existing platform-sidecar credentials; no new API keys or auth provider.
- These CLI migration commands refuse production. Production database changes
  and deployment still require separate owner approval.

## Form behavior

Choose JPEG, PNG or WebP files, check the permission/public-sharing consent,
then upload. Each file must be non-empty, at most 8 MiB and 40 megapixels,
and non-animated. Files are sent directly to App Storage by signed PUT.
The app checks the bytes, removes metadata, and creates a WebP image.

Successful paths are appended to Image URLs; the first line is the cover.
The owner can preview, reorder, or remove paths before saving. The same controls
work when editing. Selected files must either finish uploading or be cleared
before the build can be submitted. Partial failures retain successful paths,
pending files and all other form entries. Retry does not duplicate successful
images, and an uncertain completion response can safely be retried.
Closing or reloading an unsaved form does not preserve a draft.

## Routes and access

- `POST /api/uploads/request-url`: session required, JSON `{size, contentType,
  publicConsent:true}`; returns `{id, uploadURL}`. Limit: 30 requests per owner
  per hour. Identity, object keys and creation time are server-owned.
- Signed `PUT`: file bytes go to private staging, never through the upload API.
  URL lifetime is 10 minutes; finalization is allowed for 15 minutes.
- `POST /api/uploads/:id/complete`: uploader only; checks stored object size,
  content type and generation, performs bounded reading and full image decoding.
  Returns `{imageUrl:"/media/uploads/<uuid>.webp"}`. Completion is idempotent.
- `GET /media/uploads/<uuid>.webp`: ready, consented images only. The uploader
  can preview; others may read only while a saved build references that path.
  Responses use private/no-store caching and a fixed image content type.
- Build create/edit validates that every upload path belongs to the session
  owner and is ready and consented. A client-supplied owner cannot override this.
  Owner-only build edit/delete/pin remains in the original build routes.

The signed URL can only overwrite staging, not finalized images. Fixed approved
assets retain their separate allowlisted route. No catch-all public bucket or
private-object reader was introduced. Database records contain metadata and
stable app paths, never bytes, signed URLs or development hostnames.

Removing an image from all saved builds or deleting its build stops new public
requests through the upload route; it cannot retract copies visitors already
downloaded. The uploader can still preview it.

Staging is deleted best-effort after successful validation. Abandoned, invalid,
or replaced images are not automatically swept, and a still-valid signed PUT
can recreate staging. A retention/cleanup policy is a separate follow-up.

## Verification

`npm test` includes isolated PostgreSQL/HTTP coverage for session/consent/type/
size checks, ownership, unready and unknown paths, completion failures and
idempotency, owner preview versus public visibility, expiry and rate limits,
save/edit/delete/restart persistence, and actual image-decoder rejection.
The signed-in browser check additionally exercises a real signed storage PUT.
