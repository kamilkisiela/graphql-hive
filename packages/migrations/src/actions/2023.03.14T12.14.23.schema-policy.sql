CREATE TYPE
  schema_policy_resource AS ENUM('ORGANIZATION', 'PROJECT');

CREATE TABLE
  public.schema_policy_config (
    resource_type schema_policy_resource NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    config JSONB NOT NULL,
    allow_overriding BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (resource_type, resource_id)
  );
