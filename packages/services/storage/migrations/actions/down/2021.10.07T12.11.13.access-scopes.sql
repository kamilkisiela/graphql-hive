-- Adds scopes to tokens
ALTER TABLE public.tokens DROP COLUMN scopes;

-- Adds scopes to organization_member
ALTER TABLE public.organization_member DROP COLUMN scopes;