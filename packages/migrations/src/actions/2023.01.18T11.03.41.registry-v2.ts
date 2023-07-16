import { type MigrationExecutor } from "../pg-migrator"

export default {
  name: '2023.01.18T11.03.41.registry-v2.sql',
  run: ({ sql }) => sql`
--
CREATE INDEX
  IF NOT EXISTS version_commit_cid_vid_idx ON version_commit (commit_id, version_id);

-- Holds the actions that were performed on the registry.
-- Every time a schema is pushed or deleted, a new entry is created.
ALTER TABLE
  public.commits
RENAME COLUMN
  service TO service_name;

ALTER TABLE
  public.commits
RENAME COLUMN
  CONTENT TO sdl;

ALTER TABLE
  public.commits
ADD COLUMN
  service_url TEXT,
ADD COLUMN
  ACTION TEXT NOT NULL DEFAULT 'PUSH',
ALTER COLUMN
  sdl
DROP NOT NULL;

ALTER TABLE
  public.commits
RENAME TO
  schema_log;

-- Describes the state of a schema in the registry.
-- Groups together all the actions that were performed on a schema.
-- The latest version is the current state of the schema.
-- The last version that is composable is the current state of the schema available to the gateways.
-- Every time a schema is pushed or deleted, a new version is created, that holds a reference to the actions performed in the previous version.
CREATE TABLE
  public.schema_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_composable BOOLEAN NOT NULL,
    base_schema TEXT,
    target_id UUID NOT NULL REFERENCES public.targets (id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES public.schema_log (id) ON DELETE CASCADE
  );

-- Describes the relationship between a schema version and the actions that were performed previously but are related to the matching schema version.
CREATE TABLE
  public.schema_version_to_log (
    version_id UUID NOT NULL REFERENCES public.schema_versions (id) ON DELETE CASCADE,
    action_id UUID NOT NULL REFERENCES public.schema_log (id) ON DELETE CASCADE,
    PRIMARY KEY (version_id, action_id)
  );

-- This is used to determine if the project is using the new registry model or the old one.
ALTER TABLE
  public.projects
ADD COLUMN
  legacy_registry_model BOOLEAN;

UPDATE
  public.projects
SET
  legacy_registry_model = TRUE;

ALTER TABLE
  public.projects
ALTER COLUMN
  legacy_registry_model
SET NOT NULL
,
ALTER COLUMN
  legacy_registry_model
SET DEFAULT
  FALSE;

--
-- migrate the state
--
--- Update 'schema_log.service_url' to use a real value (take it from 'version_commit.url')
UPDATE
  public.schema_log
SET
  service_url = (
    SELECT
      vc.url
    FROM
      public.version_commit vc
      LEFT JOIN public.versions v ON v.id = vc.version_id
    WHERE
      vc.commit_id = schema_log.id
    ORDER BY
      v.created_at DESC
    LIMIT
      1
  );

-- 2. Copy 'versions' to 'schema_versions'
INSERT INTO
  public.schema_versions (
    id,
    created_at,
    is_composable,
    base_schema,
    target_id,
    action_id
  )
SELECT
  id,
  created_at,
  VALID AS is_composable,
  base_schema,
  target_id,
  commit_id AS action_id
FROM
  public.versions;

-- 3. Copy 'version_commit' to 'schema_version_to_log'
INSERT INTO
  public.schema_version_to_log (version_id, action_id)
SELECT
  version_id,
  commit_id AS action_id
FROM
  public.version_commit;
  `,
} satisfies MigrationExecutor
