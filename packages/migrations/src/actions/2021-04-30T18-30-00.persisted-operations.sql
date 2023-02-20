--persisted_operations (up)

CREATE TYPE operation_kind AS ENUM ('query', 'mutation', 'subscription');

CREATE TABLE public.persisted_operations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  operation_hash VARCHAR(600) NOT NULL,
  operation_name text NOT NULL,
  operation_kind operation_kind NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  content text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  UNIQUE (operation_hash, project_id)
);