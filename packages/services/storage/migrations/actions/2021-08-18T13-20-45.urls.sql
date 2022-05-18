--urls (up)

ALTER TABLE public.version_commit 
  ALTER COLUMN url TYPE text;

ALTER TABLE public.projects 
  ALTER COLUMN build_url TYPE text;

ALTER TABLE public.projects 
  ALTER COLUMN validation_url TYPE text;