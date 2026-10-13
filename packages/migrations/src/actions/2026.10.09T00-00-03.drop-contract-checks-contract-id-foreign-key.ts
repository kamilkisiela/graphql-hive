import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2026.10.09T00-00-03.drop-contract-checks-contract-id-foreign-key.ts',
  run: ({ psql }) => psql`
    ALTER TABLE "contract_checks"
      DROP CONSTRAINT IF EXISTS "contract_checks_contract_id_fkey"
      , DROP CONSTRAINT IF EXISTS "contract_checks_compared_contract_version_id_fkey"
    ;

    ALTER TABLE "contract_schema_change_approvals"
      DROP CONSTRAINT IF EXISTS "contract_schema_change_approvals_contract_id_fkey"
    ;
  `,
} satisfies MigrationExecutor;
