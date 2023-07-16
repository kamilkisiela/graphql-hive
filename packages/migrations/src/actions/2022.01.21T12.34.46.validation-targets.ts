import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2022.01.21T12.34.46.validation-targets.sql',
  run: ({ sql }) => sql`
CREATE TABLE
  public.target_validation (
    target_id UUID NOT NULL REFERENCES public.targets (id) ON DELETE CASCADE,
    destination_target_id UUID NOT NULL REFERENCES public.targets (id) ON DELETE CASCADE,
    PRIMARY KEY (target_id, destination_target_id)
  );

INSERT INTO
  public.target_validation (target_id, destination_target_id) (
    SELECT
      id AS target_id,
      id AS destination_target_id
    FROM
      public.targets
    WHERE
      validation_enabled IS TRUE
  );
`
} satisfies MigrationExecutor
