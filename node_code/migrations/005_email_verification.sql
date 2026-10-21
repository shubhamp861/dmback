ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS email_verification_challenges (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  max_attempts integer NOT NULL CHECK (max_attempts > 0),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  resend_available_at timestamptz NOT NULL,
  consumed_at timestamptz,
  verification_token_hash text,
  verification_token_expires_at timestamptz,
  verification_token_consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_challenges_email_idx
  ON email_verification_challenges (email, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_challenges_expiry_idx
  ON email_verification_challenges (expires_at)
  WHERE consumed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_verification_challenges_token_idx
  ON email_verification_challenges (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;
