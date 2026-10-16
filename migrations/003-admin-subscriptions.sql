ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS subscription TEXT NOT NULL DEFAULT 'Free';

CREATE INDEX IF NOT EXISTS workspaces_owner ON workspaces(owner);
CREATE INDEX IF NOT EXISTS members_workspace ON members(workspace);
CREATE INDEX IF NOT EXISTS events_workspace_action ON events(workspace, action);
