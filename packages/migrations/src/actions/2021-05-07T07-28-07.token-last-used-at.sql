--token-last-used-at (up)

ALTER TABLE public.tokens ADD COLUMN last_used_at timestamp with time zone;