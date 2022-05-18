CREATE TABLE public.target_validation (
  target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  destination_target_id uuid NOT NULL REFERENCES public.targets(id) ON DELETE CASCADE,
  PRIMARY KEY (target_id, destination_target_id)
);

INSERT INTO public.target_validation (target_id, destination_target_id) (SELECT id as target_id, id as destination_target_id FROM public.targets WHERE validation_enabled IS TRUE);