CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key varchar(128) NOT NULL,
  request_fingerprint char(64) NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (workspace_id, user_id, key),
  CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  CHECK ((status = 'in_progress' AND response_status IS NULL AND completed_at IS NULL)
      OR (status = 'completed' AND response_status IS NOT NULL AND completed_at IS NOT NULL))
);

-- Supports bounded-retention cleanup without scanning the workspace/user key index.
CREATE INDEX idempotency_keys_retention_idx ON idempotency_keys (created_at);
