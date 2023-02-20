--non-unique-emails (down)

ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.users DROP CONSTRAINT users_external_email_key;