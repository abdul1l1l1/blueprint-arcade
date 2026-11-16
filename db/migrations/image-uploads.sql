-- Additive and idempotent; never changes existing build content or sessions.
-- Private staging objects are never served. Only validated, consented images
-- are eligible for owner preview or publication through a build.
CREATE TABLE IF NOT EXISTS image_uploads (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staging_key TEXT NOT NULL,
  object_key TEXT NOT NULL,
  expected_size INTEGER NOT NULL CHECK (expected_size BETWEEN 1 AND 8388608),
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  public_consent BOOLEAN NOT NULL CHECK (public_consent),
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_image_uploads_owner ON image_uploads(owner_id, created_at);
CREATE INDEX IF NOT EXISTS idx_builds_images ON builds USING gin(image_urls);
