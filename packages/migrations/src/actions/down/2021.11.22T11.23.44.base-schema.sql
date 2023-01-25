-- Adds a base schema column in target table and versions table
ALTER TABLE public.targets DROP COLUMN base_schema;
ALTER TABLE public.versions DROP COLUMN base_schema;
