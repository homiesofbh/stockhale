CREATE TABLE IF NOT EXISTS workspace_records (
  workspace TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  record JSON NOT NULL,
  PRIMARY KEY (workspace, collection, record_id)
);
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS records_ready BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS workspace_records_collection_order
  ON workspace_records(workspace, collection, ordinal);

-- Backfill atomically from the existing JSON store. Collections containing
-- scalar values use their ordinal as a stable row key.
WITH raw_records AS (
  SELECT w.id AS workspace, collection.key AS collection,
         CASE WHEN json_typeof(item.value) = 'object'
              THEN COALESCE(item.value->>'id', item.value->>'name', '#' || (item.ordinality - 1)::text)
              ELSE '#' || (item.ordinality - 1)::text END AS base_id,
         (item.ordinality - 1)::integer AS ordinal,
         item.value AS record
  FROM workspaces w
  CROSS JOIN LATERAL json_each(w.store::json) AS collection(key, value)
  CROSS JOIN LATERAL json_array_elements(
    CASE WHEN json_typeof(collection.value) = 'array' THEN collection.value ELSE '[]'::json END
  ) WITH ORDINALITY AS item(value, ordinality)
  WHERE json_typeof(collection.value) = 'array'
), unique_records AS (
  SELECT *, CASE WHEN duplicate_number > 1
                 THEN base_id || '#' || ordinal::text ELSE base_id END AS record_id
  FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY workspace, collection, base_id ORDER BY ordinal) AS duplicate_number
    FROM raw_records
  ) ranked
)
INSERT INTO workspace_records(workspace, collection, record_id, ordinal, record)
SELECT workspace, collection, record_id, ordinal, record FROM unique_records
ON CONFLICT (workspace, collection, record_id) DO NOTHING;
UPDATE workspaces SET records_ready=TRUE;
