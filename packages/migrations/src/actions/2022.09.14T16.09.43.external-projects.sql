ALTER TABLE public.projects 
  ADD COLUMN external_composition_enabled boolean NOT NULL DEFAULT FALSE,
  ADD COLUMN external_composition_endpoint text,
  ADD COLUMN external_composition_secret text;