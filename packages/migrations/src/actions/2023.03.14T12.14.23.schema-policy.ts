import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.03.14T12.14.23.schema-policy.sql',
  run: ({ sql }) => sql`
CREATE TYPE
  schema_policy_resource AS ENUM('ORGANIZATION', 'PROJECT');

CREATE TABLE
  schema_policy_config (
    resource_type schema_policy_resource NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    config JSONB NOT NULL,
    allow_overriding BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (resource_type, resource_id)
  );
  `,
} satisfies MigrationExecutor;
