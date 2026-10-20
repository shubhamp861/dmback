import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  assertMigrationHistoryIsValid,
  loadMigrations,
  MIGRATION_TABLE_SQL,
  migrationStatuses,
  type AppliedMigration
} from './migration-utils.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before running the migration');
}

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrationLockKey = 'instagram-automation:migrations';

const migrations = await loadMigrations(migrationsDirectory);
const pool = new Pool({ connectionString: databaseUrl });
const client = await pool.connect();
let lockAcquired = false;

try {
  await client.query('SELECT pg_advisory_lock(hashtext($1))', [migrationLockKey]);
  lockAcquired = true;
  await client.query(MIGRATION_TABLE_SQL);

  const appliedResult = await client.query<{
    name: string;
    checksum: string;
    appliedAt: Date;
  }>(
    `SELECT name, checksum, applied_at AS "appliedAt"
     FROM schema_migrations
     ORDER BY name`
  );
  const applied: AppliedMigration[] = appliedResult.rows;
  const statuses = migrationStatuses(migrations, applied);
  assertMigrationHistoryIsValid(statuses);

  let appliedCount = 0;
  for (const migration of migrations) {
    const status = statuses.find((candidate) => candidate.name === migration.name);
    if (status?.status === 'applied') continue;

    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (name, checksum)
         VALUES ($1, $2)`,
        [migration.name, migration.checksum]
      );
      await client.query('COMMIT');
      appliedCount += 1;
      console.log(`Applied ${migration.name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log('No pending migrations.');
  }
} finally {
  if (lockAcquired) {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [migrationLockKey]);
  }
  client.release();
  await pool.end();
}
