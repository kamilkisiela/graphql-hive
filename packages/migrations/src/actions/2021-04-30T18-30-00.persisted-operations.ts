import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-04-30T18-30-00.persisted-operations.sql',
  run: ({ sql }) => sql`
--persisted_operations (up)
CREATE TYPE
  operation_kind AS ENUM('query', 'mutation', 'subscription');

CREATE TABLE
  persisted_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    operation_hash VARCHAR(600) NOT NULL,
    operation_name TEXT NOT NULL,
    operation_kind operation_kind NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONTENT TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    UNIQUE (operation_hash, project_id)
  );
`,
} satisfies MigrationExecutor;
