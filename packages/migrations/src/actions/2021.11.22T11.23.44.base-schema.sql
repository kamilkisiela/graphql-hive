-- Adds a base schema column in target table and versions table
ALTER TABLE public.targets ADD base_schema text;
ALTER TABLE public.versions ADD base_schema text;