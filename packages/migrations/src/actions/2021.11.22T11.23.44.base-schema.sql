-- Adds a base schema column in target table and versions table
ALTER TABLE
  public.targets
ADD
  base_schema TEXT;

ALTER TABLE
  public.versions
ADD
  base_schema TEXT;
