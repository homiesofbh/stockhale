ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS "digestDate" DATE,
  ADD COLUMN IF NOT EXISTS "digestLease" BIGINT NOT NULL DEFAULT 0;

-- Existing queued activity belongs to the local date it was received on.
-- It will be sent after that date ends in the workspace time zone.
UPDATE events e
SET "emailStatus"='sent'
FROM workspaces w
WHERE e.workspace=w.id
  AND e."emailStatus" <> 'sent'
  AND e.action NOT IN ('Plan renewal reminder', 'Pre-restore safety snapshot');
