import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2022.05.04T11.01.22.billing_plans.sql',
  run: ({ sql }) => sql`
CREATE TABLE
  public.organizations_billing (
    organization_id UUID NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE, -- org id 
    external_billing_reference_id VARCHAR(255) NOT NULL, -- stripe customer id
    billing_email_address VARCHAR(255),
    PRIMARY KEY (organization_id)
  );

ALTER TABLE
  public.organizations
ADD COLUMN
  plan_name VARCHAR(50) NOT NULL DEFAULT 'HOBBY';
`,
} satisfies MigrationExecutor;
