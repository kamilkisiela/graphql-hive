import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2021-03-05T19-06-23.initial.sql',
  run: ({ sql }) => sql`
--initial (up)
-- Extensions
CREATE EXTENSION
  IF NOT EXISTS "uuid-ossp";

--- Custom Types
CREATE TYPE
  organization_type AS ENUM('PERSONAL', 'REGULAR');

CREATE DOMAIN
  url AS TEXT CHECK (
    VALUE ~ 'https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#()?&//=]*)'
  );

COMMENT
  ON DOMAIN url IS 'match URLs (http or https)';

CREATE DOMAIN
  slug AS TEXT CHECK (VALUE ~ '[a-z0-9]+(?:-[a-z0-9]+)*');

COMMENT
  ON DOMAIN slug IS 'valid slug';

--- Tables
CREATE TABLE
  users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    email VARCHAR(320) NOT NULL UNIQUE,
    external_auth_user_id VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

CREATE TABLE
  organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    clean_id slug NOT NULL,
    NAME TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    invite_code VARCHAR(10) NOT NULL UNIQUE DEFAULT SUBSTR(MD5(RANDOM()::TEXT), 0, 10),
    user_id UUID NOT NULL REFERENCES users (id),
    TYPE
      organization_type NOT NULL
  );

CREATE TABLE
  projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    clean_id slug NOT NULL,
    NAME VARCHAR(200) NOT NULL,
    TYPE
      VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      build_url url,
      validation_url url,
      org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE
  );

CREATE TABLE
  targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    clean_id slug NOT NULL,
    NAME TEXT NOT NULL,
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );

CREATE TABLE
  commits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    author TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    service TEXT,
    CONTENT TEXT NOT NULL,
    COMMIT
      TEXT NOT NULL
  );

CREATE TABLE
  versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    VALID BOOLEAN NOT NULL,
    target_id UUID NOT NULL REFERENCES targets (id) ON DELETE CASCADE,
    commit_id UUID NOT NULL REFERENCES commits (id) ON DELETE CASCADE
  );

CREATE TABLE
  version_commit (
    version_id UUID NOT NULL REFERENCES versions (id) ON DELETE CASCADE,
    commit_id UUID NOT NULL REFERENCES commits (id) ON DELETE CASCADE,
    url url,
    PRIMARY KEY (version_id, commit_id)
  );

CREATE TABLE
  tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    token VARCHAR(32) NOT NULL DEFAULT MD5(RANDOM()::TEXT),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    NAME TEXT NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE
  );

CREATE TABLE
  organization_member (
    organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    PRIMARY KEY (organization_id, user_id)
  );

--- Indices
CREATE INDEX
  email_idx ON users USING btree (email);

CREATE INDEX
  external_auth_user_id_idx ON users USING btree (external_auth_user_id);
`,
} satisfies MigrationExecutor;
