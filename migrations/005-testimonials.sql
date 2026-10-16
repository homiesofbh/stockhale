CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  business TEXT NOT NULL DEFAULT '',
  quote TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedAt" TIMESTAMPTZ,
  "reviewedBy" TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS testimonials_public ON testimonials(status, "reviewedAt" DESC, "createdAt" DESC);
