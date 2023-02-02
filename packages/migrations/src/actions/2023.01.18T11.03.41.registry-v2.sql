-- 

-- Holds the actions that were performed on the registry.
-- Every time a schema is pushed or deleted, a new entry is created.
CREATE TABLE public.schema_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  service_name text,
  service_url text,
  sdl text,
  metadata text,
  commit text NOT NULL,
  action text NOT NULL,
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
);

-- Describes the state of a schema in the registry.
-- Groups together all the actions that were performed on a schema.
-- The latest version is the current state of the schema.
-- The last version that is composable is the current state of the schema available to the gateways.
-- Every time a schema is pushed or deleted, a new version is created, that holds a reference to the actions performed in the previous version.
CREATE TABLE public.schema_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  is_composable boolean NOT NULL,
  base_schema text,
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.schema_log(id) ON DELETE CASCADE
);

-- Describes the relationship between a schema version and the actions that were performed previously but are related to the matching schema version.
CREATE TABLE public.schema_version_to_log (
  version_id uuid NOT NULL REFERENCES public.schema_versions(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.schema_log(id) ON DELETE CASCADE,
  PRIMARY KEY(version_id, action_id)
);

-- This is used to determine if the project is using the new registry model or the old one.
ALTER TABLE public.projects
  ADD COLUMN legacy_registry_model boolean;

UPDATE public.projects
  SET legacy_registry_model = true;

ALTER TABLE public.projects
  ALTER COLUMN legacy_registry_model SET NOT NULL,
  ALTER COLUMN legacy_registry_model SET DEFAULT FALSE;

--
-- migrate the state
--

-- 1. Copy `commits` to `schema_log`
INSERT INTO public.schema_log (
  id,
  author,
  created_at,
  service_name,
  service_url,
  sdl,
  metadata,
  commit,
  action,
  target_id,
  project_id
) SELECT 
  id,
  author,
  created_at,
--- Copy `commits.service` to `schema_log.service_name`
  service as service_name,
--- Use NULL for `schema_log.service_url` as it's not available in `commits`. It's being migrated later on.
  NULL as service_url,
--- Copy `commits.content` to `schema_log.sdl`
  content as sdl,
  metadata,
  commit,
--- Use `PUSH` for `schema_log.action`
  'PUSH'::text as action,
  target_id,
  project_id
FROM public.commits;

--- Update `schema_log.service_url` to use a real value (take it from `version_commit.url`)
UPDATE public.schema_log
SET service_url = (
  SELECT vc.url FROM public.version_commit vc
  LEFT JOIN public.versions v ON v.id = vc.version_id
  WHERE vc.commit_id = schema_log.id
  ORDER BY v.created_at DESC LIMIT 1
);

-- 2. Copy `versions` to `schema_versions`
INSERT INTO public.schema_versions (
  id,
  created_at,
  is_composable,
  base_schema,
  target_id,
  action_id
) SELECT
  id,
  created_at,
  valid as is_composable,
  base_schema,
  target_id,
  commit_id as action_id
FROM public.versions;

-- 3. Copy `version_commit` to `schema_version_to_log`
INSERT INTO public.schema_version_to_log (
  version_id,
  action_id
) SELECT
  version_id,
  commit_id as action_id
FROM public.version_commit;