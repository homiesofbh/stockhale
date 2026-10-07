CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL REFERENCES users(id),
  revision INTEGER NOT NULL DEFAULT 0,
  store TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  "user" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  modules TEXT NOT NULL,
  PRIMARY KEY(workspace, "user")
);
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  modules TEXT NOT NULL,
  expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  records TEXT NOT NULL,
  "occurredAt" TEXT NOT NULL,
  "receivedAt" TEXT NOT NULL,
  "emailStatus" TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  "nextAttempt" BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reads (
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  "user" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  PRIMARY KEY(workspace, "user")
);
CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS events_workspace_received ON events(workspace, "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS events_due_email ON events("nextAttempt") WHERE "emailStatus" <> 'sent';
CREATE INDEX IF NOT EXISTS invites_expiry ON invites(expires);
