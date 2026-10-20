import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertMigrationHistoryIsValid,
  loadMigrations,
  migrationChecksum,
  migrationStatuses,
  migrationVersion,
  sortMigrationNames,
  type AppliedMigration,
  type MigrationFile
} from '../scripts/migration-utils.js';

const migration = (name: string, sql: string): MigrationFile => ({
  name,
  version: migrationVersion(name),
  checksum: migrationChecksum(sql),
  sql
});

describe('migration tracking', () => {
  it('orders migration files by numeric version', () => {
    expect(sortMigrationNames(['010_add_index.sql', '002_add_user.sql', '001_initial.sql']))
      .toEqual(['001_initial.sql', '002_add_user.sql', '010_add_index.sql']);
  });

  it('discovers the repository migration files', async () => {
    const migrations = await loadMigrations(fileURLToPath(new URL('../migrations/', import.meta.url)));

    expect(migrations.map((candidate) => candidate.name)).toEqual([
      '001_initial.sql', '002_webhook_replays.sql', '003_idempotency_keys.sql'
    ]);
    for (const candidate of migrations) expect(candidate.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(migrations[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
  });

  it('rejects duplicate migration versions', () => {
    expect(() => sortMigrationNames(['001_initial.sql', '001_other.sql']))
      .toThrow('Duplicate migration version 1');
  });

  it('detects pending, modified, missing, and applied migrations', () => {
    const migrations = [migration('001_initial.sql', 'select 1;'), migration('002_accounts.sql', 'select 2;')];
    const applied: AppliedMigration[] = [
      {
        name: '001_initial.sql',
        checksum: migrationChecksum('select 1;'),
        appliedAt: new Date('2026-10-11T00:00:00.000Z')
      },
      {
        name: '003_removed.sql',
        checksum: 'old-checksum',
        appliedAt: new Date('2026-10-11T00:01:00.000Z')
      }
    ];

    expect(migrationStatuses(migrations, applied)).toEqual([
      {
        name: '001_initial.sql',
        status: 'applied',
        expectedChecksum: migrationChecksum('select 1;'),
        appliedChecksum: migrationChecksum('select 1;'),
        appliedAt: new Date('2026-10-11T00:00:00.000Z')
      },
      {
        name: '002_accounts.sql',
        status: 'pending',
        expectedChecksum: migrationChecksum('select 2;')
      },
      {
        name: '003_removed.sql',
        status: 'missing',
        appliedChecksum: 'old-checksum',
        appliedAt: new Date('2026-10-11T00:01:00.000Z')
      }
    ]);
  });

  it('fails validation when an applied migration changes', () => {
    const current = migration('001_initial.sql', 'select changed;');
    const statuses = migrationStatuses([current], [{
      name: current.name,
      checksum: migrationChecksum('select original;'),
      appliedAt: new Date('2026-10-11T00:00:00.000Z')
    }]);

    expect(() => assertMigrationHistoryIsValid(statuses))
      .toThrow('001_initial.sql checksum changed');
  });

  it('rejects malformed migration names', () => {
    expect(() => migrationVersion('initial.sql')).toThrow('Invalid migration filename');
  });
});
