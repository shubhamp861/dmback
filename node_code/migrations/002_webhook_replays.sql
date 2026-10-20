-- Each request is a new audited replay; the original delivery outbox and trigger
-- idempotency keys are deliberately independent of this dispatch lifecycle.
CREATE TABLE webhook_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id uuid NOT NULL REFERENCES webhook_events(id),
  workspace_id uuid NOT NULL REFERENCES workspaces(id),
  actor_user_id uuid NOT NULL REFERENCES users(id),
  audit_log_id uuid NOT NULL UNIQUE REFERENCES audit_log(id),
  dispatch_status text NOT NULL DEFAULT 'pending'
    CHECK (dispatch_status IN ('pending', 'dispatching', 'dispatched', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  dispatched_at timestamptz,
  last_error text,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processed', 'failed')),
  processed_at timestamptz,
  last_processing_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX webhook_replays_pending_idx
  ON webhook_replays (available_at, created_at)
  WHERE dispatch_status IN ('pending', 'failed');

CREATE INDEX webhook_replays_stale_idx
  ON webhook_replays (claimed_at)
  WHERE dispatch_status = 'dispatching';

CREATE INDEX webhook_replays_event_idx ON webhook_replays (webhook_event_id);
CREATE INDEX webhook_replays_workspace_idx ON webhook_replays (workspace_id, created_at);
CREATE INDEX webhook_replays_actor_idx ON webhook_replays (actor_user_id);
