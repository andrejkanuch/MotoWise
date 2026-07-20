import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MaintenanceServiceType } from '@motovault/types';
import { describe, expect, it } from 'vitest';

/**
 * Drift guard for the ONE unprotected sync axis. The TS `MaintenanceServiceType`
 * as-const and the `GqlMaintenanceServiceType` enum are kept in lockstep by the
 * `_serviceTypeSync` compile-time Record guard. The DB `service_type` CHECK in
 * migration 00170 hand-duplicates the same values (SQL can't import TS) with only
 * a "keep in sync" comment — so an enum member added without touching the CHECK
 * would pass typecheck + the Gql guard, let classifyServiceType emit the value,
 * then fail the INSERT at runtime and roll back the receipt-scan save saga.
 * This test makes that drift trip CI instead of production.
 */
describe('maintenance service_type: TS enum <-> SQL CHECK sync', () => {
  it('00170 CHECK values exactly match MaintenanceServiceType', () => {
    const migrationPath = resolve(
      process.cwd(),
      '../../supabase/migrations/00170_maintenance_task_line_items.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');

    const checkMatch = sql.match(
      /service_type\s+TEXT\s+NOT NULL\s+CHECK\s*\(\s*service_type\s+IN\s*\(([\s\S]*?)\)\s*\)/i,
    );
    expect(checkMatch, 'service_type CHECK block not found in 00170').not.toBeNull();

    const sqlValues = new Set(
      Array.from((checkMatch?.[1] ?? '').matchAll(/'([^']+)'/g), (m) => m[1]),
    );
    const tsValues = new Set(Object.values(MaintenanceServiceType));

    expect([...sqlValues].sort()).toEqual([...tsValues].sort());
  });
});
