CREATE TABLE IF NOT EXISTS attachment_upload_reservations (
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  object_key TEXT PRIMARY KEY,
  size INTEGER NOT NULL CHECK (size > 0),
  expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS attachment_upload_reservations_workspace_expiry
  ON attachment_upload_reservations(workspace, expires);
