import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATION_NAME_PATTERN = /^(\d+)_([a-zA-Z0-9][a-zA-Z0-9_-]*)\.sql$/;

export const MIGRATION_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

export interface MigrationFile {
  name: string;
  version: number;
  checksum: string;
  sql: string;
}

export interface AppliedMigration {
  name: string;
  checksum: string;
  appliedAt: Date;
}

export type MigrationStatus = 'applied' | 'pending' | 'modified' | 'missing';

export interface MigrationStatusRecord {
  name: string;
  status: MigrationStatus;
  expectedChecksum?: string;
  appliedChecksum?: string;
  appliedAt?: Date;
}

export function migrationChecksum(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export function migrationVersion(name: string): number {
  const match = MIGRATION_NAME_PATTERN.exec(name);
  if (!match) {
    throw new Error(`Invalid migration filename: ${name}. Expected <number>_<name>.sql`);
  }
  return Number(match[1]);
}

export function sortMigrationNames(names: string[]): string[] {
  const versions = new Map<number, string>();
  for (const name of names) {
    const version = migrationVersion(name);
    const previous = versions.get(version);
    if (previous) {
      throw new Error(`Duplicate migration version ${version}: ${previous} and ${name}`);
    }
    versions.set(version, name);
  }

  return [...names].sort((left, right) => migrationVersion(left) - migrationVersion(right));
}

export async function loadMigrations(directory: string): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = sortMigrationNames(
    entries
      .filter((entry) => entry.isFile() && MIGRATION_NAME_PATTERN.test(entry.name))
      .map((entry) => entry.name)
  );

  return Promise.all(names.map(async (name) => {
    const sql = await readFile(join(directory, name), 'utf8');
    return {
      name,
      version: migrationVersion(name),
      checksum: migrationChecksum(sql),
      sql
    };
  }));
}

export function migrationStatuses(
  migrations: MigrationFile[],
  applied: AppliedMigration[]
): MigrationStatusRecord[] {
  const appliedByName = new Map(applied.map((migration) => [migration.name, migration]));
  const statuses: MigrationStatusRecord[] = migrations.map((migration) => {
    const appliedMigration = appliedByName.get(migration.name);
    if (!appliedMigration) {
      return { name: migration.name, status: 'pending', expectedChecksum: migration.checksum };
    }

    return {
      name: migration.name,
      status: appliedMigration.checksum === migration.checksum ? 'applied' : 'modified',
      expectedChecksum: migration.checksum,
      appliedChecksum: appliedMigration.checksum,
      appliedAt: appliedMigration.appliedAt
    };
  });

  for (const appliedMigration of applied) {
    if (!migrations.some((migration) => migration.name === appliedMigration.name)) {
      statuses.push({
        name: appliedMigration.name,
        status: 'missing',
        appliedChecksum: appliedMigration.checksum,
        appliedAt: appliedMigration.appliedAt
      });
    }
  }

  return statuses;
}

export function assertMigrationHistoryIsValid(statuses: MigrationStatusRecord[]): void {
  const invalid = statuses.filter((status) => status.status === 'modified' || status.status === 'missing');
  if (invalid.length === 0) return;

  const details = invalid.map((status) => {
    if (status.status === 'modified') {
      return `${status.name} checksum changed (applied ${status.appliedChecksum}, current ${status.expectedChecksum})`;
    }
    return `${status.name} was applied but its migration file is missing`;
  });
  throw new Error(`Migration history validation failed:\n${details.join('\n')}`);
}
