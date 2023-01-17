ALTER TABLE public.projects 
  DROP COLUMN external_composition_enabled,
  DROP COLUMN external_composition_endpoint,
  DROP COLUMN external_composition_secret;