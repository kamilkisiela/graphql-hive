import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2026.10.09T00-00-02.contract-check-name.ts',
  run: ({ psql }) => psql`
    ALTER TABLE "contract_checks"
      ADD COLUMN "contract_name" text
    ;
  `,
} satisfies MigrationExecutor;
