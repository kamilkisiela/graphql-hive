ALTER table public.organizations ADD COLUMN limit_operations_monthly BIGINT NOT NULL DEFAULT 1000000; -- HOBBY plan is default
ALTER table public.organizations ADD COLUMN limit_schema_push_monthly BIGINT NOT NULL DEFAULT 50; -- HOBBY plan is default
ALTER table public.organizations ADD COLUMN limit_retention_days BIGINT NOT NULL DEFAULT 3; -- HOBBY plan is default