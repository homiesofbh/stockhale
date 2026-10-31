ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS business_type TEXT
  CHECK (business_type IS NULL OR business_type IN ('retail', 'manufacturer'));
