import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  loadMigrations,
  MIGRATION_TABLE_SQL,
  migrationStatuses,
  type AppliedMigration
} from './migration-utils.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set before checking migration status');
}

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));
const migrations = await loadMigrations(migrationsDirectory);
const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(MIGRATION_TABLE_SQL);
  const result = await pool.query<{
    name: string;
    checksum: string;
    appliedAt: Date;
  }>(
    `SELECT name, checksum, applied_at AS "appliedAt"
     FROM schema_migrations
     ORDER BY name`
  );
  const statuses = migrationStatuses(migrations, result.rows as AppliedMigration[]);

  console.log('STATUS\tMIGRATION\tAPPLIED AT');
  for (const migration of statuses) {
    console.log(`${migration.status.toUpperCase()}\t${migration.name}\t${migration.appliedAt?.toISOString() ?? '-'}`);
  }
} finally {
  await pool.end();
}
