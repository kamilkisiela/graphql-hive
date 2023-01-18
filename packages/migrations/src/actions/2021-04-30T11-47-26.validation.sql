--validation (up)

ALTER TABLE public.targets ADD COLUMN validation_enabled boolean NOT NULL DEFAULT FALSE;
ALTER TABLE public.targets ADD COLUMN validation_period smallint NOT NULL DEFAULT 30;
ALTER TABLE public.targets ADD COLUMN validation_percentage float NOT NULL DEFAULT 0.00;