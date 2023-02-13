--initial (up)

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 
--- Custom Types
CREATE TYPE organization_type AS ENUM ('PERSONAL', 'REGULAR');

CREATE DOMAIN url AS text CHECK (VALUE ~ 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)');
COMMENT ON DOMAIN url IS 'match URLs (http or https)';

CREATE DOMAIN slug AS text CHECK (VALUE ~ '[a-z0-9]+(?:-[a-z0-9]+)*');
COMMENT ON DOMAIN slug IS 'valid slug';

--- Tables
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(320) NOT NULL UNIQUE,
  external_auth_user_id VARCHAR(50) NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clean_id slug NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  invite_code varchar(10) NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 0, 10),
  user_id uuid NOT NULL REFERENCES public.users(id),
  type organization_type NOT NULL
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clean_id slug NOT NULL,
  name varchar(200) NOT NULL,
  type varchar(50) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  build_url url,
  validation_url url,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
);

CREATE TABLE public.targets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clean_id slug NOT NULL,
  name text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT NOW()
);

CREATE TABLE public.commits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  service text,
  content text NOT NULL,
  commit text NOT NULL
);

CREATE TABLE public.versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  valid boolean NOT NULL,
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  commit_id uuid NOT NULL REFERENCES public.commits(id) ON DELETE CASCADE
);

CREATE TABLE public.version_commit (
  version_id uuid NOT NULL REFERENCES public.versions(id) ON DELETE CASCADE,
  commit_id uuid NOT NULL REFERENCES public.commits(id) ON DELETE CASCADE,
  url url,
  PRIMARY KEY(version_id, commit_id)
);

CREATE TABLE public.tokens (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  token varchar(32) NOT NULL DEFAULT md5(random()::text),
  created_at timestamp with time zone NOT NULL DEFAULT NOW(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  last_used_at timestamp with time zone
);

CREATE TABLE public.organization_member (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id)
);

--- Indices
CREATE INDEX email_idx ON public.users USING btree(email);
CREATE INDEX external_auth_user_id_idx ON public.users USING btree(external_auth_user_id);
