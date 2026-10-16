ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS country_code CHAR(2);
