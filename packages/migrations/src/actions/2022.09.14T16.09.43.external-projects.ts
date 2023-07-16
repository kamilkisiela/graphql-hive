import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2022.09.14T16.09.43.external-projects.sql',
  run: ({ sql }) => sql`
ALTER TABLE
  public.projects
ADD COLUMN
  external_composition_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN
  external_composition_endpoint TEXT,
ADD COLUMN
  external_composition_secret TEXT;
  `,
} satisfies MigrationExecutor