import 'dotenv/config';
import argon2 from 'argon2';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running the seed script');
}

const ids = {
  workspace: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  account: '33333333-3333-4333-8333-333333333333',
  automation: '44444444-4444-4444-8444-444444444444'
};

const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
const localPasswordHash = await argon2.hash('local-development-password', { type: argon2.argon2id });

try {
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workspaces (id, name) VALUES ($1, 'Local development workspace')
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [ids.workspace]
  );
  await client.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1, 'developer@example.local', $2)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash`,
    [ids.user, localPasswordHash]
  );
  await client.query(
    `INSERT INTO memberships (workspace_id, user_id, role) VALUES ($1, $2, 'owner')
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [ids.workspace, ids.user]
  );
  await client.query(
    `INSERT INTO ig_accounts
       (id, workspace_id, ig_user_id, username, permissions, status)
     VALUES ($1, $2, 'local-ig-account', 'local_account', '{}', 'active')
     ON CONFLICT (id) DO UPDATE SET status = 'active', username = EXCLUDED.username`,
    [ids.account, ids.workspace]
  );
  await client.query(
    `INSERT INTO automations
       (id, ig_account_id, name, status, trigger, keyword_rules, public_replies, settings)
     VALUES ($1, $2, 'Local guide automation', 'live', $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET status = 'live', keyword_rules = EXCLUDED.keyword_rules,
       public_replies = EXCLUDED.public_replies, settings = EXCLUDED.settings`,
    [
      ids.automation,
      ids.account,
      JSON.stringify({ type: 'comment' }),
      JSON.stringify([{ value: 'guide', mode: 'contains', caseSensitive: false }]),
      JSON.stringify(['Thanks! Check your DMs.']),
      JSON.stringify({
        exclusions: [],
        dailyCap: null,
        schedule: { timezone: 'UTC', startHour: 0, endHour: 24 }
      })
    ]
  );
  await client.query('COMMIT');
  console.log(JSON.stringify({ ...ids, igUserId: 'local-ig-account' }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
