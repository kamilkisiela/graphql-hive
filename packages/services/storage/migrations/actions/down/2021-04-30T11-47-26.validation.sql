--target-settings (down)

ALTER TABLE public.targets DROP COLUMN validation_enabled;
ALTER TABLE public.targets DROP COLUMN validation_period;
ALTER TABLE public.targets DROP COLUMN validation_percentage;