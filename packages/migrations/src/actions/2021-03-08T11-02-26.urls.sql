--urls (up)

ALTER TABLE public.projects
ALTER COLUMN build_url TYPE text,
ALTER COLUMN validation_url TYPE text;