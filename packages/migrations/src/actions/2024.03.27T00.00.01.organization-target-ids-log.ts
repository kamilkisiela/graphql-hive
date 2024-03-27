import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.03.27T00.00.01.organization-target-ids-log.ts',
  noTransaction: true,
  run: ({ sql }) => sql`
    ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "target_ids_log" uuid[] DEFAULT '{}'
    ;

    UPDATE organizations as o SET target_ids_log = (
      SELECT ARRAY_AGG(DISTINCT t.id)
      FROM targets as t
      WHERE t.project_id IN (
        SELECT id
        FROM projects as p
        WHERE p.org_id = o.id
      )
    );
  `,
} satisfies MigrationExecutor;
