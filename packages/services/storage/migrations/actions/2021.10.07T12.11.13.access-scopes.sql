-- Adds scopes to tokens
ALTER TABLE public.tokens ADD COLUMN scopes text[] DEFAULT NULL;

-- Adds scopes to organization_member
ALTER TABLE public.organization_member ADD COLUMN scopes text[] DEFAULT NULL;

-- Adds scopes to existing regular members
UPDATE 
  public.organization_member
SET 
  scopes = ARRAY['organization:read', 'project:read', 'project:operations-store:read', 'target:read', 'target:registry:read']
WHERE role = 'MEMBER';

-- Adds scopes to existing admin members
UPDATE 
  public.organization_member
SET 
  scopes = ARRAY['organization:read', 'organization:delete', 'organization:settings', 'organization:integrations', 'organization:members', 'project:read', 'project:delete', 'project:settings', 'project:alerts', 'project:operations-store:read', 'project:operations-store:write', 'target:read', 'target:delete', 'target:settings', 'target:registry:read', 'target:registry:write', 'target:tokens:read', 'target:tokens:write']
WHERE role = 'ADMIN';

-- Adds scopes to existing tokens
UPDATE 
  public.tokens
SET 
  scopes = ARRAY['organization:read', 'project:read', 'project:operations-store:read', 'project:operations-store:write', 'target:read', 'target:registry:read', 'target:registry:write']