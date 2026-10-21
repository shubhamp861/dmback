CREATE INDEX IF NOT EXISTS ig_accounts_workspace_created_id_idx
  ON ig_accounts (workspace_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS automations_created_id_idx
  ON automations (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS trigger_events_automation_created_id_idx
  ON trigger_events (automation_id, created_at DESC, id DESC);
