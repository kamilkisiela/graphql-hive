ALTER TABLE public.tokens ADD COLUMN token_alias varchar(64) NOT NULL DEFAULT repeat('*', 64);
ALTER TABLE public.tokens ALTER COLUMN token TYPE varchar(64);
UPDATE public.tokens SET token_alias = concat(substring(token from 1 for 3), repeat('*', 26), substring(token from 30 for 3)), token = encode(sha256(token::bytea), 'hex');
