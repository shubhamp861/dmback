CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  csrf_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS ig_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ig_user_id text NOT NULL UNIQUE,
  username text NOT NULL,
  account_type text,
  profile_picture_url text,
  token_ciphertext bytea,
  token_expires_at timestamptz,
  permissions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'needs_reauth' CHECK (status IN ('active', 'needs_reauth', 'disconnected')),
  last_webhook_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ig_accounts
  ADD COLUMN IF NOT EXISTS account_type text,
  ADD COLUMN IF NOT EXISTS profile_picture_url text;

CREATE TABLE IF NOT EXISTS media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  ig_media_id text NOT NULL,
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  thumbnail_storage_key text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ig_account_id, ig_media_id)
);

CREATE TABLE IF NOT EXISTS flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  steps jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name, version)
);

CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'error')),
  trigger jsonb NOT NULL DEFAULT '{"type":"comment"}',
  keyword_rules jsonb NOT NULL DEFAULT '[]',
  public_replies jsonb NOT NULL DEFAULT '[]',
  flow_id uuid REFERENCES flows(id),
  settings jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  igsid text NOT NULL,
  username text,
  name text,
  email text,
  phone text,
  tags text[] NOT NULL DEFAULT '{}',
  follows boolean,
  opted_out boolean NOT NULL DEFAULT false,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ig_account_id, igsid)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type text NOT NULL,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL UNIQUE,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS webhook_event_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_event_id uuid NOT NULL UNIQUE REFERENCES webhook_events(id) ON DELETE CASCADE,
  queue_name text NOT NULL,
  job_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'dispatching', 'dispatched', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  dispatched_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_event_outbox_pending_idx
  ON webhook_event_outbox (available_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS webhook_event_outbox_stale_idx
  ON webhook_event_outbox (claimed_at)
  WHERE status = 'dispatching';

CREATE TABLE IF NOT EXISTS instagram_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE,
  redirect_uri text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_oauth_states_expiry_idx
  ON instagram_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS trigger_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ig_account_id uuid NOT NULL REFERENCES ig_accounts(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES automations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  comment_id text NOT NULL,
  comment_text text,
  matched_keyword text,
  outcome text NOT NULL CHECK (outcome IN ('sent', 'skipped', 'failed', 'queued')),
  reason_code text,
  attempts integer NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS trigger_events_default PARTITION OF trigger_events DEFAULT;
CREATE INDEX IF NOT EXISTS trigger_events_account_time_idx ON trigger_events (ig_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trigger_events_automation_time_idx ON trigger_events (automation_id, created_at DESC);

-- A global unique index cannot be declared on a partitioned table unless it
-- includes the partition key. Keep the idempotency key in an unpartitioned
-- companion table so duplicate comments remain impossible across partitions.
CREATE TABLE IF NOT EXISTS trigger_event_idempotency (
  idempotency_key text PRIMARY KEY,
  trigger_event_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ig_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  source text NOT NULL CHECK (source IN ('bot', 'human')),
  body text,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contact_id, ig_message_id)
);

CREATE TABLE IF NOT EXISTS usage_counters (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  dms_sent integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, period_start)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
