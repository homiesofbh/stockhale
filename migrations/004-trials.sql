ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_active BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve access for existing workspaces. New workspaces receive a trial timestamp at signup.
UPDATE workspaces SET plan_active=TRUE WHERE subscription <> 'Free';
