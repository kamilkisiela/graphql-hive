import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.03.26T00.00.01.paddle-billing.ts',
  noTransaction: true,
  run: ({ sql }) => sql`
    CREATE TYPE billing_provider AS ENUM('STRIPE', 'PADDLE', 'WIRE');

    ALTER TABLE "organizations_billing"
      ADD COLUMN IF NOT EXISTS "provider" billing_provider default 'STRIPE' NOT NULL;

    ALTER TABLE "organizations_billing"
      ADD COLUMN IF NOT EXISTS "payment_day_of_month" SMALLINT default 1 NOT NULL;
    
    ALTER TABLE "organizations_billing"
      DROP COLUMN IF EXISTS "billing_email_address";
  `,
} satisfies MigrationExecutor;
