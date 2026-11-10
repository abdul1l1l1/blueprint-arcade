# Production readiness — Phase 5

## Status and boundaries

Replit metadata was checked during Phase 5: no active deployment or production
URL exists. No deployment was initiated and no production database was written.
Workspace `heliumdb` is QA. The owner must separately approve both the feature
merge and the eventual publish; merge approval is not publish approval.

**Publishing registration resolved with owner approval:** a web artifact now
registers the existing app at `/`. Replit confirmed the project is deployable.
The original API artifact retains its immutable identity but has no services;
its duplicate workflow was removed. The web registration runs the same Express
app, not a second frontend or proxy. The bootstrap React/Vite UI and dependencies
were removed. No application framework, authentication or database was replaced.

The application remains plain HTML/CSS/JS, Node 24, Express 5, npm with a locked
dependency graph, pg and persistent PostgreSQL sessions. The same Express
process serves the frontend, APIs and approved image.

## Prepared Replit configuration

The QA harness uses `artifacts/blueprint-arcade-web/.replit-artifact/artifact.toml`;
this platform configuration is outside this imported app's independent Git
repository. It has been updated through Replit's validated artifact editor:

- Production build (from workspace root):
  `cd blueprint-arcade && npm ci --omit=dev`
- Production run (from workspace root):
  `cd blueprint-arcade && npm start`
- `NODE_ENV=production`, assigned service port 23978; server binds the managed
  `PORT` on `0.0.0.0`.
- Startup health `/api/healthz` verifies database connectivity.
- No dev watch server, mockup service, schema mutation, seeding or cleanup in
  the production commands.
- Autoscale is the existing project target. All durable state is PostgreSQL
  or App Storage; sessions are not in process memory.

The post-merge QA setup installs this app's locked npm dependencies; it no
longer invokes the unrelated starter database package. Schema/init/seed/cleanup
commands remain explicit QA actions, not startup hooks.

## Database preparation and publish-time handoff

According to current Replit documentation, Publishing provisions a separate
managed production database, computes/applies schema changes and can initialize
it with current development data when the owner selects that option. The agent
must not create an alternative production migration/build hook.

Before the first owner-authorized publish:

1. Use the final cleaned QA snapshot: eight games, five intended demo accounts,
   ten original credited demo builds plus approved Construction Site. Keep
   original sample likes, ratings and comments. No synthetic accounts/builds or
   isolated test schemas should be copied.
2. In Publishing, confirm a **separate production database** and select initial
   current development data. Review the proposed schema diff and data source.
   Never point production at the QA connection string or overwrite an existing
   production database as a shortcut.
3. Confirm managed production `DATABASE_URL` and a strong `SESSION_SECRET`
   through secret settings, without copying values into code/chat. The existing
   secret must remain available; the server fails closed if missing. Do not
   run demo seed/import/cleanup commands in production.
4. Ensure App Storage access is attached for the fixed approved image objects and
   `DEFAULT_OBJECT_STORAGE_BUCKET_ID` is available to the deployed service.
   The objects stay private; only their approved public application routes are
   exposed. No signed/dev URL is stored in a build.
5. Publish only after explicit authorization. Record the production URL from
   Replit's deployment metadata, not from a development domain.
6. Verify the published health endpoint and all ten required features, HTTPS
   session/login/logout, image access and restart persistence. These live checks
   cannot be marked passed before a deployment exists.

The fixed image has SHA-256
`c40bfeba9312e95c328214a740b41d569a850b8831b559ee69f2a92196543767`.
Its original is retained in workspace-root `images/construction-site.png`.

## QA cleanup safety

`node db/clean-qa.js` is a dry run. `--apply` is an explicit destructive QA
action requested by the owner. It refuses production mode or an unconfirmed
database, unknown accounts/content/schemas, and incomplete seed data. It removes
only recognized synthetic accounts (their dependent content/session rows) and
generated isolated fixture schemas in a transaction, then verifies intended
builds and seed samples are unchanged. It is never a deployment command.

Tests now drop only their own uniquely generated schemas in teardown so future
runs do not repopulate the release snapshot with retained fixtures.

References consulted:
- https://docs.replit.com/features/data-and-storage/development-and-production
- https://docs.replit.com/features/data-and-storage/publish-database-changes
